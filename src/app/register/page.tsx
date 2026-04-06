'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, ArrowLeft, Eye, EyeOff, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Password strength rules */
const PASSWORD_RULES = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
];

function getStrength(password: string): number {
    return PASSWORD_RULES.filter(r => r.test(password)).length;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const strength = useMemo(() => getStrength(password), [password]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (strength < 4) {
            setError('Please meet all password requirements.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error?.message || data.error || 'Registration failed';
                throw new Error(errMsg);
            }
            router.push('/login');
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
                        <UserPlus className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-center text-theme-dark mb-2">Create an Account</h1>
                <p className="text-center text-theme-dark/60 mb-6 font-medium">Join OmniBoard to save your workspaces</p>

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

                <form className="flex flex-col gap-4" onSubmit={handleRegister} noValidate>
                    <div>
                        <label className="block text-sm font-bold text-theme-dark mb-1.5" htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoComplete="name"
                            className="w-full bg-white border-2 border-theme-light rounded-xl px-4 py-3 text-theme-dark focus:outline-none focus:border-theme-accent focus:ring-2 focus:ring-theme-accent/20 transition-all placeholder:text-theme-dark/30"
                            placeholder="John Doe"
                        />
                    </div>
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
                                autoComplete="new-password"
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

                        {/* Password Strength Indicator */}
                        {password.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-3"
                            >
                                {/* Strength bar */}
                                <div className="flex gap-1 mb-2">
                                    {[1, 2, 3, 4].map(level => (
                                        <div
                                            key={level}
                                            className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                            style={{
                                                backgroundColor: strength >= level ? STRENGTH_COLORS[strength] : '#DCD6F7',
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span
                                        className="text-xs font-bold transition-colors"
                                        style={{ color: STRENGTH_COLORS[strength] }}
                                    >
                                        {STRENGTH_LABELS[strength]}
                                    </span>
                                </div>

                                {/* Rules checklist */}
                                <div className="flex flex-col gap-1">
                                    {PASSWORD_RULES.map(rule => {
                                        const passes = rule.test(password);
                                        return (
                                            <div key={rule.label} className="flex items-center gap-2">
                                                {passes ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <X className="w-3.5 h-3.5 text-theme-dark/30" />
                                                )}
                                                <span className={`text-xs ${passes ? 'text-green-600 font-medium' : 'text-theme-dark/40'}`}>
                                                    {rule.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || strength < 4}
                        className="w-full mt-4 bg-theme-dark hover:bg-theme-dark/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-md transition-all hover:shadow-lg flex justify-center items-center"
                    >
                        {loading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        ) : 'Sign Up'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-theme-dark/60">
                    Already have an account?{' '}
                    <Link href="/login" className="text-theme-accent font-bold hover:underline">
                        Log in
                    </Link>
                </p>
            </motion.div>
        </main>
    );
}
