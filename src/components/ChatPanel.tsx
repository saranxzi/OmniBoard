'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Sparkles } from 'lucide-react';
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
 * ChatPanel — Handles real-time messaging, AI chatbot streaming, and UI state.
 */
export default function ChatPanel({ roomId }: ChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [isAiThinking, setIsAiThinking] = useState(false);

    // Track streaming AI messages by their ID
    const streamingMessagesRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        const socket = getSocket();

        const handleChatMessage = (msg: ChatMessage) => {
            setMessages((prev) => [...prev, msg]);
            if (!isOpen) setUnreadCount((prev) => prev + 1);
        };

        // AI streaming events
        const handleAiStart = ({ id }: { id: string }) => {
            setIsAiThinking(true);
            streamingMessagesRef.current.set(id, '');

            // Add a placeholder bot message
            const botMsg: ChatMessage = {
                id,
                socketId: 'ai-bot',
                user: 'OmniBoard AI',
                text: '',
                timestamp: Date.now(),
                isBot: true,
                isStreaming: true,
            };
            setMessages((prev) => [...prev, botMsg]);
            if (!isOpen) setUnreadCount((prev) => prev + 1);
        };

        const handleAiChunk = ({ id, token }: { id: string; token: string }) => {
            const current = streamingMessagesRef.current.get(id) || '';
            const updated = current + token;
            streamingMessagesRef.current.set(id, updated);

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === id ? { ...msg, text: updated } : msg
                )
            );
        };

        const handleAiEnd = ({ id }: { id: string }) => {
            setIsAiThinking(false);
            streamingMessagesRef.current.delete(id);

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === id ? { ...msg, isStreaming: false } : msg
                )
            );
        };

        const handleAiError = ({ id, error }: { id: string; error: string }) => {
            setIsAiThinking(false);
            streamingMessagesRef.current.delete(id);

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === id
                        ? { ...msg, text: `⚠️ ${error}`, isStreaming: false }
                        : msg
                )
            );
        };

        socket.on('chat-message', handleChatMessage);
        socket.on('ai-response-start', handleAiStart);
        socket.on('ai-response-chunk', handleAiChunk);
        socket.on('ai-response-end', handleAiEnd);
        socket.on('ai-response-error', handleAiError);

        return () => {
            socket.off('chat-message', handleChatMessage);
            socket.off('ai-response-start', handleAiStart);
            socket.off('ai-response-chunk', handleAiChunk);
            socket.off('ai-response-end', handleAiEnd);
            socket.off('ai-response-error', handleAiError);
        };
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
                    {isAiThinking && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3">
                            <Sparkles className="w-3 h-3 text-purple-500 animate-ai-pulse" />
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
                                    {isAiThinking && (
                                        <span className="flex items-center gap-1 text-xs font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                                            <Sparkles className="w-3 h-3" />
                                            AI thinking...
                                        </span>
                                    )}
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
                                isAiThinking={isAiThinking}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
