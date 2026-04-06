'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from './../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
    const router = useRouter();
    const setUser = useAuthStore(state => state.setUser);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error?.message || data.error || 'Login failed';
                throw new Error(errMsg);
            }
            setUser(data.user);
            router.push('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="w-full h-screen flex flex-col items-center justify-center bg-theme-lightest relative overflow-hidden">
            {/* Animated Background Blobs */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 -left-20 w-80 h-80 bg-theme-light rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
                <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-theme-accent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ animationDelay: '2s' }} />
            </div>

            <Link href="/" className="absolute top-8 left-8 z-20 flex items-center gap-2 text-theme-dark/60 hover:text-theme-dark transition-colors font-medium">
                <ArrowLeft className="w-4 h-4" />
                Back to Lobby
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 w-full max-w-md bg-white/70 backdrop-blur-xl border border-white p-8 rounded-[2rem] shadow-xl shadow-theme-dark/5"
            >
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-theme-light rounded-2xl text-theme-dark">
                        <LogIn className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-center text-theme-dark mb-2">Welcome Back</h1>
                <p className="text-center text-theme-dark/60 mb-6 font-medium">Sign in to your OmniBoard account</p>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm font-medium text-center"
                            role="alert"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form className="flex flex-col gap-4" onSubmit={handleLogin} noValidate>
                    <div>
                        <label className="block text-sm font-bold text-theme-dark mb-1.5" htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full bg-white border-2 border-theme-light rounded-xl px-4 py-3 text-theme-dark focus:outline-none focus:border-theme-accent focus:ring-2 focus:ring-theme-accent/20 transition-all placeholder:text-theme-dark/30"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-theme-dark mb-1.5" htmlFor="password">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full bg-white border-2 border-theme-light rounded-xl px-4 py-3 pr-12 text-theme-dark focus:outline-none focus:border-theme-accent focus:ring-2 focus:ring-theme-accent/20 transition-all placeholder:text-theme-dark/30"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-theme-dark/40 hover:text-theme-dark transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-theme-dark hover:bg-theme-dark/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-md transition-all hover:shadow-lg flex items-center justify-center"
                    >
                        {loading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        ) : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-theme-dark/60">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="text-theme-accent font-bold hover:underline">
                        Sign up
                    </Link>
                </p>
            </motion.div>
        </main>
    );
}
