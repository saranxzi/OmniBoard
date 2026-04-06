'use client';

import { useEffect } from 'react';
import { useBoardStore } from '@/store/useBoardStore';

/**
 * DarkModeProvider — Syncs the Zustand dark mode state with the `<html>` class attribute.
 * Adding/removing the 'dark' class triggers Tailwind's darkMode: 'class' strategy.
 */
export function DarkModeProvider({ children }: { children: React.ReactNode }) {
    const isDarkMode = useBoardStore((state) => state.isDarkMode);

    useEffect(() => {
        const html = document.documentElement;
        if (isDarkMode) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
    }, [isDarkMode]);

    return <>{children}</>;
}
