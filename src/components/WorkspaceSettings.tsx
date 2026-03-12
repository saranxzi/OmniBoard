'use client';

import { useState, useEffect } from 'react';
import { Settings, Copy, Check, Users, Link2, X, Globe, Lock } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceSettingsProps {
    roomCode: string;
    isPrivate: boolean;
}

export default function WorkspaceSettings({ roomCode, isPrivate }: WorkspaceSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeUsers, setActiveUsers] = useState<{ socketId: string; name: string }[]>([]);
    const [userCount, setUserCount] = useState(0);

    // Listen for room-users events from the shared socket
    useEffect(() => {
        const socket = getSocket();

        const handleRoomUsers = (data: { count: number; users: { socketId: string; name: string }[] }) => {
            setUserCount(data.count);
            setActiveUsers(data.users);
        };

        socket.on('room-users', handleRoomUsers);
        return () => {
            socket.off('room-users', handleRoomUsers);
        };
    }, []);

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/board/${roomCode}`
        : `/board/${roomCode}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-https contexts
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <>
            {/* Floating Settings Button */}
            <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                onClick={() => setIsOpen(true)}
                className="fixed top-6 left-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-2.5 flex items-center gap-2 transition-colors duration-300 group"
                title="Workspace Settings"
            >
                <Settings className="w-5 h-5 text-theme-dark/70 group-hover:text-theme-dark transition-colors" />
                <div className="flex items-center gap-1.5 pr-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-theme-dark/70">{userCount}</span>
                </div>
            </motion.button>

            {/* Settings Panel Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-[60] bg-theme-dark/20 backdrop-blur-sm"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: -300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -300 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed left-0 top-0 bottom-0 z-[70] w-80 bg-white/95 backdrop-blur-2xl border-r border-theme-light shadow-2xl shadow-theme-dark/10 flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-theme-light flex items-center justify-between">
                                <h2 className="text-lg font-black text-theme-dark">Workspace</h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-theme-lightest text-theme-dark/40 hover:text-theme-dark transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                                {/* Room Info */}
                                <div>
                                    <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3">Room Code</h3>
                                    <div className="bg-theme-lightest rounded-xl p-4 flex items-center justify-between">
                                        <span className="font-mono font-black text-xl text-theme-dark tracking-[0.3em]">{roomCode}</span>
                                        <div className="flex items-center gap-1.5">
                                            {isPrivate ? (
                                                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                                    <Lock className="w-3 h-3" /> Private
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                                    <Globe className="w-3 h-3" /> Public
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Shareable Link */}
                                <div>
                                    <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3">Share Link</h3>
                                    <div className="bg-theme-lightest rounded-xl p-3 flex items-center gap-2">
                                        <Link2 className="w-4 h-4 text-theme-accent flex-shrink-0" />
                                        <span className="text-sm font-mono text-theme-dark/70 truncate flex-1">{shareUrl}</span>
                                        <button
                                            onClick={handleCopy}
                                            className={`p-2 rounded-lg transition-all flex-shrink-0 ${copied
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-white hover:bg-theme-light text-theme-dark/60 hover:text-theme-dark'
                                            }`}
                                            title="Copy link"
                                        >
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Active Users */}
                                <div>
                                    <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Active Users ({userCount})
                                    </h3>
                                    <div className="flex flex-col gap-1.5">
                                        {activeUsers.map((u) => (
                                            <div
                                                key={u.socketId}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-theme-lightest hover:bg-theme-light/60 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-theme-accent/30 flex items-center justify-center text-theme-dark font-bold text-sm flex-shrink-0">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-theme-dark truncate">{u.name}</p>
                                                </div>
                                                <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                                            </div>
                                        ))}
                                        {activeUsers.length === 0 && (
                                            <p className="text-sm text-theme-dark/40 text-center py-4">No one else is here yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-theme-light">
                                <button
                                    onClick={handleCopy}
                                    className="w-full flex items-center justify-center gap-2 bg-theme-dark hover:bg-theme-dark/90 text-white py-3 rounded-xl font-bold transition-all shadow-md"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Link Copied!' : 'Copy Invite Link'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
