import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * In-memory rate limiter — tracks registration attempts per IP.
 * Resets after WINDOW_MS. For production, use Redis.
 */
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimiter.get(ip);
    if (!record || now > record.resetAt) {
        rateLimiter.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    record.count++;
    return record.count <= MAX_ATTEMPTS;
}

/** Structured error response following API design best practices */
function errorResponse(status: number, code: string, message: string, details?: { field: string; reason: string }[]) {
    return NextResponse.json({
        error: { code, message, ...(details ? { details } : {}) }
    }, { status });
}

export async function POST(req: Request) {
    try {
        // Rate limiting
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
        if (!checkRateLimit(ip)) {
            return errorResponse(429, 'RATE_LIMITED', 'Too many registration attempts. Try again in a minute.');
        }

        const body = await req.json();
        const { name, email, password } = body;

        // Field validation with detailed error objects
        const validationErrors: { field: string; reason: string }[] = [];

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            validationErrors.push({ field: 'name', reason: 'Name must be at least 2 characters.' });
        }
        if (name && name.trim().length > 100) {
            validationErrors.push({ field: 'name', reason: 'Name must be under 100 characters.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
            validationErrors.push({ field: 'email', reason: 'A valid email address is required.' });
        }

        if (!password || typeof password !== 'string') {
            validationErrors.push({ field: 'password', reason: 'Password is required.' });
        } else {
            if (password.length < 8) validationErrors.push({ field: 'password', reason: 'Must be at least 8 characters.' });
            if (!/[A-Z]/.test(password)) validationErrors.push({ field: 'password', reason: 'Must contain an uppercase letter.' });
            if (!/[a-z]/.test(password)) validationErrors.push({ field: 'password', reason: 'Must contain a lowercase letter.' });
            if (!/[0-9]/.test(password)) validationErrors.push({ field: 'password', reason: 'Must contain a number.' });
        }

        if (validationErrors.length > 0) {
            return errorResponse(422, 'VALIDATION_ERROR', 'Validation failed.', validationErrors);
        }

        // Check for duplicate email
        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (existing) {
            return errorResponse(409, 'CONFLICT', 'An account with this email already exists.');
        }

        // Hash password — 12 rounds is the recommended minimum
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password: hashedPassword,
            },
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
        }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    }
}
