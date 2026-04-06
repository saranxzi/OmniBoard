import { Link2, Copy, Check } from 'lucide-react';

interface InviteLinkProps {
    shareUrl: string;
    copied: boolean;
    onCopy: () => void;
}

export default function InviteLink({ shareUrl, copied, onCopy }: InviteLinkProps) {
    return (
        <div>
            <h3 className="text-xs font-bold text-theme-dark/40 uppercase tracking-widest mb-3">Share Link</h3>
            <div className="bg-theme-lightest rounded-xl p-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-theme-accent flex-shrink-0" />
                <span className="text-sm font-mono text-theme-dark/70 truncate flex-1">{shareUrl}</span>
                <button
                    onClick={onCopy}
                    className={`p-2 rounded-lg transition-all flex-shrink-0 ${copied
                        ? 'bg-green-100 text-green-600'
                        : 'bg-white hover:bg-theme-light text-theme-dark/60 hover:text-theme-dark'
                    }`}
                    title="Copy link"
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
