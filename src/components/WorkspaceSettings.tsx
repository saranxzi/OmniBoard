'use client';

import { useState, useEffect } from 'react';
import { Settings, X, Copy, Check } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomUsers, RoomRole } from '@/types';

// Sub-components
import UserList from './WorkspaceSettings/UserList';
import PrivacySettings from './WorkspaceSettings/PrivacySettings';
import InviteLink from './WorkspaceSettings/InviteLink';

interface WorkspaceSettingsProps {
    roomCode: string;
    isPrivate: boolean;
    myRole: RoomRole;
    roomUsers: RoomUsers;
}

/**
 * WorkspaceSettings — A modular panel for room management.
 * Handles visibility, user listing, invite sharing, and role management.
 */
export default function WorkspaceSettings({ roomCode, isPrivate: initialIsPrivate, myRole, roomUsers }: WorkspaceSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

    const { users: activeUsers, count: userCount } = roomUsers;
    const isLeader = myRole === 'leader';

    useEffect(() => {
        const socket = getSocket();
        const handleForceDisconnect = () => { window.location.href = '/?kicked=true'; };
        socket.on('force-disconnect', handleForceDisconnect);
        return () => { socket.off('force-disconnect', handleForceDisconnect); };
    }, []);

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/board/${roomCode}` : `/board/${roomCode}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch {
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        } finally {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleTogglePrivacy = async () => {
        if (!isLeader) return;
        setIsUpdatingPrivacy(true);
        try {
            const res = await fetch('/api/rooms/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode, isPrivate: !isPrivate })
            });
            if (res.ok) setIsPrivate(!isPrivate);
        } catch (error) {
            console.error('Failed to update privacy:', error);
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    const handleKickUser = (socketId: string) => {
        if (!isLeader) return;
        getSocket().emit('kick-user', { roomCode, targetSocketId: socketId });
    };

    const handleUpdateRole = (socketId: string, newRole: RoomRole) => {
        if (!isLeader) return;
        getSocket().emit('update-user-role', { roomId: roomCode, targetSocketId: socketId, newRole });
    };

    const handleTransferLeadership = (socketId: string) => {
        if (!isLeader) return;
        if (!window.confirm('Are you sure you want to transfer leadership? You will become an editor.')) return;
        getSocket().emit('transfer-leadership', { roomId: roomCode, targetSocketId: socketId });
    };

    // Role badge for the header
    const roleBadge = {
        leader: { text: 'Leader', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        editor: { text: 'Editor', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        viewer: { text: 'Viewer', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    }[myRole];

    return (
        <>
            <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setIsOpen(true)}
                className="fixed top-6 left-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl border border-theme-light p-2.5 flex items-center gap-2 transition-colors group"
            >
                <Settings className="w-5 h-5 text-theme-dark/70 group-hover:text-theme-dark" />
                <div className="flex items-center gap-1.5 pr-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-theme-dark/70">{userCount}</span>
                </div>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-[60] bg-theme-dark/20 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, x: -300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -300 }}
                            className="fixed left-0 top-0 bottom-0 z-[70] w-80 bg-white/95 backdrop-blur-2xl border-r border-theme-light shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-theme-light flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-black text-theme-dark">Workspace</h2>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                                        {roleBadge.text}
                                    </span>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-theme-lightest text-theme-dark/40 hover:text-theme-dark transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                                <div>
                                    <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3">Room Code</h3>
                                    <div className="bg-theme-lightest rounded-xl p-4 flex items-center justify-between">
                                        <span className="font-mono font-black text-xl text-theme-dark tracking-[0.3em]">{roomCode}</span>
                                        <PrivacySettings
                                            isPrivate={isPrivate}
                                            isCreator={isLeader}
                                            isUpdatingPrivacy={isUpdatingPrivacy}
                                            onToggle={handleTogglePrivacy}
                                        />
                                    </div>
                                </div>

                                <InviteLink shareUrl={shareUrl} copied={copied} onCopy={handleCopy} />

                                <UserList
                                    users={activeUsers}
                                    count={userCount}
                                    isLeader={isLeader}
                                    onKick={handleKickUser}
                                    onUpdateRole={handleUpdateRole}
                                    onTransferLeadership={handleTransferLeadership}
                                />
                            </div>

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
