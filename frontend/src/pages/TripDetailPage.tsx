import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useState, useEffect } from 'react';
import * as api from '../api/client';
import { showSnackbar } from '../components/ui/Snackbar';
import type { Trip, PlaceCreate, Place } from '../types/models';
import styles from './TripDetailPage.module.css';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { SortablePlaceCard } from '../features/trips/components/SortablePlaceCard';
import { UploadZone } from '../components/upload/UploadZone';
import { StagingTable, type StagedPhoto } from '../components/upload/StagingTable';
import { PhotoGrid } from '../components/gallery/PhotoGrid';
import { Lightbox } from '../components/gallery/Lightbox';
import { MdDownload } from 'react-icons/md';
import { Share2 } from 'lucide-react';
import type { CurrencyOption, Expense } from '../types/models';
import type { Friend, TripMember } from '../types/models';
import { motion } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuthStore } from '../store/useAuthStore';

export const TripDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { trips, updateTrip: updateTripInStore } = useStore();
    const user = useAuthStore(s => s.user);

    const [trip, setTrip] = useState<Trip | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Add Place Modal State
    const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
    const [placeName, setPlaceName] = useState('');
    const [placeLat, setPlaceLat] = useState('');
    const [placeLng, setPlaceLng] = useState('');
    const [placeNote, setPlaceNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Photos Staging State
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    // Lightbox State
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Expenses State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCurrency, setExpenseCurrency] = useState('USD');
    const [expenseNote, setExpenseNote] = useState('');
    const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [members, setMembers] = useState<TripMember[]>([]);
    const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
    const [selectedInviteRole, setSelectedInviteRole] = useState<'viewer' | 'editor'>('viewer');

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const loadTrip = async () => {
            if (!id) return;
            const tripId = Number(id);

            // Use local store as immediate paint, but still fetch server data after.
            const localTrip = trips.find((t: Trip) => t.id === Number(id));
            if (localTrip && localTrip.places) {
                setTrip(localTrip);
                setIsLoading(false);
            }

            try {
                const freshData = await api.getTrip(tripId);
                setTrip(freshData);
                updateTripInStore(freshData);

                const [loadedExpenses, loadedCurrencies] = await Promise.all([
                    api.getExpenses(tripId).catch(() => []),
                    api.getCurrencies().catch(() => []),
                ]);
                setExpenses(loadedExpenses);
                setCurrencies(loadedCurrencies);

                const [friendsData, membersData] = await Promise.all([
                    api.getFriends().catch(() => []),
                    api.getTripMembers(tripId).catch(() => []),
                ]);
                setFriends(friendsData);
                setMembers(membersData);
            } catch (err) {
                showSnackbar('Failed to load trip details');
                navigate('/trips');
            } finally {
                setIsLoading(false);
            }
        };

        loadTrip();
    }, [id, trips, navigate, updateTripInStore]);

    const handleAddPlace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trip || !placeName.trim() || !placeLat || !placeLng) return;
        if (trip.accessRole === 'viewer') {
            showSnackbar('Viewer access cannot add places');
            return;
        }

        setIsSubmitting(true);
        try {
            const newPlaceData: PlaceCreate = {
                name: placeName.trim(),
                lat: parseFloat(placeLat),
                lng: parseFloat(placeLng),
                note: placeNote.trim()
            };

            const newPlace = await api.createPlace(trip.id, newPlaceData);

            // Update local state immediately
            const updatedTrip = { ...trip, places: [...trip.places, newPlace] };
            setTrip(updatedTrip);
            updateTripInStore(updatedTrip);

            // Reset form
            setIsAddPlaceOpen(false);
            setPlaceName('');
            setPlaceLat('');
            setPlaceLng('');
            setPlaceNote('');
            showSnackbar('Place added to trip');
        } catch (err: any) {
            showSnackbar(`Failed to add place: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePlace = async (placeId: number) => {
        if (!trip) return;
        if (trip.accessRole === 'viewer') {
            showSnackbar('Viewer access cannot delete places');
            return;
        }
        try {
            await api.deletePlace(trip.id, placeId);
            const updatedTrip = {
                ...trip,
                places: trip.places.filter(p => p.id !== placeId)
            };
            setTrip(updatedTrip);
            updateTripInStore(updatedTrip);
            showSnackbar('Place removed');
        } catch (err: any) {
            showSnackbar(`Failed to delete place: ${err.message}`);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!trip || !over || active.id === over.id) {
            return;
        }
        if (trip.accessRole === 'viewer') {
            showSnackbar('Viewer access cannot reorder places');
            return;
        }

        const oldIndex = trip.places.findIndex(p => p.id === active.id);
        const newIndex = trip.places.findIndex(p => p.id === over.id);

        // Generate new order
        const orderedPlaces = arrayMove(trip.places, oldIndex, newIndex);
        const updatedTrip = { ...trip, places: orderedPlaces };

        // Optimistic UI update
        setTrip(updatedTrip);
        updateTripInStore(updatedTrip);

        try {
            await api.reorderPlaces(trip.id, orderedPlaces.map(p => p.id));
        } catch (err) {
            // Revert if API call fails
            showSnackbar('Failed to save new place order');
            setTrip(trip);
            updateTripInStore(trip);
        }
    };

    const handleFilesAdded = (files: File[]) => {
        setStagedFiles(prev => [...prev, ...files]);
    };

    const handleUploadStaged = async (photosToUpload: StagedPhoto[]) => {
        if (!trip) return;
        if (trip.accessRole === 'viewer') {
            showSnackbar('Viewer access cannot upload photos');
            return;
        }

        let successCount = 0;

        for (const photo of photosToUpload) {
            try {
                // Update specific photo status to uploading (could pass via a callback, for now simple toast)
                const formData = new FormData();
                formData.append('file', photo.file);
                if (photo.lat !== null) formData.append('lat', photo.lat.toString());
                if (photo.lng !== null) formData.append('lng', photo.lng.toString());
                if (photo.takenAt !== null) formData.append('takenAt', photo.takenAt.toString());
                if (photo.placeId !== null) formData.append('placeId', photo.placeId.toString());

                const newPhoto = await api.uploadPhoto(trip.id, formData);

                // Update local trip photos
                setTrip(prev => prev ? { ...prev, photos: [...prev.photos, newPhoto] } : null);
                successCount++;

                // Remove from staging
                setStagedFiles(prev => prev.filter(f => f.name !== photo.file.name || f.size !== photo.file.size));

            } catch (err: any) {
                showSnackbar(`Failed to upload ${photo.file.name}`);
            }
        }

        if (successCount > 0) {
            showSnackbar(`Successfully uploaded ${successCount} photos`);
            const localTrip = trips.find((t: Trip) => t.id === Number(id));
            if (localTrip) updateTripInStore(trip!); // Ensure sync
        }
    };

    const handleDownloadAllPhotos = async () => {
        if (!trip || trip.photos.length === 0) return;
        try {
            const blob = await api.downloadTripPhotosZip(trip.id);
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${trip.name.replace(/\s+/g, '_')}_photos.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (err: any) {
            showSnackbar(`Download failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trip || !expenseAmount) return;
        if (trip.accessRole === 'viewer') {
            showSnackbar('Viewer access cannot add expenses');
            return;
        }
        try {
            const created = await api.createExpense(trip.id, {
                amount: parseFloat(expenseAmount),
                currency: expenseCurrency,
                note: expenseNote,
            });
            setExpenses(prev => [created, ...prev]);
            setExpenseAmount('');
            setExpenseNote('');
            showSnackbar('Expense logged');
        } catch (err: any) {
            showSnackbar(`Failed to add expense: ${err.message}`);
        }
    };

    if (isLoading && !trip) {
        return <div className={styles.loading}>Loading trip data...</div>;
    }

    if (!trip) return null;

    const handleShareAlbum = async () => {
        try {
            const result = await api.createShareLink({ type: 'album', tripId: trip.id });
            const fullUrl = `${window.location.origin}${result.url}`;
            await navigator.clipboard.writeText(fullUrl);
            showSnackbar('Share link copied to clipboard!');
        } catch {
            showSnackbar('Failed to create share link');
        }
    };

    const isOwner = user?.id === trip.ownerUserId;
    const canEdit = trip.accessRole !== 'viewer';
    const invitedFriendIds = new Set(members.map(m => m.id));
    const invitables = friends.filter(f => !invitedFriendIds.has(f.id));

    const handleInviteFriend = async () => {
        if (!selectedFriendId) return;
        try {
            await api.inviteTripMember(trip.id, selectedFriendId, selectedInviteRole);
            const nextMembers = await api.getTripMembers(trip.id);
            setMembers(nextMembers);
            setSelectedFriendId(null);
            showSnackbar('Friend added to trip');
        } catch (err: any) {
            showSnackbar(err.message || 'Failed to invite friend');
        }
    };

    const handleRemoveMember = async (memberUserId: number) => {
        try {
            await api.removeTripMember(trip.id, memberUserId);
            setMembers(prev => prev.filter(m => m.id !== memberUserId));
            showSnackbar('Removed trip member');
        } catch (err: any) {
            showSnackbar(err.message || 'Failed to remove member');
        }
    };

    const handleUpdateMemberRole = async (memberUserId: number, role: 'viewer' | 'editor') => {
        try {
            await api.setTripMemberRole(trip.id, memberUserId, role);
            setMembers(prev => prev.map(m => (m.id === memberUserId ? { ...m, role } : m)));
            showSnackbar('Member role updated');
        } catch (err: any) {
            showSnackbar(err.message || 'Failed to update role');
        }
    };

    return (
        <div className={styles.container}>
            <motion.header layoutId={`trip-card-${trip.id}`} className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <Button variant="text" onClick={() => navigate('/trips')} className={styles.backBtn}>
                        ← Back
                    </Button>
                    <div className={styles.titleGroup}>
                        <div className={styles.colorDot} style={{ backgroundColor: trip.color }} />
                        <h1 className={styles.title}>{trip.name}</h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="outlined" onClick={handleShareAlbum}>
                        <Share2 size={16} style={{ marginRight: 6 }} /> Share Album
                    </Button>
                    {canEdit && <Button onClick={() => setIsAddPlaceOpen(true)}>+ Add Place</Button>}
                </div>
            </motion.header>

            <div className={styles.contentGrid}>

                {/* Left Column: Places Timeline */}
                <section className={styles.placesSection}>
                    <div className={styles.sectionHeader}>
                        <h2>Itinerary ({trip.places.length})</h2>
                        {/* Reordering functionality will be added in Phase 3 with @dnd-kit */}
                        {canEdit && trip.places.length > 1 && <Button variant="text" size="sm">Reorder</Button>}
                    </div>

                    <div className={styles.placesList}>
                        {trip.places.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No places added yet. Build your itinerary by adding locations.</p>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={trip.places.map(p => p.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {trip.places.map((place: Place, index: number) => (
                                        <SortablePlaceCard
                                            key={place.id}
                                            place={place}
                                            index={index}
                                            total={trip.places.length}
                                            tripColor={trip.color}
                                            onDelete={handleDeletePlace}
                                            canEdit={canEdit}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>
                </section>

                {/* Right Column: Metadata & Photos Summary */}
                <section className={styles.metaSection}>
                    <Card className={styles.metaCard}>
                        <h3>Trip Details</h3>
                        {/* Note: Persons array handling will require tying together personIds with the global persons list in the store. Doing this in a future refactor. */}
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Travellers</span>
                            <span className={styles.metaValue}>{trip.personIds.length > 0 ? `${trip.personIds.length} assigned` : 'None'}</span>
                        </div>
                        <div className={styles.metaRow}>
                            <span className={styles.metaLabel}>Photos</span>
                            <span className={styles.metaValue}>{trip.photos.length} uploaded</span>
                        </div>
                    </Card>

                    <Card className={styles.metaCard}>
                        <h3>Trip Members</h3>
                        {isOwner && (
                            <div className={styles.memberInviteRow}>
                                <select
                                    value={selectedFriendId ?? ''}
                                    onChange={(e) => setSelectedFriendId(e.target.value ? Number(e.target.value) : null)}
                                    className={styles.select}
                                >
                                    <option value="">Invite friend...</option>
                                    {invitables.map(friend => (
                                        <option key={friend.id} value={friend.id}>{friend.displayName} (@{friend.username})</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedInviteRole}
                                    onChange={e => setSelectedInviteRole(e.target.value as 'viewer' | 'editor')}
                                    className={styles.select}
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                                <Button size="sm" onClick={handleInviteFriend} disabled={!selectedFriendId}>Invite</Button>
                            </div>
                        )}
                        <div className={styles.memberList}>
                            {members.length === 0 && <p className={styles.helperText}>No invited members yet.</p>}
                            {members.map(member => (
                                <div className={styles.memberRow} key={member.id}>
                                    <span>{member.displayName} (@{member.username}) · {member.role}</span>
                                    {isOwner && (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <select
                                                value={member.role}
                                                onChange={e => handleUpdateMemberRole(member.id, e.target.value as 'viewer' | 'editor')}
                                                className={styles.select}
                                            >
                                                <option value="viewer">Viewer</option>
                                                <option value="editor">Editor</option>
                                            </select>
                                            <Button size="sm" variant="text" onClick={() => handleRemoveMember(member.id)}>
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className={styles.metaCard}>
                        <h3>Expenses</h3>
                        <form onSubmit={handleAddExpense} className={styles.form}>
                            <Input
                                label="Amount"
                                type="number"
                                step="0.01"
                                value={expenseAmount}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseAmount(e.target.value)}
                                required
                                fullWidth
                            />
                            <div className={styles.coordRow}>
                                <select
                                    value={expenseCurrency}
                                    onChange={(e) => setExpenseCurrency(e.target.value)}
                                    className={styles.select}
                                >
                                    {(currencies.length > 0 ? currencies : [{ code: 'USD', name: 'US Dollar' }]).map(c => (
                                        <option key={c.code} value={c.code}>{c.code}</option>
                                    ))}
                                </select>
                                <Input
                                    label="Note"
                                    value={expenseNote}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpenseNote(e.target.value)}
                                    placeholder="e.g. Lunch"
                                    fullWidth
                                />
                            </div>
                            {canEdit && <Button size="sm" type="submit">Add Expense</Button>}
                        </form>
                        <div className={styles.expenseList}>
                            {expenses.slice(0, 5).map(exp => (
                                <div key={exp.id} className={styles.metaRow}>
                                    <span className={styles.metaLabel}>{exp.note || 'Expense'} ({exp.amount} {exp.currency})</span>
                                    <span className={styles.metaValue}>{exp.amountHome} {exp.homeCurrency}</span>
                                </div>
                            ))}
                            {expenses.length === 0 && <p className={styles.helperText}>No expenses logged yet.</p>}
                        </div>
                    </Card>

                    {/* Photo Grid Section */}
                    {trip.photos.length > 0 && (
                        <Card className={styles.metaCard}>
                            <div className={styles.sectionHeader}>
                                <h2>Gallery</h2>
                                <Button variant="text" size="sm" onClick={handleDownloadAllPhotos}>
                                    <MdDownload style={{ marginRight: 8 }} /> Download ZIP
                                </Button>
                            </div>
                            <PhotoGrid
                                photos={trip.photos}
                                onPhotoClick={(index) => setLightboxIndex(index)}
                            />
                        </Card>
                    )}

                    {/* Photos Upload Section */}
                    {canEdit && (
                        <Card className={styles.metaCard}>
                            <div className={styles.sectionHeader}>
                                <h2>Upload Photos</h2>
                            </div>
                            <UploadZone onFilesAdded={handleFilesAdded} />
                            {stagedFiles.length > 0 && (
                                <StagingTable
                                    files={stagedFiles}
                                    places={trip.places}
                                    onUpload={handleUploadStaged}
                                    onRemove={() => {
                                        // Complex filter by identity because StagingTable manages the ID
                                        // We'll just reset files in real app, but here we can let StagingTable own it
                                        // and just clear files entirely when empty
                                    }}
                                />
                            )}
                        </Card>
                    )}
                </section>

            </div>

            {/* Lightbox Overlay */}
            {lightboxIndex !== null && (
                <Lightbox
                    photos={trip.photos}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={(newIndex) => setLightboxIndex(newIndex)}
                />
            )}

            {/* Add Place Modal */}
            <Modal
                isOpen={isAddPlaceOpen}
                onClose={() => !isSubmitting && setIsAddPlaceOpen(false)}
                title="Add Place to Trip"
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsAddPlaceOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddPlace} disabled={!placeName.trim() || !placeLat || !placeLng || isSubmitting}>
                            Add Place
                        </Button>
                    </>
                }
            >
                <form id="add-place-form" onSubmit={handleAddPlace} className={styles.form}>
                    <Input
                        label="Location Name"
                        value={placeName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlaceName(e.target.value)}
                        placeholder="e.g. Tokyo Tower"
                        autoFocus
                        required
                        fullWidth
                    />
                    <div className={styles.coordRow}>
                        <Input
                            label="Latitude"
                            type="number"
                            step="any"
                            value={placeLat}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlaceLat(e.target.value)}
                            placeholder="35.6586"
                            required
                            fullWidth
                        />
                        <Input
                            label="Longitude"
                            type="number"
                            step="any"
                            value={placeLng}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlaceLng(e.target.value)}
                            placeholder="139.7454"
                            required
                            fullWidth
                        />
                    </div>
                    <Input
                        label="Note (Optional)"
                        value={placeNote}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlaceNote(e.target.value)}
                        placeholder="Great views at sunset"
                        fullWidth
                    />
                    <p className={styles.helperText}>
                        Note: Map-based point-and-click place addition will be built in Phase 3.
                    </p>
                </form>
            </Modal>

        </div>
    );
};
