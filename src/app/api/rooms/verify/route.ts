import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Given a roomId and a userEmail, verify if the user has access.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { roomId, userEmail } = body;

        if (!roomId) {
            return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
        }

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { creator: true },
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found', allowed: false }, { status: 404 });
        }

        if (!room.isPrivate) {
            return NextResponse.json({ allowed: true, isPrivate: false }, { status: 200 });
        }

        if (!userEmail) {
            return NextResponse.json({ error: 'Log in to access private rooms', allowed: false }, { status: 401 });
        }

        if (room.creator?.email === userEmail) {
            return NextResponse.json({ allowed: true, isPrivate: true, role: 'creator' }, { status: 200 });
        }

        const user = await prisma.user.findUnique({
            where: { email: userEmail },
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

        return NextResponse.json({ allowed: true, isPrivate: true, role: 'guest' }, { status: 200 });

    } catch (error) {
        console.error('Room verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
