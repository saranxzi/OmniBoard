import { Send, Sparkles } from 'lucide-react';

interface ChatInputProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isAiThinking?: boolean;
}

export default function ChatInput({ value, onChange, onSubmit, isAiThinking }: ChatInputProps) {
    const isAiMode = value.toLowerCase().startsWith('@ai');

    return (
        <div className="p-4 border-t border-theme-light bg-white shrink-0">
            {/* AI mode hint */}
            {isAiMode && value.length > 2 && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-purple-500 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                    <Sparkles className="w-3 h-3 animate-ai-pulse" />
                    AI mode — your message will be processed by OmniBoard AI
                </div>
            )}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
                <div className={`flex-1 rounded-xl transition-all ${
                    isAiMode 
                        ? 'bg-purple-50 border-2 border-purple-300 ring-2 ring-purple-200/50' 
                        : 'bg-theme-lightest border border-theme-light focus-within:ring-2 focus-within:ring-theme-accent/50 focus-within:border-theme-accent'
                }`}>
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={isAiThinking ? 'AI is thinking...' : 'Type a message... (@ai to ask AI)'}
                        className={`w-full bg-transparent px-3 py-2.5 text-sm placeholder:text-theme-dark/40 focus:outline-none ${
                            isAiMode ? 'text-purple-700' : 'text-theme-dark'
                        }`}
                        maxLength={500}
                        disabled={isAiThinking}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!value.trim() || isAiThinking}
                    className={`p-2.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shrink-0 flex items-center justify-center ${
                        isAiMode 
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700' 
                            : 'bg-theme-accent hover:bg-theme-accent/90'
                    }`}
                >
                    {isAiMode ? <Sparkles className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </button>
            </form>
        </div>
    );
}
