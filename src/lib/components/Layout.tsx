import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Sparkles,
  LogOut,
  Camera,
  Wand2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logOut } from '../firebase';

const navItems = [
  { to: '/', icon: MessageSquare, label: 'Chat & Search' },
  { to: '/vision', icon: Camera, label: 'Vision Studio' },
  { to: '/image-gen', icon: ImageIcon, label: 'Image Gen' },
  { to: '/image-edit', icon: Wand2, label: 'Image Edit' },
  { to: '/video-gen', icon: Video, label: 'Video Gen' },
  { to: '/audio', icon: Mic, label: 'Audio Studio' },
];

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800/50 bg-zinc-900/50 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="font-semibold tracking-tight">Omni Studio</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-3 mb-4 px-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  {user.email?.[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
