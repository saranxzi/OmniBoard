import { useRef, useEffect } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
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
                <p className="text-xs">Type <span className="font-mono font-bold text-purple-500">@ai</span> to ask the AI!</p>
            </div>
        );
    }

    const mySocketId = getSocket().id;

    return (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((msg, idx) => {
                const isMe = msg.socketId === mySocketId;
                const isBot = msg.isBot;
                const isStreaming = msg.isStreaming;
                const showHeader = idx === 0 || messages[idx - 1].user !== msg.user || (msg.timestamp - messages[idx - 1].timestamp > 60000);

                // Bot message rendering
                if (isBot) {
                    return (
                        <div key={msg.id} className="flex flex-col items-start">
                            {showHeader && (
                                <span className="text-[10px] font-bold uppercase tracking-widest mb-1 pl-1 flex items-center gap-1 text-purple-500">
                                    <Sparkles className="w-3 h-3" />
                                    {msg.user}
                                </span>
                            )}
                            <div className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed ai-message-bubble ${
                                isStreaming ? 'ai-streaming' : ''
                            }`}>
                                <div className="ai-message-text whitespace-pre-wrap break-words">
                                    {msg.text || (isStreaming ? '' : '')}
                                    {isStreaming && <span className="ai-typing-cursor">▌</span>}
                                </div>
                            </div>
                        </div>
                    );
                }

                // Regular user message
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
