'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, UserPlus, Users, PlusCircle, LogOut, User } from 'lucide-react';
import { useAuthStore } from './../store/useAuthStore';

export default function Lobby() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateBoard = () => {
    // Generate a simple random room ID for demo purposes
    const newRoomId = Math.random().toString(36).substring(2, 9);
    router.push(`/board/${newRoomId}`);
  };

  const handleJoinBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/board/${roomId.trim()}`);
    }
  };

  return (
    <main className="w-full h-screen overflow-hidden m-0 p-0 relative bg-slate-50 dark:bg-[#121212] flex flex-col items-center justify-center font-sans transition-colors duration-300">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-50/20 to-transparent dark:from-blue-900/20 dark:via-[#121212]/20 dark:to-transparent pointer-events-none" />

      {/* Header / Auth */}
      <div className="absolute top-0 right-0 p-6 z-20 flex gap-4">
        {mounted && user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-xl backdrop-blur-sm shadow-sm">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg font-medium text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Link>
          </>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-6">

        {/* Logo / Branding */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 tracking-tight mb-4">
            OmniBoard
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            A collaborative infinite canvas.
          </p>
          <div className="mt-4 inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Made by <span className="text-blue-600 dark:text-blue-400">Atharv</span> and <span className="text-indigo-600 dark:text-indigo-400">Saran</span>
            </p>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col gap-6">

          {/* Create Room */}
          <button
            onClick={handleCreateBoard}
            className="w-full group flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all font-semibold text-lg"
          >
            <PlusCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
            Create New Workspace
          </button>

          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">OR</span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
          </div>

          {/* Join Room */}
          <form onSubmit={handleJoinBoard} className="flex flex-col gap-3">
            <label htmlFor="roomId" className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Join existing workspace
            </label>
            <div className="flex gap-2">
              <input
                id="roomId"
                type="text"
                placeholder="Enter Room ID..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
              />
              <button
                type="submit"
                disabled={!roomId.trim()}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                Join
              </button>
            </div>
          </form>

        </div>

      </div>
    </main>
  );
}
