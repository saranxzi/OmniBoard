import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'users.json');

function getUsers() {
    if (!fs.existsSync(DB_PATH)) {
        return [];
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const users = getUsers();
        const user = users.find((u: any) => u.email === email && u.password === password);

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        return NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
