import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Square, Loader2, Volume2, Radio } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import { Modality, LiveServerMessage } from '@google/genai';

export default function AudioStudio() {
  const [tab, setTab] = useState<'tts' | 'live'>('tts');

  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);

  // Live State
  const [isLive, setIsLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState('Disconnected');
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  const generateTTS = async () => {
    if (!ttsText.trim() || ttsLoading) return;
    setTtsLoading(true);
    setTtsAudio(null);

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: ttsText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: ttsVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setTtsAudio(`data:audio/pcm;rate=24000;base64,${base64Audio}`);
        // For simple playback in browser, we might need to convert PCM to WAV, 
        // but for this demo we'll use a simple data URI approach. Note: raw PCM data URIs 
        // might not play natively in all browsers without a wrapper.
        // A robust implementation would decode the base64 and play via AudioContext.
        playPCMBase64(base64Audio, 24000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTtsLoading(false);
    }
  };

  const playPCMBase64 = async (base64: string, sampleRate: number) => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) {
      console.error("Error playing audio", e);
    }
  };

  const startLiveConversation = async () => {
    if (isLive) return;
    
    try {
      setLiveStatus('Connecting...');
      const ai = getGeminiClient();
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true
      } });
      
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorNodeRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      sourceNodeRef.current.connect(processorNodeRef.current);
      processorNodeRef.current.connect(audioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setLiveStatus('Connected - Speak now');
            setIsLive(true);
            
            processorNodeRef.current!.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              
              // Convert to base64
              const buffer = new ArrayBuffer(pcmData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcmData.length; i++) {
                view.setInt16(i * 2, pcmData[i], true);
              }
              
              let binary = '';
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Data = window.btoa(binary);

              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              playPCMBase64(base64Audio, 24000);
            }
          },
          onclose: () => {
            stopLiveConversation();
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            stopLiveConversation();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful voice assistant. Keep your answers concise and conversational.",
        },
      });
      
      liveSessionRef.current = sessionPromise;

    } catch (error) {
      console.error(error);
      setLiveStatus('Error connecting');
      stopLiveConversation();
    }
  };

  const stopLiveConversation = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => {
        try { session.close(); } catch (e) {}
      });
    }
    
    setIsLive(false);
    setLiveStatus('Disconnected');
  };

  useEffect(() => {
    return () => {
      stopLiveConversation();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Audio Studio</h1>
          <p className="text-zinc-400">Generate speech from text or have a live conversation.</p>
        </div>

        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 max-w-md mx-auto">
          <button
            onClick={() => setTab('tts')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'tts' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Text to Speech
          </button>
          <button
            onClick={() => setTab('live')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'live' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Live Conversation
          </button>
        </div>

        {tab === 'tts' ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Voice</label>
              <div className="flex gap-2">
                {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map(voice => (
                  <button
                    key={voice}
                    onClick={() => setTtsVoice(voice)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${
                      ttsVoice === voice 
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {voice}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Text</label>
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Type something for Gemini to say..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                disabled={ttsLoading}
              />
            </div>

            <button
              onClick={generateTTS}
              disabled={ttsLoading || !ttsText.trim()}
              className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
            >
              {ttsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
              Generate & Play
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-8">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
              isLive ? 'bg-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.3)] border-2 border-indigo-500/50' : 'bg-zinc-800 border border-zinc-700'
            }`}>
              {isLive ? (
                <Radio className="w-12 h-12 text-indigo-400 animate-pulse" />
              ) : (
                <Mic className="w-12 h-12 text-zinc-500" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">{isLive ? 'Listening...' : 'Ready to talk'}</h3>
              <p className="text-zinc-400">{liveStatus}</p>
            </div>

            {isLive ? (
              <button
                onClick={stopLiveConversation}
                className="px-8 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                End Conversation
              </button>
            ) : (
              <button
                onClick={startLiveConversation}
                className="px-8 py-3 bg-indigo-500 text-white rounded-full font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Conversation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
