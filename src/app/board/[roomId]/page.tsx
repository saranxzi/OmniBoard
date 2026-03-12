import dynamic from 'next/dynamic';
import Toolbar from '@/components/Toolbar';
import UndoRedo from '@/components/UndoRedo';
import ZoomControls from '@/components/ZoomControls';
import ExportImage from '@/components/ExportImage';

const Board = dynamic(() => import('@/components/Board'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium tracking-wide">
            Initializing Canvas...
        </div>
    )
});

export default function BoardPage() {
    return (
        <main className="w-full h-screen overflow-hidden m-0 p-0 relative bg-[#f8fafc]">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50/20 to-transparent pointer-events-none" />

            <div className="relative z-10 w-full h-full">
                <UndoRedo />
                <ZoomControls />
                <ExportImage />
                <Board />
                <Toolbar />
            </div>
        </main>
    );
}
