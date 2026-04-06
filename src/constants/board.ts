import React from 'react';
import {
    MousePointer2, Pencil, Square, Circle, Diamond, Minus, MoveRight,
    Type, Eraser, Star, StickyNote, ImagePlus, GitBranch
} from 'lucide-react';
import { Tool } from '@/types';

export const TOOLS: { type: Tool; icon: React.ElementType; label: string }[] = [
    { type: 'select', icon: MousePointer2, label: 'Select (V)' },
    { type: 'pencil', icon: Pencil, label: 'Pencil (P)' },
    { type: 'line', icon: Minus, label: 'Line (L)' },
    { type: 'arrow', icon: MoveRight, label: 'Arrow (A)' },
    { type: 'connector', icon: GitBranch, label: 'Connector (C)' },
    { type: 'rectangle', icon: Square, label: 'Rectangle (R)' },
    { type: 'ellipse', icon: Circle, label: 'Ellipse (O)' },
    { type: 'diamond', icon: Diamond, label: 'Diamond (D)' },
    { type: 'star', icon: Star, label: 'Star (S)' },
    { type: 'sticky', icon: StickyNote, label: 'Sticky (N)' },
    { type: 'image', icon: ImagePlus, label: 'Image (I)' },
    { type: 'text', icon: Type, label: 'Text (T)' },
    { type: 'eraser', icon: Eraser, label: 'Eraser (E)' },
];

export const COLORS = [
    { name: 'Dark', value: '#424874' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Purple', value: '#a855f7' },
];

export const STROKE_WIDTHS = [
    { name: 'Thin', value: 2 },
    { name: 'Medium', value: 4 },
    { name: 'Bold', value: 8 },
];

export const STICKY_COLORS = [
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Orange', value: '#fed7aa' },
    { name: 'Purple', value: '#e9d5ff' },
];

