'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="w-full h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#121212] relative overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/40 via-slate-50/20 to-transparent dark:from-indigo-900/20 dark:via-[#121212]/20 dark:to-transparent pointer-events-none" />

            <Link href="/" className="absolute top-8 left-8 z-20 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium">
                <ArrowLeft className="w-4 h-4" />
                Back to Lobby
            </Link>

            <div className="relative z-10 w-full max-w-md bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
                        <UserPlus className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">Create an Account</h1>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-6 font-medium">Join OmniBoard to save your workspaces</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                <form className="flex flex-col gap-4" onSubmit={handleRegister}>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5" htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400"
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5" htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 rounded-xl font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] flex justify-center items-center">
                        {loading ? 'Signing up...' : 'Sign Up'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                        Log in
                    </Link>
                </p>
            </div>
        </main>
    );
}
