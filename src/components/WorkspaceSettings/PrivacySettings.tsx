import { Lock, Globe } from 'lucide-react';

interface PrivacySettingsProps {
    isPrivate: boolean;
    isCreator: boolean;
    isUpdatingPrivacy: boolean;
    onToggle: () => void;
}

export default function PrivacySettings({ isPrivate, isCreator, isUpdatingPrivacy, onToggle }: PrivacySettingsProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
                {isPrivate ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                        <Lock className="w-3 h-3" /> Private
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        <Globe className="w-3 h-3" /> Public
                    </span>
                )}
            </div>
            {isCreator && (
                <button
                    onClick={onToggle}
                    disabled={isUpdatingPrivacy}
                    className="text-xs font-bold text-theme-accent hover:text-theme-dark transition-colors text-right disabled:opacity-50"
                >
                    {isUpdatingPrivacy ? 'Updating...' : `Make ${isPrivate ? 'Public' : 'Private'}`}
                </button>
            )}
        </div>
    );
}
