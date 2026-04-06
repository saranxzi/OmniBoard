'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, MousePointer2, Square, Type } from 'lucide-react';

/**
 * EmptyCanvas — A beautiful onboarding hint shown when the canvas is empty.
 * Guides new users with keyboard shortcuts and subtle animations.
 * Fades out as soon as the first element is drawn.
 */
export default function EmptyCanvas() {
    const elements = useBoardStore((state) => state.elements);
    const isEmpty = elements.length === 0;

    return (
        <AnimatePresence>
            {isEmpty && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="fixed inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                    <div className="text-center max-w-sm px-6">
                        {/* Animated icon group */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2, delay: 0 }}
                                className="p-3 rounded-2xl bg-theme-light/50 text-theme-accent"
                            >
                                <Pencil className="w-6 h-6" />
                            </motion.div>
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                                className="p-3 rounded-2xl bg-theme-light/50 text-theme-accent"
                            >
                                <Square className="w-6 h-6" />
                            </motion.div>
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2, delay: 0.6 }}
                                className="p-3 rounded-2xl bg-theme-light/50 text-theme-accent"
                            >
                                <Type className="w-6 h-6" />
                            </motion.div>
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ repeat: Infinity, duration: 2, delay: 0.9 }}
                                className="p-3 rounded-2xl bg-theme-light/50 text-theme-accent"
                            >
                                <MousePointer2 className="w-6 h-6" />
                            </motion.div>
                        </div>

                        <h3 className="text-xl font-bold text-theme-dark/60 mb-2">
                            Your canvas is empty
                        </h3>
                        <p className="text-sm text-theme-dark/40 leading-relaxed">
                            Start drawing with the <kbd className="px-1.5 py-0.5 bg-theme-light/60 rounded font-mono text-xs text-theme-dark/70">P</kbd> pencil tool, 
                            draw shapes with <kbd className="px-1.5 py-0.5 bg-theme-light/60 rounded font-mono text-xs text-theme-dark/70">R</kbd>, 
                            or drag an image onto the canvas.
                        </p>

                        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-theme-dark/30">
                            <span>Scroll to pan</span>
                            <span>•</span>
                            <span>Ctrl+Scroll to zoom</span>
                            <span>•</span>
                            <span>Ctrl+Z to undo</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
