import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Video, Send, Loader2, FileWarning } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';

export default function VisionStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (dropped && (dropped.type.startsWith('image/') || dropped.type.startsWith('video/'))) {
      setFile(dropped);
      setPreview(URL.createObjectURL(dropped));
      setResult(null);
    }
  };

  const analyzeMedia = async () => {
    if (!file || !prompt.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const ai = getGeminiClient();
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise(resolve => (reader.onload = resolve));
      const base64Data = (reader.result as string).split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
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

      setResult(response.text || 'No response generated.');
    } catch (error) {
      console.error(error);
      setResult('Error analyzing media. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Vision Studio</h1>
          <p className="text-zinc-400">Upload an image or video and ask Gemini to analyze it.</p>
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
                accept="image/*,video/*"
                className="hidden"
              />
              {preview ? (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  {file?.type.startsWith('video/') ? (
                    <video src={preview} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex gap-4 mb-4 text-zinc-500">
                    <ImageIcon className="w-8 h-8" />
                    <Video className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-medium text-zinc-300">Click or drag to upload</p>
                  <p className="text-xs text-zinc-500 mt-2">Supports images and videos</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What do you want to know about this media?"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                disabled={loading || !file}
              />
              <button
                onClick={analyzeMedia}
                disabled={loading || !file || !prompt.trim()}
                className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Analyze
              </button>
            </div>
          </div>

          {/* Result Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px]">
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Analysis Result</h3>
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p>Analyzing media with Gemini Pro...</p>
              </div>
            ) : result ? (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <FileWarning className="w-12 h-12 mb-4 opacity-20" />
                <p>Upload media and ask a question to see the analysis here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
