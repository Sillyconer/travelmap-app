import { NavLink } from 'react-router-dom';
import styles from './Navigation.module.css';

/**
 * TravelMap — Main Navigation
 * 
 * Implements the M3 Navigation Rail for desktop (sidebar) 
 * and Navigation Bar for mobile (bottom bar).
 */

export const Navigation = () => {
    return (
        <nav className={styles.nav}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}>📍</span>
                <span className={styles.logoText}>TravelMap</span>
            </div>

            <div className={styles.destinations}>
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    <span className={styles.icon}>🗺️</span>
                    <span className={styles.label}>Map</span>
                </NavLink>

                <NavLink
                    to="/albums"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    <span className={styles.icon}>🏞️</span>
                    <span className={styles.label}>Albums</span>
                </NavLink>

                <NavLink
                    to="/photos"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    <span className={styles.icon}>📷</span>
                    <span className={styles.label}>Photos</span>
                </NavLink>

                <div className={styles.divider} />

                <NavLink
                    to="/trips"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    <span className={styles.icon}>✈️</span>
                    <span className={styles.label}>Trips</span>
                </NavLink>

                <NavLink
                    to="/people"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    <span className={styles.icon}>👥</span>
                    <span className={styles.label}>People</span>
                </NavLink>
            </div>

            <div className={styles.spacer} />

            <NavLink
                to="/settings"
                className={({ isActive }) =>
                    isActive ? `${styles.item} ${styles.active}` : styles.item
                }
            >
                <span className={styles.icon}>⚙️</span>
                <span className={styles.label}>Settings</span>
            </NavLink>
        </nav>
    );
};
