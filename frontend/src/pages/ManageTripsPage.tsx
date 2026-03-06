import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useTrips } from '../features/trips/useTrips';
import { useNavigate } from 'react-router-dom';
import { MapPin, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './ManageTripsPage.module.css';

export const ManageTripsPage = () => {
    const { trips, isLoading, createTrip, updateTrip, deleteTrip } = useTrips();
    const navigate = useNavigate();

    // State for Create Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#E74C3C');
    const [newBudget, setNewBudget] = useState('0');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for Delete Confirmation Modal
    const [tripToDelete, setTripToDelete] = useState<number | null>(null);

    // State for Edit Modal
    const [editingTrip, setEditingTrip] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#E74C3C');
    const [editBudget, setEditBudget] = useState('0');

    const openEditModal = (trip: (typeof trips)[number]) => {
        setEditingTrip(trip.id);
        setEditName(trip.name);
        setEditColor(trip.color);
        setEditBudget((trip.budget ?? 0).toString());
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTrip || !editName.trim()) return;

        setIsSubmitting(true);
        try {
            await updateTrip(editingTrip, {
                name: editName.trim(),
                color: editColor,
                budget: parseFloat(editBudget) || 0,
            });
            setEditingTrip(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await createTrip({
                name: newName.trim(),
                color: newColor,
                budget: parseFloat(newBudget) || 0,
                description: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            });
            setIsCreateOpen(false);
            setNewName('');
            setNewColor('#E74C3C');
            setNewBudget('0');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!tripToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteTrip(tripToDelete);
            setTripToDelete(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Manage Trips</h1>
                    <p className={styles.subtitle}>Overview of all your recorded journeys.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>+ Add Trip</Button>
            </header>

            {isLoading && trips.length === 0 ? (
                <div className={styles.loading}>Loading trips...</div>
            ) : (
                <motion.div
                    className={styles.grid}
                    variants={{
                        hidden: { opacity: 0 },
                        show: {
                            opacity: 1,
                            transition: { staggerChildren: 0.05 }
                        }
                    }}
                    initial="hidden"
                    animate="show"
                >
                    {trips.map(trip => (
                        <motion.div
                            key={trip.id}
                            layoutId={`trip-card-${trip.id}`}
                            variants={{
                                hidden: { opacity: 0, y: 20, scale: 0.95 },
                                show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
                            }}
                        >
                            <Card className={styles.tripCard} interactive>
                                <div
                                    className={styles.colorStrip}
                                    style={{ backgroundColor: trip.color }}
                                />
                                <div className={styles.cardContent}>
                                    <div
                                        style={{ cursor: 'pointer', flex: 1 }}
                                        onClick={() => navigate(`/trips/${trip.id}`)}
                                    >
                                        <h3 className={styles.tripName}>{trip.name}</h3>
                                        <div className={styles.stats}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /> {trip.places?.length || 0} places</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={16} /> {trip.photos?.length || 0} photos</span>
                                        </div>
                                    </div>
                                    <div className={styles.actions}>
                                        <Button variant="outlined" size="sm" onClick={() => openEditModal(trip)}>Edit</Button>
                                        <Button
                                            variant="text"
                                            size="sm"
                                            onClick={() => setTripToDelete(trip.id)}
                                            style={{ color: 'var(--md-sys-color-error)' }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                    {trips.length === 0 && !isLoading && (
                        <div className={styles.emptyState}>
                            <p>No trips yet. Create your first one to get started!</p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => !isSubmitting && setIsCreateOpen(false)}
                title="Create New Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>
                            Create Trip
                        </Button>
                    </>
                }
            >
                <form id="create-trip-form" onSubmit={handleCreate} className={styles.form}>
                    <Input
                        label="Trip Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Japan 2024"
                        autoFocus
                        required
                        fullWidth
                    />
                    <Input
                        label="Budget (Optional)"
                        type="number"
                        value={newBudget}
                        onChange={e => setNewBudget(e.target.value)}
                        placeholder="2000"
                        fullWidth
                    />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Theme Color</label>
                        <div className={styles.colorRow}>
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewColor(e.target.value)}
                                className={styles.colorInput}
                            />
                            <span className={styles.colorHex}>{newColor.toUpperCase()}</span>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={tripToDelete !== null}
                onClose={() => !isSubmitting && setTripToDelete(null)}
                title="Delete Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setTripToDelete(null)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDelete}
                            disabled={isSubmitting}
                            style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}
                        >
                            Delete Permanently
                        </Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to delete <strong>{trips.find(t => t.id === tripToDelete)?.name}</strong>?
                </p>
                <p style={{ color: 'var(--md-sys-color-error)' }}>
                    This will permanently delete all associated places and photos. This action cannot be undone.
                </p>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={editingTrip !== null}
                onClose={() => !isSubmitting && setEditingTrip(null)}
                title="Edit Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setEditingTrip(null)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={!editName.trim() || isSubmitting}>
                            Save Changes
                        </Button>
                    </>
                }
            >
                <form id="edit-trip-form" onSubmit={handleEdit} className={styles.form}>
                    <Input
                        label="Trip Name"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="e.g. Japan 2024"
                        autoFocus
                        required
                        fullWidth
                    />
                    <Input
                        label="Budget (Optional)"
                        type="number"
                        value={editBudget}
                        onChange={e => setEditBudget(e.target.value)}
                        placeholder="2000"
                        fullWidth
                    />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Theme Color</label>
                        <div className={styles.colorRow}>
                            <input
                                type="color"
                                value={editColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditColor(e.target.value)}
                                className={styles.colorInput}
                            />
                            <span className={styles.colorHex}>{editColor.toUpperCase()}</span>
                        </div>
                    </div>
                </form>
            </Modal>

        </div>
    );
};
