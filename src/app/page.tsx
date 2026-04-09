'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, UserPlus, Users, PlusCircle, LogOut, User, Sparkles } from 'lucide-react';
import { useAuthStore } from './../store/useAuthStore';
import { motion } from 'framer-motion';

export default function Lobby() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateBoard = async () => {
    setIsCreating(true);
    try {
        const payload = user ? {
            isPrivate: false,
            creatorEmail: user.email,
            creatorName: user.name,
            allowedEmails: []
        } : { isPrivate: false };

        const res = await fetch('/api/rooms/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            console.log('Room created successfully, navigating to:', data.code);
            router.push(`/board/${data.code}`);
            // Force reset state after a short delay in case router.push hangs temporarily 
            // but we still want the UI to be responsive if navigation completes slowly
            setTimeout(() => setIsCreating(false), 3000);
        } else {
            const errBody = await res.text();
            console.error('Failed to create room:', res.status, errBody);
            setIsCreating(false);
        }
    } catch (e) {
        console.error(e);
        setIsCreating(false);
    }
  };

  const handleJoinBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/board/${roomId.trim()}`);
    }
  };

  return (
    <main className="w-full h-screen overflow-hidden m-0 p-0 relative bg-theme-lightest flex flex-col items-center justify-center font-sans tracking-tight">
      {/* Soft Animated Background Blob */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-12 w-96 h-96 bg-theme-light rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
        <div className="absolute bottom-1/4 -right-12 w-96 h-96 bg-theme-accent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header / Auth */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 right-0 p-6 z-20 flex gap-4"
      >
        {mounted && user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-theme-dark font-medium bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md shadow-sm border border-white/50">
              <User className="w-4 h-4 text-theme-accent" />
              <span>{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-theme-dark hover:bg-theme-light transition-colors font-medium text-sm backdrop-blur-md"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-theme-dark hover:bg-theme-light transition-colors font-medium text-sm backdrop-blur-md"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-dark hover:bg-theme-dark/90 text-white transition-colors shadow-sm font-medium text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Link>
          </>
        )}
      </motion.div>

      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6">

        {/* Logo / Branding */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-theme-accent animate-[pulse_3s_ease-in-out_infinite]" />
            <h1 className="text-5xl font-black text-theme-dark tracking-tight">
              OmniBoard
            </h1>
          </div>
          <p className="text-base text-theme-dark/70 font-medium">
            Your open, real-time infinite canvas.
          </p>
        </motion.div>

        {/* Main Action Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2rem] shadow-xl shadow-theme-dark/5 flex flex-col gap-6 relative overflow-hidden"
        >
          {/* Create Room */}
          <button
            onClick={handleCreateBoard}
            disabled={isCreating}
            className="w-full group flex items-center justify-center gap-3 bg-theme-dark hover:bg-theme-dark/90 text-white p-4 rounded-2xl shadow-md transition-all duration-300 font-semibold text-lg disabled:opacity-50"
          >
            <PlusCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span>{isCreating ? 'Launching...' : 'Create Workspace'}</span>
          </button>

          <div className="flex items-center gap-4 my-1">
            <div className="h-[2px] bg-theme-light flex-1 rounded-full" />
            <span className="text-xs font-bold text-theme-accent uppercase tracking-widest">OR</span>
            <div className="h-[2px] bg-theme-light flex-1 rounded-full" />
          </div>

          {/* Join Room */}
          <form onSubmit={handleJoinBoard} className="flex flex-col gap-3">
            <label htmlFor="roomId" className="text-sm font-bold text-theme-dark ml-1">
              Join existing workspace
            </label>
            <div className="flex gap-2">
              <input
                id="roomId"
                type="text"
                placeholder="Enter Room Code (e.g. X7K9P2)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 bg-white border-2 border-theme-light rounded-xl px-4 py-3 text-theme-dark focus:outline-none focus:border-theme-accent transition-colors font-mono placeholder:text-theme-dark/30"
              />
              <button
                type="submit"
                disabled={!roomId.trim()}
                className="bg-theme-light hover:bg-theme-accent text-theme-dark border-2 border-theme-light hover:border-theme-accent px-6 py-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                Join
              </button>
            </div>
          </form>

        </motion.div>
      </div>

    </main>
  );
}
