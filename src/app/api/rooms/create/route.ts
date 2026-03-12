import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { isPrivate, creatorEmail, creatorName, allowedEmails } = body;

        let creatorId = null;

        if (creatorEmail && creatorName) {
            // Upsert the User who created this room
            const creator = await prisma.user.upsert({
                where: { email: creatorEmail },
                update: { name: creatorName },
                create: { email: creatorEmail, name: creatorName },
            });
            creatorId = creator.id;
        }

        // Create the room
        const room = await prisma.room.create({
            data: {
                isPrivate: isPrivate ?? false,
                creatorId: creatorId,
            },
        });

        // Add access lists for private rooms
        if (isPrivate && Array.isArray(allowedEmails) && allowedEmails.length > 0) {
            const users = await Promise.all(
                allowedEmails.map(async (email: string) => {
                    return prisma.user.upsert({
                        where: { email },
                        update: {},
                        create: { email, name: email.split('@')[0] }, 
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

        return NextResponse.json({ roomId: room.id }, { status: 201 });
    } catch (error) {
        console.error('Room creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
