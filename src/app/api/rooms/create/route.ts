import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Generate a random 6-character alphanumeric code (uppercase + digits)
function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I/O/0/1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Generate a unique code with collision retry
async function generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateCode();
        const existing = await prisma.room.findUnique({ where: { code } });
        if (!existing) return code;
    }
    throw new Error('Failed to generate unique room code');
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { isPrivate, creatorEmail, creatorName, allowedEmails } = body;

        let creatorId = null;

        if (creatorEmail && creatorName) {
            const creator = await prisma.user.upsert({
                where: { email: creatorEmail.toLowerCase().trim() },
                update: { name: creatorName.trim() },
                create: {
                    email: creatorEmail.toLowerCase().trim(),
                    name: creatorName.trim(),
                    password: '', // Creator already exists via register flow
                },
            });
            creatorId = creator.id;
        }

        const code = await generateUniqueCode();

        const room = await prisma.room.create({
            data: {
                code,
                isPrivate: isPrivate ?? false,
                creatorId,
            },
        });

        // Add access lists for private rooms
        if (isPrivate && Array.isArray(allowedEmails) && allowedEmails.length > 0) {
            const users = await Promise.all(
                allowedEmails.map(async (email: string) => {
                    return prisma.user.upsert({
                        where: { email: email.toLowerCase().trim() },
                        update: {},
                        create: {
                            email: email.toLowerCase().trim(),
                            name: email.split('@')[0],
                            password: '',
                        },
                    });
                })
            );

            await prisma.roomAccess.createMany({
                data: users.map((user: { id: string }) => ({
                    roomId: room.id,
                    userId: user.id,
                })),
                skipDuplicates: true,
            });
        }

        return NextResponse.json({ roomId: room.id, code: room.code }, { status: 201 });
    } catch (error) {
        console.error('Room creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
