import { Send } from 'lucide-react';

interface ChatInputProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export default function ChatInput({ value, onChange, onSubmit }: ChatInputProps) {
    return (
        <div className="p-4 border-t border-theme-light bg-white shrink-0">
            <form onSubmit={onSubmit} className="flex items-end gap-2">
                <div className="flex-1 bg-theme-lightest border border-theme-light rounded-xl focus-within:ring-2 focus-within:ring-theme-accent/50 focus-within:border-theme-accent transition-all">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full bg-transparent px-3 py-2.5 text-sm text-theme-dark placeholder:text-theme-dark/40 focus:outline-none"
                        maxLength={500}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!value.trim()}
                    className="p-2.5 rounded-xl bg-theme-accent hover:bg-theme-accent/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shrink-0 flex items-center justify-center"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
