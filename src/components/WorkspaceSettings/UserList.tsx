import { Users } from 'lucide-react';
import { getSocket } from '@/lib/socket';

interface UserListProps {
    users: { socketId: string; name: string }[];
    count: number;
    isCreator: boolean;
    onKick: (socketId: string) => void;
}

export default function UserList({ users, count, isCreator, onKick }: UserListProps) {
    const mySocketId = getSocket().id;

    return (
        <div>
            <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Active Users ({count})
            </h3>
            <div className="flex flex-col gap-1.5">
                {users.map((u) => (
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
                        {isCreator && u.socketId !== mySocketId && (
                            <button
                                onClick={() => onKick(u.socketId)}
                                className="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors"
                            >
                                Kick
                            </button>
                        )}
                        <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 ml-1" />
                    </div>
                ))}
                {users.length === 0 && (
                    <p className="text-sm text-theme-dark/40 text-center py-4">No one else is here yet</p>
                )}
            </div>
        </div>
    );
}
