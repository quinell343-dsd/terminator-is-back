import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Search, Zap, BrainCircuit, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getGeminiClient } from '../lib/gemini';
import { ThinkingLevel } from '@google/genai';

type Message = {
  role: 'user' | 'model';
  content: string;
  groundingUrls?: string[];
};

type ChatMode = 'pro' | 'fast' | 'search';

export default function ChatSearch() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('pro');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const ai = getGeminiClient();
      let modelName = '';
      let config: any = {};

      if (mode === 'pro') {
        modelName = 'gemini-3.1-pro-preview';
        config = { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } };
      } else if (mode === 'fast') {
        modelName = 'gemini-3.1-flash-lite-preview';
      } else if (mode === 'search') {
        modelName = 'gemini-3-flash-preview';
        config = { tools: [{ googleSearch: {} }] };
      }

      // We use generateContent instead of chat to easily pass the full history
      const contents = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMsg }] });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config
      });

      let groundingUrls: string[] = [];
      if (mode === 'search') {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          groundingUrls = chunks.map((chunk: any) => chunk.web?.uri).filter(Boolean);
        }
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        content: response.text || 'No response',
        groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: 'Error: Failed to generate response.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/30">
        <h2 className="text-lg font-medium">Chat & Search</h2>
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => setMode('pro')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'pro' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <BrainCircuit className="w-4 h-4" /> Pro (Think)
          </button>
          <button
            onClick={() => setMode('fast')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'fast' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Zap className="w-4 h-4" /> Fast
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'search' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p>Start a conversation with Omni AI</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-zinc-800'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`flex-1 space-y-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-50' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline bg-indigo-500/10 px-2 py-1 rounded">
                            {new URL(url).hostname}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-4 max-w-3xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
            <div className="flex-1">
              <div className="inline-block p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask Omni AI (${mode === 'pro' ? 'Pro' : mode === 'fast' ? 'Fast' : 'Search'})...`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
