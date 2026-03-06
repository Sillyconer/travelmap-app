import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Map,
    Image,
    Images,
    Plane,
    Users,
    UserCircle2,
    Bell,
    Search,
    Settings,
    MapPin
} from 'lucide-react';
import * as api from '../../api/client';
import styles from './Navigation.module.css';

/**
 * TravelMap — Main Navigation
 * 
 * Implements the M3 Navigation Rail for desktop (sidebar) 
 * and Navigation Bar for mobile (bottom bar).
 */

export const Navigation = () => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const { count } = await api.getUnreadNotificationCount();
                if (active) {
                    setUnreadCount(count);
                }
            } catch {
                if (active) {
                    setUnreadCount(0);
                }
            }
        };
        load();
        const timer = window.setInterval(load, 30000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

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

                <NavLink
                    to="/search"
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
                            <span className={styles.icon}><Search size={24} /></span>
                            <span className={styles.label}>Search</span>
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/notifications"
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
                            <span className={styles.iconWrap}>
                                <span className={styles.icon}><Bell size={24} /></span>
                                {unreadCount > 0 && <span className={styles.badge}>{Math.min(unreadCount, 99)}</span>}
                            </span>
                            <span className={styles.label}>Notifications</span>
                        </>
                    )}
                </NavLink>

                <NavLink
                    to="/profiles"
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
                            <span className={styles.icon}><UserCircle2 size={24} /></span>
                            <span className={styles.label}>Profiles</span>
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
