const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
        await prisma.$connect();
        console.log('Connected successfully!');
        const rooms = await prisma.room.findMany({ take: 1 });
        console.log('Rooms:', rooms);
    } catch (e) {
        console.error('ERROR CONNECTING:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
