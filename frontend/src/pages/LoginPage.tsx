import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { showSnackbar } from '../components/ui/Snackbar';
import { useAuthStore } from '../store/useAuthStore';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
    const navigate = useNavigate();
    const login = useAuthStore(s => s.login);
    const register = useAuthStore(s => s.register);

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim() || (mode === 'register' && !displayName.trim())) {
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'login') {
                await login(username.trim(), password);
                showSnackbar('Welcome back');
            } else {
                await register(username.trim(), displayName.trim(), password);
                showSnackbar('Account created');
            }
            navigate('/', { replace: true });
        } catch (err: any) {
            showSnackbar(err?.message || 'Authentication failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <h1 className={styles.title}>TravelMap</h1>
                <p className={styles.subtitle}>{mode === 'login' ? 'Sign in to continue your journey.' : 'Create your account to start mapping trips.'}</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Input
                        label="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        autoFocus
                        fullWidth
                    />

                    <AnimatePresence mode="wait">
                        {mode === 'register' && (
                            <motion.div
                                key="display-name"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Input
                                    label="Display Name"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    required={mode === 'register'}
                                    fullWidth
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        fullWidth
                    />

                    <Button type="submit" disabled={isSubmitting} fullWidth>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </Button>
                </form>

                <button
                    className={styles.switchMode}
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    disabled={isSubmitting}
                >
                    {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
                </button>
            </motion.div>
        </div>
    );
};
