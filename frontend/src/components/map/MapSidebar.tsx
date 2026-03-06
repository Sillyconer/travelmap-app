import { useTrips } from '../../features/trips/useTrips';
import { usePersons } from '../../features/persons/usePersons';
import { useMapFilters } from '../../features/map/useMapFilters';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import styles from './MapSidebar.module.css';

interface MapSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MapSidebar = ({ isOpen, onClose }: MapSidebarProps) => {
    const { trips } = useTrips();
    const { persons } = usePersons();
    const {
        visibleTripIds,
        activePersonIds,
        toggleTripVisibility,
        togglePersonFilter
    } = useMapFilters();

    // First filter trips by active persons (if any persons selected)
    // If no persons selected, show all trips
    // A trip is visible under person filters if ANY of its personIds matches ANY activePersonId
    const tripsAfterPersonFilter = activePersonIds.size > 0
        ? trips.filter(t => t.personIds?.some(pid => activePersonIds.has(pid)))
        : trips;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    className={styles.sidebar}
                    initial={{ x: 350, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 350, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    <div className={styles.header}>
                        <h2 className={styles.title}>Map Filters</h2>
                        <Button variant="text" size="sm" onClick={onClose} style={{ padding: 0 }}>
                            <X size={20} />
                        </Button>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.subtitle}>People</h3>
                        <div className={styles.chipGroup}>
                            {persons.map(person => {
                                const isActive = activePersonIds.has(person.id);
                                return (
                                    <button
                                        key={person.id}
                                        className={`${styles.chip} ${isActive ? styles.activeChip : ''}`}
                                        style={{
                                            borderColor: isActive ? person.color : 'var(--md-sys-color-outline)',
                                            color: isActive ? person.color : 'var(--md-sys-color-on-surface-variant)',
                                            backgroundColor: isActive ? `${person.color}20` : 'transparent'
                                        }}
                                        onClick={() => togglePersonFilter(person.id)}
                                    >
                                        {person.name}
                                    </button>
                                );
                            })}
                            {persons.length === 0 && <p className={styles.emptyText}>No people added.</p>}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.subtitle}>Trips</h3>
                        <ul className={styles.tripList}>
                            {tripsAfterPersonFilter.map(trip => {
                                const isVisible = visibleTripIds.has(trip.id);
                                return (
                                    <li key={trip.id} className={styles.tripItem}>
                                        <label className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={isVisible}
                                                onChange={() => toggleTripVisibility(trip.id)}
                                                className={styles.checkbox}
                                            />
                                            <span
                                                className={styles.colorDot}
                                                style={{ backgroundColor: trip.color }}
                                            />
                                            <span className={styles.tripName}>{trip.name}</span>
                                        </label>
                                    </li>
                                );
                            })}
                            {tripsAfterPersonFilter.length === 0 && <p className={styles.emptyText}>No matching trips.</p>}
                        </ul>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};
