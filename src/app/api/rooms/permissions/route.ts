import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/rooms/permissions — Update a user's role in a room
 * Body: { roomCode, targetUserEmail, newRole, requesterEmail }
 */
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { roomCode, targetUserEmail, newRole, requesterEmail } = body;

        if (!roomCode || !targetUserEmail || !newRole || !requesterEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['editor', 'viewer'].includes(newRole)) {
            return NextResponse.json({ error: 'Invalid role. Must be "editor" or "viewer"' }, { status: 400 });
        }

        // Find room
        const room = await prisma.room.findUnique({
            where: { code: roomCode },
            include: { creator: true }
        });
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Verify requester is the leader
        const requester = await prisma.user.findUnique({
            where: { email: requesterEmail.toLowerCase().trim() }
        });
        if (!requester || room.creatorId !== requester.id) {
            return NextResponse.json({ error: 'Only the room leader can change roles' }, { status: 403 });
        }

        // Find target user
        const targetUser = await prisma.user.findUnique({
            where: { email: targetUserEmail.toLowerCase().trim() }
        });
        if (!targetUser) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        // Can't change own role
        if (targetUser.id === requester.id) {
            return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
        }

        // Update or create access record
        await prisma.roomAccess.upsert({
            where: {
                roomId_userId: {
                    roomId: room.id,
                    userId: targetUser.id,
                }
            },
            create: {
                roomId: room.id,
                userId: targetUser.id,
                role: newRole,
            },
            update: { role: newRole },
        });

        return NextResponse.json({ success: true, newRole }, { status: 200 });
    } catch (error) {
        console.error('Permission update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/rooms/permissions — Transfer leadership
 * Body: { roomCode, targetUserEmail, requesterEmail, action: 'transfer-leadership' }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { roomCode, targetUserEmail, requesterEmail, action } = body;

        if (action !== 'transfer-leadership') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (!roomCode || !targetUserEmail || !requesterEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const room = await prisma.room.findUnique({
            where: { code: roomCode },
            include: { creator: true }
        });
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        const requester = await prisma.user.findUnique({
            where: { email: requesterEmail.toLowerCase().trim() }
        });
        if (!requester || room.creatorId !== requester.id) {
            return NextResponse.json({ error: 'Only the room leader can transfer leadership' }, { status: 403 });
        }

        const targetUser = await prisma.user.findUnique({
            where: { email: targetUserEmail.toLowerCase().trim() }
        });
        if (!targetUser) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        if (targetUser.id === requester.id) {
            return NextResponse.json({ error: 'Cannot transfer leadership to yourself' }, { status: 400 });
        }

        // Transfer: update room creator + access records in a transaction
        await prisma.$transaction([
            // Set new creator
            prisma.room.update({
                where: { id: room.id },
                data: { creatorId: targetUser.id }
            }),
            // Set new leader access
            prisma.roomAccess.upsert({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: targetUser.id,
                    }
                },
                create: {
                    roomId: room.id,
                    userId: targetUser.id,
                    role: 'leader',
                },
                update: { role: 'leader' },
            }),
            // Demote old leader to editor
            prisma.roomAccess.upsert({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: requester.id,
                    }
                },
                create: {
                    roomId: room.id,
                    userId: requester.id,
                    role: 'editor',
                },
                update: { role: 'editor' },
            }),
        ]);

        return NextResponse.json({ success: true, newLeaderEmail: targetUserEmail }, { status: 200 });
    } catch (error) {
        console.error('Leadership transfer error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
