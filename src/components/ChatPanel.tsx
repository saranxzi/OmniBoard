'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '@/types';

// Sub-components
import MessageList from './ChatPanel/MessageList';
import ChatInput from './ChatPanel/ChatInput';

interface ChatPanelProps {
    roomId: string;
}

/**
 * ChatPanel — Handles real-time messaging and UI state.
 * Modularized for better readability.
 */
export default function ChatPanel({ roomId }: ChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const socket = getSocket();
        const handleChatMessage = (msg: ChatMessage) => {
            setMessages((prev) => [...prev, msg]);
            if (!isOpen) setUnreadCount((prev) => prev + 1);
        };
        socket.on('chat-message', handleChatMessage);
        return () => { socket.off('chat-message', handleChatMessage); };
    }, [isOpen]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = inputText.trim();
        if (!trimmed) return;

        getSocket().emit('chat-message', {
            roomId,
            message: { text: trimmed, timestamp: Date.now() }
        });
        setInputText('');
    };

    return (
        <>
            <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setUnreadCount(0);
                }}
                className="fixed top-6 right-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl border border-theme-light p-2.5 flex items-center justify-center transition-colors group"
            >
                <div className="relative">
                    <MessageSquare className="w-5 h-5 text-theme-dark/70 group-hover:text-theme-dark" />
                    {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    )}
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
                            className="fixed inset-0 z-[60] bg-theme-dark/20 backdrop-blur-sm sm:hidden"
                        />

                        <motion.div
                            initial={{ opacity: 0, x: 300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 300 }}
                            className="fixed right-0 top-0 bottom-0 z-[70] w-full sm:w-80 bg-white/95 backdrop-blur-2xl border-l border-theme-light shadow-2xl flex flex-col"
                        >
                            <div className="p-4 border-b border-theme-light flex items-center justify-between bg-white shrink-0">
                                <h2 className="text-lg font-black text-theme-dark flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-theme-accent" />
                                    Chat
                                </h2>
                                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-theme-lightest text-theme-dark/40 hover:text-theme-dark transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <MessageList messages={messages} />

                            <ChatInput
                                value={inputText}
                                onChange={setInputText}
                                onSubmit={handleSendMessage}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
