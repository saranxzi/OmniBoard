import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { ChatMessage } from '@/types';
import { getSocket } from '@/lib/socket';

interface MessageListProps {
    messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-3">
                <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm font-medium">No messages yet.</p>
                <p className="text-xs">Be the first to say hello!</p>
            </div>
        );
    }

    const mySocketId = getSocket().id;

    return (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((msg, idx) => {
                const isMe = msg.socketId === mySocketId;
                const showHeader = idx === 0 || messages[idx - 1].user !== msg.user || (msg.timestamp - messages[idx - 1].timestamp > 60000);

                return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showHeader && (
                            <span className={`text-[10px] font-bold text-theme-dark/40 uppercase tracking-widest mb-1 ${isMe ? 'pr-1' : 'pl-1'}`}>
                                {isMe ? 'You' : msg.user}
                            </span>
                        )}
                        <div 
                            className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                                isMe 
                                ? 'bg-theme-dark text-white rounded-tr-sm' 
                                : 'bg-theme-lightest text-theme-dark border border-theme-light rounded-tl-sm'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}
