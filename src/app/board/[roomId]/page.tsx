'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Toolbar from '@/components/Toolbar';
import { useAuthStore } from '@/store/useAuthStore';
import WorkspaceSettings from '@/components/WorkspaceSettings';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const Board = dynamic(() => import('@/components/Board'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-theme-lightest text-theme-dark/60 font-medium tracking-wide">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-6 h-6 border-2 border-theme-accent border-t-transparent rounded-full mr-3" />
            Initializing Canvas...
        </div>
    )
});

export default function BoardPage({ params }: { params: { roomId: string } }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(false);

    useEffect(() => {
        const verifyAccess = async () => {
            try {
                const res = await fetch('/api/rooms/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: params.roomId, userEmail: user?.email }),
                });

                if (res.ok) {
                    const data = await res.json();
                    setResolvedRoomId(data.roomId);
                    setRoomCode(data.code);
                    setIsPrivate(data.isPrivate || false);
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } catch (error) {
                console.error('Error verifying room access:', error);
                setIsAuthorized(false);
            }
        };

        verifyAccess();
    }, [params.roomId, user]);

    if (isAuthorized === null) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-theme-lightest">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="mb-4">
                    <Lock className="w-8 h-8 text-theme-accent" />
                </motion.div>
                <p className="text-theme-dark/70 font-medium">Verifying Access...</p>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-theme-lightest">
                <div className="bg-white/80 backdrop-blur-2xl border border-red-200 p-8 rounded-[2rem] text-center max-w-sm mx-4 shadow-xl shadow-red-500/5">
                    <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-theme-dark mb-2">Access Denied</h2>
                    <p className="text-theme-dark/70 mb-8 font-medium">
                        This workspace is locked by the creator.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full px-6 py-3 bg-theme-dark hover:bg-theme-dark/90 text-white rounded-xl font-bold transition-all shadow-md"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <main className="w-full h-screen overflow-hidden m-0 p-0 relative bg-theme-lightest transition-colors duration-500">
            {/* Decorative background */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-theme-light/40 via-theme-lightest to-transparent pointer-events-none" />

            {/* Room code badge */}
            {roomCode && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-2xl rounded-xl shadow-sm border border-theme-light px-4 py-1.5 flex items-center gap-2">
                    <span className="text-xs text-theme-dark/50 font-medium">Room</span>
                    <span className="text-sm font-mono font-black text-theme-dark tracking-widest">{roomCode}</span>
                </div>
            )}

            {/* Workspace Settings - rendered at top level outside canvas stacking context */}
            {roomCode && <WorkspaceSettings roomCode={roomCode} isPrivate={isPrivate} />}

            <div className="relative z-10 w-full h-full">
                {resolvedRoomId && <Board key={resolvedRoomId} />}
                <Toolbar />
            </div>
        </main>
    );
}
