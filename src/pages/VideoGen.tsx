import React, { useState, useRef, useEffect } from 'react';
import { Video, Loader2, Download, Settings2, Sparkles, Image as ImageIcon, Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ASPECT_RATIOS = ['16:9', '9:16'];

export default function VideoGen() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(Number(e.target.value));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const keySelected = await window.aistudio.hasSelectedApiKey();
        setHasKey(keySelected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const ai = getGeminiClient();
      
      let imageParam = undefined;
      if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise(resolve => (reader.onload = resolve));
        const base64Data = (reader.result as string).split(',')[1];
        imageParam = {
          imageBytes: base64Data,
          mimeType: file.type,
        };
      }

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: imageParam,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio,
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        // Fetch the video using the API key
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY || '',
          },
        });
        
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        setResult(videoUrl);
        
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, 'creations'), {
              uid: auth.currentUser.uid,
              type: 'video',
              prompt,
              url: videoUrl, // Note: Object URLs are temporary, in a real app you'd upload the blob to Storage
              createdAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'creations');
          }
        }
      } else {
        setResult('Error: No video generated.');
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('Requested entity was not found')) {
        setHasKey(false);
      }
      setResult('Error generating video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 text-white p-8">
        <div className="max-w-md text-center space-y-6 bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/30">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold">API Key Required</h2>
          <p className="text-zinc-400">
            To use the Veo 3 Video Generation model, you need to select a paid Google Cloud project API key.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Video Generation</h1>
          <p className="text-zinc-400">Create videos from text or animate an image with Veo 3.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-lg font-medium border-b border-zinc-800 pb-4">
              <Settings2 className="w-5 h-5 text-indigo-400" />
              Settings
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 text-xs font-medium rounded-lg transition-colors border ${
                        aspectRatio === ratio 
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {ratio === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Starting Image (Optional)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    preview ? 'border-zinc-700 bg-zinc-950' : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-950'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {preview ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                      <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <ImageIcon className="w-6 h-6 mb-2 text-zinc-500" />
                      <p className="text-xs text-zinc-400">Click to upload image</p>
                    </div>
                  )}
                </div>
                {preview && (
                  <button 
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="text-xs text-red-400 mt-2 hover:underline"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <label className="block text-sm font-medium text-zinc-400 mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A cinematic shot of a neon city..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                disabled={loading}
              />
              <button
                onClick={generateVideo}
                disabled={loading || !prompt.trim()}
                className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                Generate Video
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Result</h3>
              {result && !result.startsWith('Error') && (
                <a
                  href={result}
                  download="generated-video.mp4"
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
            
            <div className="flex-1 flex items-center justify-center bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden relative">
              {loading ? (
                <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4 max-w-xs text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p>Generating video... This may take a few minutes. Please don't close this page.</p>
                </div>
              ) : result ? (
                result.startsWith('Error') ? (
                  <p className="text-red-400">{result}</p>
                ) : (
                  <div 
                    className="relative w-full h-full group flex items-center justify-center bg-black"
                    onMouseEnter={() => setShowControls(true)}
                    onMouseLeave={() => setShowControls(false)}
                  >
                    <video 
                      ref={videoRef}
                      src={result} 
                      autoPlay 
                      loop 
                      playsInline
                      className="w-full h-full object-contain"
                      onClick={togglePlay}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                    
                    {/* Custom Controls Overlay */}
                    <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                      {/* Progress Bar */}
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={progress || 0} 
                        onChange={handleSeek} 
                        className="w-full h-1.5 mb-4 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all" 
                      />
                      
                      {/* Controls Row */}
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                          <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                          </button>
                          
                          <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                          
                          <span className="text-xs font-medium font-mono tracking-wider opacity-80">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        </div>
                        
                        <button onClick={toggleFullscreen} className="hover:text-indigo-400 transition-colors">
                          <Maximize className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-600">
                  <Video className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your generated video will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
