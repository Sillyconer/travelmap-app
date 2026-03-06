import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useTrips } from '../features/trips/useTrips';
import { useNavigate } from 'react-router-dom';
import { MapPin, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import * as api from '../api/client';
import { showSnackbar } from '../components/ui/Snackbar';
import styles from './ManageTripsPage.module.css';

type Visibility = 'friends_only' | 'anyone_with_link';

export const ManageTripsPage = () => {
    const { trips, isLoading, createTrip, updateTrip, deleteTrip } = useTrips();
    const navigate = useNavigate();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#E74C3C');
    const [newBudget, setNewBudget] = useState('0');
    const [newVisibility, setNewVisibility] = useState<Visibility>('friends_only');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [tripToDelete, setTripToDelete] = useState<number | null>(null);

    const [editingTrip, setEditingTrip] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#E74C3C');
    const [editBudget, setEditBudget] = useState('0');
    const [editVisibility, setEditVisibility] = useState<Visibility>('friends_only');

    const openEditModal = (trip: (typeof trips)[number]) => {
        setEditingTrip(trip.id);
        setEditName(trip.name);
        setEditColor(trip.color);
        setEditBudget((trip.budget ?? 0).toString());
        setEditVisibility(trip.visibility ?? 'friends_only');
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
                visibility: editVisibility,
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
                visibility: newVisibility,
                budget: parseFloat(newBudget) || 0,
                description: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
            });
            setIsCreateOpen(false);
            setNewName('');
            setNewColor('#E74C3C');
            setNewBudget('0');
            setNewVisibility('friends_only');
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

    const myTrips = trips.filter(t => !t.isShared);
    const sharedTrips = trips.filter(t => t.isShared);

    const handleCopyShareLink = async (tripId: number) => {
        try {
            const result = await api.createShareLink({ type: 'album', tripId });
            const fullUrl = `${window.location.origin}${result.url}`;
            await navigator.clipboard.writeText(fullUrl);
            showSnackbar('Trip share link copied');
        } catch {
            showSnackbar('Failed to create share link');
        }
    };

    const renderTripCard = (trip: (typeof trips)[number], editable: boolean) => (
        <motion.div key={trip.id} layoutId={`trip-card-${trip.id}`}>
            <Card className={styles.tripCard} interactive>
                <div className={styles.colorStrip} style={{ backgroundColor: trip.color }} />
                <div className={styles.cardContent}>
                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/trips/${trip.id}`)}>
                        <h3 className={styles.tripName}>{trip.name}</h3>
                        <div className={styles.stats}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /> {trip.places?.length || 0} places</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={16} /> {trip.photos?.length || 0} photos</span>
                            {trip.isShared && <span>Shared with you</span>}
                            {!trip.isShared && (
                                <span className={styles.visibilityBadge}>
                                    {trip.visibility === 'anyone_with_link' ? 'Anyone with link' : 'Friends only'}
                                </span>
                            )}
                        </div>
                    </div>
                    {editable && (
                        <div className={styles.actions}>
                            <Button variant="outlined" size="sm" onClick={() => openEditModal(trip)}>Edit</Button>
                            <Button variant="text" size="sm" onClick={() => handleCopyShareLink(trip.id)}>Copy Link</Button>
                            <Button variant="text" size="sm" onClick={() => setTripToDelete(trip.id)} style={{ color: 'var(--md-sys-color-error)' }}>
                                Delete
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    );

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
                <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} initial="hidden" animate="show">
                    {myTrips.length > 0 && <h2 className={styles.sectionTitle}>My Trips</h2>}
                    <div className={styles.grid}>{myTrips.map(trip => renderTripCard(trip, true))}</div>

                    {sharedTrips.length > 0 && <h2 className={styles.sectionTitle}>Shared Trips</h2>}
                    <div className={styles.grid}>{sharedTrips.map(trip => renderTripCard(trip, false))}</div>

                    {trips.length === 0 && !isLoading && (
                        <div className={styles.emptyState}><p>No trips yet. Create your first one to get started!</p></div>
                    )}
                </motion.div>
            )}

            <Modal
                isOpen={isCreateOpen}
                onClose={() => !isSubmitting && setIsCreateOpen(false)}
                title="Create New Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>Create Trip</Button>
                    </>
                }
            >
                <form onSubmit={handleCreate} className={styles.form}>
                    <Input label="Trip Name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus required fullWidth />
                    <Input label="Budget (Optional)" type="number" value={newBudget} onChange={e => setNewBudget(e.target.value)} fullWidth />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Visibility</label>
                        <select className={styles.selectInput} value={newVisibility} onChange={e => setNewVisibility(e.target.value as Visibility)}>
                            <option value="friends_only">Friends only</option>
                            <option value="anyone_with_link">Anyone with link</option>
                        </select>
                    </div>
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Theme Color</label>
                        <div className={styles.colorRow}>
                            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className={styles.colorInput} />
                            <span className={styles.colorHex}>{newColor.toUpperCase()}</span>
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={tripToDelete !== null}
                onClose={() => !isSubmitting && setTripToDelete(null)}
                title="Delete Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setTripToDelete(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={confirmDelete} disabled={isSubmitting} style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}>
                            Delete Permanently
                        </Button>
                    </>
                }
            >
                <p>Are you sure you want to delete <strong>{trips.find(t => t.id === tripToDelete)?.name}</strong>?</p>
                <p style={{ color: 'var(--md-sys-color-error)' }}>This action cannot be undone.</p>
            </Modal>

            <Modal
                isOpen={editingTrip !== null}
                onClose={() => !isSubmitting && setEditingTrip(null)}
                title="Edit Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setEditingTrip(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={!editName.trim() || isSubmitting}>Save Changes</Button>
                    </>
                }
            >
                <form onSubmit={handleEdit} className={styles.form}>
                    <Input label="Trip Name" value={editName} onChange={e => setEditName(e.target.value)} autoFocus required fullWidth />
                    <Input label="Budget (Optional)" type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} fullWidth />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Visibility</label>
                        <select className={styles.selectInput} value={editVisibility} onChange={e => setEditVisibility(e.target.value as Visibility)}>
                            <option value="friends_only">Friends only</option>
                            <option value="anyone_with_link">Anyone with link</option>
                        </select>
                    </div>
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Theme Color</label>
                        <div className={styles.colorRow}>
                            <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className={styles.colorInput} />
                            <span className={styles.colorHex}>{editColor.toUpperCase()}</span>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
