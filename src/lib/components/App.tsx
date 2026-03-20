/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import { signIn } from './firebase';
import { Sparkles } from 'lucide-react';

import ChatSearch from './pages/ChatSearch';
import VisionStudio from './pages/VisionStudio';
import ImageGen from './pages/ImageGen';
import ImageEdit from './pages/ImageEdit';
import VideoGen from './pages/VideoGen';
import AudioStudio from './pages/AudioStudio';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 font-sans">
        <div className="max-w-md w-full p-8 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-center shadow-2xl">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Omni AI Studio</h1>
          <p className="text-zinc-400 mb-8">Sign in to access the ultimate AI creative suite.</p>
          <button
            onClick={signIn}
            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<ChatSearch />} />
              <Route path="vision" element={<VisionStudio />} />
              <Route path="image-gen" element={<ImageGen />} />
              <Route path="image-edit" element={<ImageEdit />} />
              <Route path="video-gen" element={<VideoGen />} />
              <Route path="audio" element={<AudioStudio />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
