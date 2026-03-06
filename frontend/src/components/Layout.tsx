import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Navigation } from './ui/Navigation';
import { SnackbarProvider } from './ui/Snackbar';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettingsStore } from '../store/useSettingsStore';
import styles from './Layout.module.css';

/**
 * TravelMap — Root Layout
 * 
 * Provides the Navigation Rail/Bar and the main content area.
 */
export const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const uiTheme = useSettingsStore(s => s.uiTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = uiTheme;
    }, [uiTheme]);

    useEffect(() => {
        const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
            const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
            if (!isSearchShortcut) {
                return;
            }
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase() ?? '';
            if (target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                return;
            }

            event.preventDefault();
            navigate('/search?focus=1');
        };

        window.addEventListener('keydown', handleGlobalSearchShortcut);
        return () => {
            window.removeEventListener('keydown', handleGlobalSearchShortcut);
        };
    }, [navigate]);

    return (
        <div className={styles.layout}>
            <Navigation />

            <main className={styles.main}>
                <AnimatePresence>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className={styles.pageTransitionWrapper}
                    >
                        {/* Page content rendered here by React Router */}
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Global M3 toaster */}
            <SnackbarProvider />
        </div>
    );
};
