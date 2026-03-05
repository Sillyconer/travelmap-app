import { Outlet } from 'react-router-dom';
import { Navigation } from './ui/Navigation';
import { SnackbarProvider } from './ui/Snackbar';
import styles from './Layout.module.css';

/**
 * TravelMap — Root Layout
 * 
 * Provides the Navigation Rail/Bar and the main content area.
 */
export const Layout = () => {
    return (
        <div className={styles.layout}>
            <Navigation />

            <main className={styles.main}>
                {/* Page content rendered here by React Router */}
                <Outlet />
            </main>

            {/* Global M3 toaster */}
            <SnackbarProvider />
        </div>
    );
};
