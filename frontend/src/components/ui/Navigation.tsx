import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Map,
    Image,
    Images,
    Plane,
    Users,
    Settings,
    MapPin
} from 'lucide-react';
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
                <span className={styles.logoIcon}>
                    <MapPin size={24} color="var(--md-sys-color-primary)" />
                </span>
                <span className={styles.logoText}>TravelMap</span>
            </div>

            <div className={styles.destinations}>
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className={styles.activePill}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={styles.icon}><Map size={24} /></span>
                            <span className={styles.label}>Map</span>
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/albums"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className={styles.activePill}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={styles.icon}><Images size={24} /></span>
                            <span className={styles.label}>Albums</span>
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/photos"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className={styles.activePill}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={styles.icon}><Image size={24} /></span>
                            <span className={styles.label}>Photos</span>
                        </>
                    )}
                </NavLink>

                <div className={styles.divider} />

                <NavLink
                    to="/trips"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className={styles.activePill}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={styles.icon}><Plane size={24} /></span>
                            <span className={styles.label}>Trips</span>
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/people"
                    className={({ isActive }) =>
                        isActive ? `${styles.item} ${styles.active}` : styles.item
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className={styles.activePill}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className={styles.icon}><Users size={24} /></span>
                            <span className={styles.label}>People</span>
                        </>
                    )}
                </NavLink>
            </div>

            <div className={styles.spacer} />

            <NavLink
                to="/settings"
                className={({ isActive }) =>
                    isActive ? `${styles.item} ${styles.active}` : styles.item
                }
            >
                {({ isActive }) => (
                    <>
                        {isActive && (
                            <motion.div
                                layoutId="navPill"
                                className={styles.activePill}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <span className={styles.icon}><Settings size={24} /></span>
                        <span className={styles.label}>Settings</span>
                    </>
                )}
            </NavLink>
        </nav>
    );
};
