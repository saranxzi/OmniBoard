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
            ? await prisma.room.findUnique({ where: { code: roomId.toUpperCase() }, include: { creator: true, accessLists: { include: { user: true } } } })
            : await prisma.room.findUnique({ where: { id: roomId }, include: { creator: true, accessLists: { include: { user: true } } } });

        if (!room) {
            return NextResponse.json({ error: 'Room not found', allowed: false }, { status: 404 });
        }

        // --- Determine the user's role ---
        let role: 'leader' | 'editor' | 'viewer' = 'editor';
        let user = null;

        if (userEmail) {
            user = await prisma.user.findUnique({
                where: { email: userEmail.toLowerCase().trim() },
            });
        }

        // Check if this user is the creator
        const isCreator = user && room.creatorId && room.creatorId === user.id;

        if (isCreator) {
            // Ensure creator has a RoomAccess record so socket and PR queries are happy
            await prisma.roomAccess.upsert({
                where: { roomId_userId: { roomId: room.id, userId: user!.id } },
                update: { role: 'leader' },
                create: { roomId: room.id, userId: user!.id, role: 'leader' }
            });
            role = 'leader';
        } else if (user) {
            // Check RoomAccess for explicit role
            const access = await prisma.roomAccess.findUnique({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: user.id,
                    }
                }
            });

            if (access) {
                role = access.role as 'leader' | 'editor' | 'viewer';
            } else {
                // No access record — auto-create one
                // If room has no creator, make this user the leader
                if (!room.creatorId) {
                    // First authenticated user becomes leader
                    await prisma.room.update({
                        where: { id: room.id },
                        data: { creatorId: user.id }
                    });
                    await prisma.roomAccess.upsert({
                        where: { roomId_userId: { roomId: room.id, userId: user.id } },
                        update: { role: 'leader' },
                        create: { roomId: room.id, userId: user.id, role: 'leader' }
                    });
                    role = 'leader';
                } else {
                    // Room has a creator, this user joins as editor
                    await prisma.roomAccess.upsert({
                        where: { roomId_userId: { roomId: room.id, userId: user.id } },
                        update: { role: 'editor' },
                        create: { roomId: room.id, userId: user.id, role: 'editor' }
                    });
                    role = 'editor';
                }
            }
        } else if (!room.creatorId && !userEmail) {
            // Guest user joining a room with no creator — they get editor role
            // (They can't become leader without an account)
            role = 'editor';
        }

        // --- Access control for private rooms ---
        if (room.isPrivate) {
            if (!userEmail) {
                return NextResponse.json({ error: 'Log in to access private rooms', allowed: false }, { status: 401 });
            }

            if (!user) {
                return NextResponse.json({ error: 'Access Denied', allowed: false }, { status: 403 });
            }

            // Creator always has access
            if (isCreator) {
                return NextResponse.json({
                    allowed: true, isPrivate: true, role, roomId: room.id, code: room.code
                }, { status: 200 });
            }

            // Check access list
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

            return NextResponse.json({
                allowed: true, isPrivate: true, role, roomId: room.id, code: room.code
            }, { status: 200 });
        }

        // Public rooms — always allowed
        return NextResponse.json({
            allowed: true, isPrivate: false, role, roomId: room.id, code: room.code
        }, { status: 200 });
    } catch (error: any) {
        console.error('Room verification error:', error?.message || error);
        return NextResponse.json({ error: 'Internal server error', allowed: false, message: error?.message }, { status: 500 });
    }
}
