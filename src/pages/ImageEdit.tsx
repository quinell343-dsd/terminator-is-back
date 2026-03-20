import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Send, Loader2, Wand2, Download, Sparkles } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ImageEdit() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('image/')) {
      setFile(dropped);
      setPreview(URL.createObjectURL(dropped));
      setResult(null);
    }
  };

  const editImage = async () => {
    if (!file || !prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const ai = getGeminiClient();
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise(resolve => (reader.onload = resolve));
      const base64Data = (reader.result as string).split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type,
              },
            },
            { text: prompt },
          ],
        },
      });

      let editedImage = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          editedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (editedImage) {
        setResult(editedImage);
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, 'creations'), {
              uid: auth.currentUser.uid,
              type: 'image',
              prompt: `Edit: ${prompt}`,
              url: editedImage,
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
      setResult('Error editing image. Please try again.');
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
            To use the Gemini 3.1 Flash Image model, you need to select a paid Google Cloud project API key.
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
          <h1 className="text-3xl font-bold tracking-tight">Image Editor</h1>
          <p className="text-zinc-400">Upload an image and describe how you want to edit it.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                preview ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/50'
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
                <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <ImageIcon className="w-12 h-12 mb-4 text-zinc-500" />
                  <p className="text-sm font-medium text-zinc-300">Click or drag to upload</p>
                  <p className="text-xs text-zinc-500 mt-2">Supports images only</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPrompt("Remove all text, names, watermarks, and words from the image, seamlessly filling in the background.")}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-zinc-700"
                >
                  Remove Names/Text
                </button>
                <button
                  onClick={() => setPrompt("Enhance the image quality, make it sharper and more vibrant.")}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-zinc-700"
                >
                  Enhance Quality
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Make it look like a watercolor painting..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  disabled={loading || !file}
                />
                <button
                  onClick={editImage}
                  disabled={loading || !file || !prompt.trim()}
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Result Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Result</h3>
              {result && !result.startsWith('Error') && (
                <a
                  href={result}
                  download="edited-image.png"
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
                  <p>Applying your edits...</p>
                </div>
              ) : result ? (
                result.startsWith('Error') ? (
                  <p className="text-red-400">{result}</p>
                ) : (
                  <img src={result} alt="Edited" className="w-full h-full object-contain" />
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-600">
                  <Wand2 className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your edited image will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
