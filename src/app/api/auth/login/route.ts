import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * In-memory rate limiter for login attempts.
 * For production, use Redis with sliding window.
 */
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
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

/** Structured error response */
function errorResponse(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
    try {
        // Rate limiting
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
        if (!checkRateLimit(ip)) {
            return errorResponse(429, 'RATE_LIMITED', 'Too many login attempts. Try again in a minute.');
        }

        const body = await req.json();
        const { email, password } = body;

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return errorResponse(400, 'BAD_REQUEST', 'Email and password are required.');
        }

        // Look up user — case-insensitive
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        // Generic error to prevent email enumeration
        if (!user) {
            // Constant-time comparison to prevent timing attacks
            await bcrypt.hash('dummy-password', 12);
            return errorResponse(401, 'UNAUTHORIZED', 'Invalid credentials.');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return errorResponse(401, 'UNAUTHORIZED', 'Invalid credentials.');
        }

        // Never return password hash
        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email },
        });

    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    }
}
