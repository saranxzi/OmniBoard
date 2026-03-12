import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { roomId, userEmail } = body;

        if (!roomId) {
            return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
        }

        // Support both UUID and 6-char short code
        const isShortCode = roomId.length <= 6;
        const room = isShortCode
            ? await prisma.room.findUnique({ where: { code: roomId.toUpperCase() }, include: { creator: true } })
            : await prisma.room.findUnique({ where: { id: roomId }, include: { creator: true } });

        if (!room) {
            return NextResponse.json({ error: 'Room not found', allowed: false }, { status: 404 });
        }

        // Public rooms — always allowed
        if (!room.isPrivate) {
            return NextResponse.json({ allowed: true, isPrivate: false, roomId: room.id, code: room.code }, { status: 200 });
        }

        // Private rooms require authentication
        if (!userEmail) {
            return NextResponse.json({ error: 'Log in to access private rooms', allowed: false }, { status: 401 });
        }

        // Creator always has access
        if (room.creator?.email === userEmail.toLowerCase().trim()) {
            return NextResponse.json({ allowed: true, isPrivate: true, role: 'creator', roomId: room.id, code: room.code }, { status: 200 });
        }

        // Check access list
        const user = await prisma.user.findUnique({
            where: { email: userEmail.toLowerCase().trim() },
        });

        if (!user) {
            return NextResponse.json({ error: 'Access Denied', allowed: false }, { status: 403 });
        }

        const access = await prisma.roomAccess.findUnique({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: user.id,
                }
            }
        });

        if (!access) {
            return NextResponse.json({ error: 'Access Denied', allowed: false }, { status: 403 });
        }

        return NextResponse.json({ allowed: true, isPrivate: true, role: 'guest', roomId: room.id, code: room.code }, { status: 200 });
    } catch (error) {
        console.error('Room verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
