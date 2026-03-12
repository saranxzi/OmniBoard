import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'users.json');

function getUsers() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([]));
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
}

function saveUsers(users: any) {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = body;

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const users = getUsers();
        if (users.find((u: any) => u.email === email)) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        const newUser = { name, email, password };
        users.push(newUser);
        saveUsers(users);

        return NextResponse.json({ success: true, user: { name, email } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
