import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Loader2, Download, Settings2, Sparkles } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];
const IMAGE_SIZES = ['1K', '2K', '4K'];

export default function ImageGen() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);

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
      setHasKey(true); // Assume success to mitigate race condition
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          }
        }
      });

      let base64Image = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (base64Image) {
        setResult(base64Image);
        
        // Save to Firestore
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, 'creations'), {
              uid: auth.currentUser.uid,
              type: 'image',
              prompt,
              url: base64Image, // Storing base64 directly as URL for simplicity in this demo
              createdAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'creations');
          }
        }
      } else {
        setResult('Error: No image generated.');
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('Requested entity was not found')) {
        setHasKey(false);
      }
      setResult('Error generating image. Please try again.');
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
            To use the high-quality Gemini 3 Pro Image model, you need to select a paid Google Cloud project API key.
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
          <h1 className="text-3xl font-bold tracking-tight">Image Generation</h1>
          <p className="text-zinc-400">Create stunning images with Gemini 3 Pro Image.</p>
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
                <div className="grid grid-cols-4 gap-2">
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
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Image Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={`py-2 text-xs font-medium rounded-lg transition-colors border ${
                        imageSize === size 
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <label className="block text-sm font-medium text-zinc-400 mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A futuristic city with flying cars..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                disabled={loading}
              />
              <button
                onClick={generateImage}
                disabled={loading || !prompt.trim()}
                className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate Image
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
                  download="generated-image.png"
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
            
            <div className="flex-1 flex items-center justify-center bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden relative">
              {loading ? (
                <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p>Generating your masterpiece...</p>
                </div>
              ) : result ? (
                result.startsWith('Error') ? (
                  <p className="text-red-400">{result}</p>
                ) : (
                  <img src={result} alt="Generated" className="w-full h-full object-contain" />
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-600">
                  <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your generated image will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
