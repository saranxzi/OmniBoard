import { Users, Crown, Pencil, Eye, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useState } from 'react';
import { RoomRole } from '@/types';

interface UserListProps {
    users: { socketId: string; name: string; role?: RoomRole }[];
    count: number;
    isLeader: boolean;
    onKick: (socketId: string) => void;
    onUpdateRole: (socketId: string, newRole: RoomRole) => void;
    onTransferLeadership: (socketId: string) => void;
}

const ROLE_CONFIG = {
    leader: { label: 'Leader', icon: Crown, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    editor: { label: 'Editor', icon: Pencil, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    viewer: { label: 'Viewer', icon: Eye, color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

export default function UserList({ users, count, isLeader, onKick, onUpdateRole, onTransferLeadership }: UserListProps) {
    const mySocketId = getSocket().id;
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    return (
        <div>
            <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Active Users ({count})
            </h3>
            <div className="flex flex-col gap-1.5">
                {users.map((u) => {
                    const role = u.role || 'editor';
                    const roleConfig = ROLE_CONFIG[role];
                    const RoleIcon = roleConfig.icon;
                    const isMe = u.socketId === mySocketId;
                    const isUserLeader = role === 'leader';

                    return (
                        <div
                            key={u.socketId}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-theme-lightest hover:bg-theme-light/60 transition-colors relative"
                        >
                            {/* Avatar with role-colored ring */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                isUserLeader 
                                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' 
                                    : role === 'viewer' 
                                        ? 'bg-gray-100 text-gray-600'
                                        : 'bg-theme-accent/30 text-theme-dark'
                            }`}>
                                {u.name.charAt(0).toUpperCase()}
                            </div>

                            {/* Name + role badge */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-theme-dark truncate flex items-center gap-1.5">
                                    {u.name}
                                    {isMe && <span className="text-[10px] text-theme-dark/40">(you)</span>}
                                </p>
                                <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border mt-0.5 ${roleConfig.color}`}>
                                    <RoleIcon className="w-2.5 h-2.5" />
                                    {roleConfig.label}
                                </div>
                            </div>

                            {/* Leader actions for other users */}
                            {isLeader && !isMe && (
                                <div className="flex items-center gap-1 relative">
                                    {/* Role dropdown */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenDropdown(openDropdown === u.socketId ? null : u.socketId)}
                                            className="text-[10px] font-bold text-theme-dark/50 hover:text-theme-dark bg-white hover:bg-theme-lightest px-2 py-1 rounded-lg transition-colors flex items-center gap-0.5 border border-theme-light"
                                        >
                                            Role
                                            <ChevronDown className="w-3 h-3" />
                                        </button>

                                        {openDropdown === u.socketId && (
                                            <div className="absolute right-0 top-full mt-1 bg-white border border-theme-light rounded-xl shadow-xl z-50 overflow-hidden min-w-[130px]">
                                                {!isUserLeader && (
                                                    <button
                                                        onClick={() => { onTransferLeadership(u.socketId); setOpenDropdown(null); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                                                    >
                                                        <ArrowRightLeft className="w-3 h-3" />
                                                        Make Leader
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { onUpdateRole(u.socketId, 'editor'); setOpenDropdown(null); }}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-blue-50 transition-colors ${role === 'editor' ? 'text-blue-700 bg-blue-50' : 'text-theme-dark'}`}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                    Editor
                                                </button>
                                                <button
                                                    onClick={() => { onUpdateRole(u.socketId, 'viewer'); setOpenDropdown(null); }}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors ${role === 'viewer' ? 'text-gray-600 bg-gray-50' : 'text-theme-dark'}`}
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    Viewer
                                                </button>
                                                <div className="border-t border-theme-light" />
                                                <button
                                                    onClick={() => { onKick(u.socketId); setOpenDropdown(null); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                                                >
                                                    Kick
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 ml-1" />
                        </div>
                    );
                })}
                {users.length === 0 && (
                    <p className="text-sm text-theme-dark/40 text-center py-4">No one else is here yet</p>
                )}
            </div>
        </div>
    );
}
