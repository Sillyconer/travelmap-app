import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useState, useEffect, useMemo } from 'react';
import * as api from '../api/client';
import { showSnackbar } from '../components/ui/Snackbar';
import type { Trip, PlaceCreate, Place, ItineraryItem } from '../types/models';
import styles from './TripDetailPage.module.css';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { SortablePlaceCard } from '../features/trips/components/SortablePlaceCard';
import { UploadZone } from '../components/upload/UploadZone';
import { StagingTable, type StagedPhoto } from '../components/upload/StagingTable';
import { PhotoGrid } from '../components/gallery/PhotoGrid';
import { Lightbox } from '../components/gallery/Lightbox';
import { MdDownload } from 'react-icons/md';
import { Share2 } from 'lucide-react';
import type { CommentItem, CurrencyOption, Expense, ExpenseSettlement, PhotoOut } from '../types/models';
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
    const [loadError, setLoadError] = useState<string | null>(null);

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
    const [settlement, setSettlement] = useState<ExpenseSettlement | null>(null);
    const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCurrency, setExpenseCurrency] = useState('USD');
    const [expenseNote, setExpenseNote] = useState('');
    const [expenseSplitMode, setExpenseSplitMode] = useState<'equal' | 'custom_amount'>('equal');
    const [expenseParticipantIds, setExpenseParticipantIds] = useState<number[]>([]);
    const [expenseCustomShares, setExpenseCustomShares] = useState<Record<number, string>>({});
    const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [members, setMembers] = useState<TripMember[]>([]);
    const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
    const [selectedInviteRole, setSelectedInviteRole] = useState<'viewer' | 'editor'>('viewer');
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [newCommentBody, setNewCommentBody] = useState('');
    const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
    const [planTitle, setPlanTitle] = useState('');
    const [planDayIndex, setPlanDayIndex] = useState('1');
    const [planStartAt, setPlanStartAt] = useState('');
    const [planEndAt, setPlanEndAt] = useState('');
    const [planPlaceId, setPlanPlaceId] = useState<number | null>(null);
    const [planNote, setPlanNote] = useState('');

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const loadTrip = async () => {
            if (!id) return;
            setLoadError(null);

            // Use local store as immediate paint, but still fetch server data after.
            const localTrip = trips.find((t: Trip) => t.publicId === id);
            if (localTrip && localTrip.places) {
                setTrip(localTrip);
                setIsLoading(false);
            }

            try {
                const freshData = await api.getTripByPublicId(id);
                const tripId = freshData.id;
                setTrip(freshData);
                updateTripInStore(freshData);

                const [loadedExpenses, loadedCurrencies] = await Promise.all([
                    api.getExpenses(tripId).catch(() => []),
                    api.getCurrencies().catch(() => []),
                ]);
                setExpenses(loadedExpenses);
                setCurrencies(loadedCurrencies);

                const loadedSettlement = await api.getExpenseSettlement(tripId).catch(() => null);
                setSettlement(loadedSettlement);

                const loadedComments = await api.getComments('trip', tripId).catch(() => []);
                setComments(loadedComments);

                const [friendsData, membersData] = await Promise.all([
                    api.getFriends().catch(() => []),
                    api.getTripMembers(tripId).catch(() => []),
                ]);
                setFriends(friendsData);
                setMembers(membersData);

                const loadedPlan = await api.getItineraryItems(tripId).catch(() => []);
                setItineraryItems(loadedPlan);
            } catch (err: any) {
                setLoadError(err?.message || 'Failed to load trip details');
                setTrip(null);
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
            const participantIds = expenseParticipantIds.length > 0
                ? expenseParticipantIds
                : tripExpenseParticipants.map(p => p.id);
            const customSharesPayload = expenseSplitMode === 'custom_amount'
                ? Object.fromEntries(
                    participantIds.map(id => [String(id), Number(expenseCustomShares[id] || 0)]),
                )
                : undefined;
            const created = await api.createExpense(trip.id, {
                amount: parseFloat(expenseAmount),
                currency: expenseCurrency,
                note: expenseNote,
                splitMode: expenseSplitMode,
                participantUserIds: participantIds,
                customShares: customSharesPayload,
            });
            setExpenses(prev => [created, ...prev]);
            const refreshedSettlement = await api.getExpenseSettlement(trip.id).catch(() => null);
            setSettlement(refreshedSettlement);
            setExpenseAmount('');
            setExpenseNote('');
            setExpenseSplitMode('equal');
            setExpenseCustomShares({});
            showSnackbar('Expense logged');
        } catch (err: any) {
            showSnackbar(`Failed to add expense: ${err.message}`);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trip || !newCommentBody.trim()) return;
        try {
            const created = await api.createComment('trip', trip.id, newCommentBody.trim());
            setComments(prev => [...prev, created]);
            setNewCommentBody('');
        } catch (err: any) {
            showSnackbar(`Failed to post comment: ${err.message}`);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.deleteComment(commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err: any) {
            showSnackbar(`Failed to delete comment: ${err.message}`);
        }
    };

    const handleToggleReaction = async (commentId: number, emoji: string) => {
        try {
            const nextReactions = await api.toggleCommentReaction(commentId, emoji);
            setComments(prev => prev.map(c => (c.id === commentId ? { ...c, reactions: nextReactions } : c)));
        } catch (err: any) {
            showSnackbar(`Failed to react: ${err.message}`);
        }
    };

    const handleAddPlanItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trip || !planTitle.trim()) {
            return;
        }
        if (!canEdit) {
            showSnackbar('Viewer access cannot edit itinerary plan items');
            return;
        }
        try {
            const created = await api.createItineraryItem(trip.id, {
                title: planTitle.trim(),
                dayIndex: Math.max(1, Number(planDayIndex || 1)),
                startAt: planStartAt.trim(),
                endAt: planEndAt.trim(),
                placeId: planPlaceId ?? undefined,
                note: planNote.trim(),
            });
            setItineraryItems(prev => {
                const next = [...prev, created];
                return next.sort((a, b) => (a.dayIndex - b.dayIndex) || (a.sortOrder - b.sortOrder) || (a.id - b.id));
            });
            setPlanTitle('');
            setPlanDayIndex('1');
            setPlanStartAt('');
            setPlanEndAt('');
            setPlanPlaceId(null);
            setPlanNote('');
        } catch (err: any) {
            showSnackbar(`Failed to add plan item: ${err.message}`);
        }
    };

    const handleDeletePlanItem = async (itemId: number) => {
        if (!trip) {
            return;
        }
        if (!canEdit) {
            showSnackbar('Viewer access cannot remove itinerary plan items');
            return;
        }
        try {
            await api.deleteItineraryItem(trip.id, itemId);
            setItineraryItems(prev => prev.filter(item => item.id !== itemId));
        } catch (err: any) {
            showSnackbar(`Failed to delete plan item: ${err.message}`);
        }
    };

    const handleShareAlbum = async () => {
        if (!trip) {
            return;
        }
        try {
            const result = await api.createShareLink({ type: 'album', tripId: trip.id });
            const fullUrl = `${window.location.origin}${result.url}`;
            await navigator.clipboard.writeText(fullUrl);
            showSnackbar('Share link copied to clipboard!');
        } catch {
            showSnackbar('Failed to create share link');
        }
    };

    const isOwner = trip ? user?.id === trip.ownerUserId : false;
    const canEdit = trip ? trip.accessRole !== 'viewer' : false;

    const tripExpenseParticipants = useMemo(() => {
        const participantMap = new Map<number, { id: number; name: string }>();
        if (user) {
            participantMap.set(user.id, { id: user.id, name: `${user.displayName} (you)` });
        }
        for (const member of members) {
            if (!participantMap.has(member.id)) {
                participantMap.set(member.id, { id: member.id, name: member.displayName });
            }
        }
        return Array.from(participantMap.values());
    }, [members, user]);

    useEffect(() => {
        if (expenseParticipantIds.length === 0 && tripExpenseParticipants.length > 0) {
            setExpenseParticipantIds(tripExpenseParticipants.map(p => p.id));
        }
    }, [tripExpenseParticipants, expenseParticipantIds.length]);

    const toggleExpenseParticipant = (participantId: number) => {
        setExpenseParticipantIds(prev => {
            if (prev.includes(participantId)) {
                const next = prev.filter(id => id !== participantId);
                return next.length === 0 ? prev : next;
            }
            return [...prev, participantId];
        });
    };

    const expenseAmountNumber = Number(expenseAmount || 0);
    const customSplitTotal = expenseParticipantIds.reduce((sum, participantId) => {
        return sum + Number(expenseCustomShares[participantId] || 0);
    }, 0);
    const customSplitRemaining = Number((expenseAmountNumber - customSplitTotal).toFixed(2));
    const canSubmitExpense =
        canEdit
        && expenseAmountNumber > 0
        && expenseParticipantIds.length > 0
        && (expenseSplitMode === 'equal' || Math.abs(customSplitRemaining) <= 0.01);
    const invitedFriendIds = new Set(members.map(m => m.id));
    const invitables = friends.filter(f => !invitedFriendIds.has(f.id));
    const itineraryByDay = (() => {
        const grouped = new Map<number, ItineraryItem[]>();
        for (const item of itineraryItems) {
            if (!grouped.has(item.dayIndex)) {
                grouped.set(item.dayIndex, []);
            }
            grouped.get(item.dayIndex)!.push(item);
        }
        return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
    })();

    const photosByPlace = useMemo(() => {
        if (!trip) {
            return { sections: [] as Array<{ place: Place; photos: PhotoOut[] }>, unassigned: [] as PhotoOut[] };
        }
        const sortPhotos = (photos: PhotoOut[]) =>
            photos.slice().sort((a, b) => {
                const aTime = a.takenAt ?? Number.MAX_SAFE_INTEGER;
                const bTime = b.takenAt ?? Number.MAX_SAFE_INTEGER;
                if (aTime !== bTime) {
                    return aTime - bTime;
                }
                return a.id - b.id;
            });

        const sections = trip.places.map(place => ({
            place,
            photos: sortPhotos(trip.photos.filter(photo => photo.placeId === place.id)),
        }));
        const unassigned = sortPhotos(trip.photos.filter(photo => !photo.placeId));
        return { sections, unassigned };
    }, [trip]);

    if (isLoading && !trip) {
        return <div className={styles.loading}>Loading trip data...</div>;
    }

    if (!trip) {
        return (
            <div className={styles.loading}>
                {loadError || 'Trip not found or inaccessible.'}
                <Button variant="text" onClick={() => navigate('/trips')}>Back to trips</Button>
            </div>
        );
    }

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

            {!canEdit && (
                <Card className={styles.readOnlyCard}>
                    You have viewer access to this trip. You can explore content but cannot edit itinerary, photos, or expenses.
                </Card>
            )}

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

                    <Card className={styles.metaCard}>
                        <h3>Trip Discussion</h3>
                        <form onSubmit={handleAddComment} className={styles.commentForm}>
                            <Input
                                label="Add a comment"
                                value={newCommentBody}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCommentBody(e.target.value)}
                                placeholder="Share a tip or update"
                                fullWidth
                            />
                            <Button size="sm" type="submit" disabled={!newCommentBody.trim()}>Post</Button>
                        </form>
                        <div className={styles.commentList}>
                            {comments.length === 0 && <p className={styles.helperText}>No comments yet.</p>}
                            {comments.map(comment => (
                                <div key={comment.id} className={styles.commentItem}>
                                    <div className={styles.commentHeader}>
                                        <button
                                            type="button"
                                            className={styles.memberIdentityBtn}
                                            onClick={() => navigate(`/profiles/${comment.username}`)}
                                        >
                                            <Avatar seed={comment.username} name={comment.displayName} size={26} />
                                            <strong>{comment.displayName}</strong>
                                            <small>@{comment.username}</small>
                                        </button>
                                    </div>
                                    <p className={styles.commentBody}>{comment.body}</p>
                                    <div className={styles.commentActions}>
                                        <button type="button" className={styles.reactionBtn} onClick={() => handleToggleReaction(comment.id, '👍')}>
                                            👍 {comment.reactions.find(r => r.emoji === '👍')?.count || 0}
                                        </button>
                                        <button type="button" className={styles.reactionBtn} onClick={() => handleToggleReaction(comment.id, '❤️')}>
                                            ❤️ {comment.reactions.find(r => r.emoji === '❤️')?.count || 0}
                                        </button>
                                        {comment.canDelete && (
                                            <Button size="sm" variant="text" onClick={() => handleDeleteComment(comment.id)}>
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className={styles.metaCard}>
                        <h3>Trip Photos by Stop</h3>
                        <div className={styles.photoSections}>
                            {photosByPlace.sections.map(section => (
                                <div key={`place-photos-${section.place.id}`} className={styles.photoSection}>
                                    <p className={styles.planDayTitle}>{section.place.name}</p>
                                    {section.photos.length === 0 ? (
                                        <p className={styles.helperText}>No photos assigned to this stop.</p>
                                    ) : (
                                        <div className={styles.tripPhotoGrid}>
                                            {section.photos.map(photo => (
                                                <button
                                                    key={`trip-photo-${photo.id}`}
                                                    type="button"
                                                    className={styles.tripPhotoButton}
                                                    onClick={() => setLightboxIndex(trip.photos.findIndex(p => p.id === photo.id))}
                                                >
                                                    <img src={`http://localhost:8000${photo.thumbUrl}`} alt={photo.name} className={styles.tripPhotoThumb} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {photosByPlace.unassigned.length > 0 && (
                                <div className={styles.photoSection}>
                                    <p className={styles.planDayTitle}>Unassigned</p>
                                    <div className={styles.tripPhotoGrid}>
                                        {photosByPlace.unassigned.map(photo => (
                                            <button
                                                key={`trip-photo-unassigned-${photo.id}`}
                                                type="button"
                                                className={styles.tripPhotoButton}
                                                onClick={() => setLightboxIndex(trip.photos.findIndex(p => p.id === photo.id))}
                                            >
                                                <img src={`http://localhost:8000${photo.thumbUrl}`} alt={photo.name} className={styles.tripPhotoThumb} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {trip.photos.length === 0 && <p className={styles.helperText}>No trip photos yet.</p>}
                        </div>
                    </Card>
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
                                    <button
                                        type="button"
                                        className={styles.memberIdentityBtn}
                                        onClick={() => navigate(`/profiles/${member.username}`)}
                                    >
                                        <Avatar seed={member.username} name={member.displayName} imageUrl={member.avatarUrl} size={30} />
                                        <span>
                                            {member.displayName} (@{member.username}) · {member.role}
                                            {member.role === 'owner' && <span className={styles.ownerBadge} title="Owner"> 👑</span>}
                                        </span>
                                    </button>
                                    {isOwner && member.role !== 'owner' && (
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
                        <h3>Day Plan</h3>
                        {canEdit ? (
                            <form onSubmit={handleAddPlanItem} className={styles.form}>
                                <Input
                                    label="Title"
                                    value={planTitle}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanTitle(e.target.value)}
                                    placeholder="e.g. Sunrise walk"
                                    fullWidth
                                />
                                <div className={styles.coordRow}>
                                    <Input
                                        label="Day"
                                        type="number"
                                        min="1"
                                        value={planDayIndex}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanDayIndex(e.target.value)}
                                        fullWidth
                                    />
                                    <Input
                                        label="Start"
                                        value={planStartAt}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanStartAt(e.target.value)}
                                        placeholder="09:00"
                                        fullWidth
                                    />
                                    <Input
                                        label="End"
                                        value={planEndAt}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanEndAt(e.target.value)}
                                        placeholder="11:00"
                                        fullWidth
                                    />
                                </div>
                                <div className={styles.coordRow}>
                                    <select
                                        value={planPlaceId ?? ''}
                                        onChange={e => setPlanPlaceId(e.target.value ? Number(e.target.value) : null)}
                                        className={styles.select}
                                    >
                                        <option value="">No linked place</option>
                                        {trip.places.map(place => (
                                            <option key={`plan-place-${place.id}`} value={place.id}>{place.name}</option>
                                        ))}
                                    </select>
                                    <Input
                                        label="Note"
                                        value={planNote}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanNote(e.target.value)}
                                        placeholder="Optional"
                                        fullWidth
                                    />
                                </div>
                                <Button size="sm" type="submit" disabled={!planTitle.trim()}>Add Plan Item</Button>
                            </form>
                        ) : (
                            <p className={styles.helperText}>Viewer access: day plan edits are disabled.</p>
                        )}
                        <div className={styles.expenseList}>
                            {itineraryItems.length === 0 && <p className={styles.helperText}>No plan items yet.</p>}
                            {itineraryByDay.map(([dayIndex, dayItems]) => (
                                <div key={`day-${dayIndex}`} className={styles.planDayGroup}>
                                    <p className={styles.planDayTitle}>Day {dayIndex}</p>
                                    {dayItems.map(item => (
                                        <div key={`plan-${item.id}`} className={styles.planRow}>
                                            <div>
                                                <strong>{item.title}</strong>
                                                <p className={styles.helperText}>
                                                    {item.startAt || '--'} - {item.endAt || '--'}
                                                    {item.placeId ? ` · linked place #${item.placeId}` : ''}
                                                    {item.note ? ` · ${item.note}` : ''}
                                                </p>
                                            </div>
                                            {canEdit && (
                                                <Button size="sm" variant="text" onClick={() => handleDeletePlanItem(item.id)}>
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className={styles.metaCard}>
                        <h3>Expenses</h3>
                        {canEdit ? (
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
                                <div className={styles.coordRow}>
                                    <select
                                        value={expenseSplitMode}
                                        onChange={(e) => setExpenseSplitMode(e.target.value as 'equal' | 'custom_amount')}
                                        className={styles.select}
                                    >
                                        <option value="equal">Split equally</option>
                                        <option value="custom_amount">Exact amounts</option>
                                    </select>
                                </div>
                                <div className={styles.expenseParticipants}>
                                    {tripExpenseParticipants.map(participant => {
                                        const checked = expenseParticipantIds.includes(participant.id);
                                        return (
                                            <label key={`expense-participant-${participant.id}`} className={styles.checkboxChip}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleExpenseParticipant(participant.id)}
                                                />
                                                <span>{participant.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {expenseSplitMode === 'custom_amount' && (
                                    <div className={styles.customSplitGrid}>
                                        {expenseParticipantIds.map(participantId => {
                                            const participant = tripExpenseParticipants.find(p => p.id === participantId);
                                            if (!participant) {
                                                return null;
                                            }
                                            return (
                                                <Input
                                                    key={`custom-share-${participant.id}`}
                                                    label={`${participant.name} amount (${expenseCurrency})`}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={expenseCustomShares[participant.id] ?? ''}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        const value = e.target.value;
                                                        setExpenseCustomShares(prev => ({ ...prev, [participant.id]: value }));
                                                    }}
                                                    fullWidth
                                                />
                                            );
                                        })}
                                        <p className={Math.abs(customSplitRemaining) <= 0.01 ? styles.helperText : styles.warnText}>
                                            Remaining: {customSplitRemaining.toFixed(2)} {expenseCurrency}
                                        </p>
                                    </div>
                                )}
                                <Button size="sm" type="submit" disabled={!canSubmitExpense}>Add Expense</Button>
                            </form>
                        ) : (
                            <p className={styles.helperText}>Viewer access: adding expenses is disabled.</p>
                        )}
                        <div className={styles.expenseList}>
                            {expenses.slice(0, 5).map(exp => (
                                <div key={exp.id} className={styles.metaRow}>
                                    <span className={styles.metaLabel}>{exp.note || 'Expense'} ({exp.amount} {exp.currency})</span>
                                    <span className={styles.metaValue}>{exp.amountHome} {exp.homeCurrency}</span>
                                </div>
                            ))}
                            {expenses.length === 0 && <p className={styles.helperText}>No expenses logged yet.</p>}
                        </div>
                        {settlement && (
                            <div className={styles.settlementBlock}>
                                <p className={styles.helperText}>
                                    Per person: {settlement.perPerson} {settlement.homeCurrency}
                                    {settlement.mixedCurrencies ? ' (mixed source currencies)' : ''}
                                </p>
                                {settlement.transfers.length === 0 ? (
                                    <p className={styles.helperText}>No transfers needed right now.</p>
                                ) : (
                                    <div className={styles.settlementList}>
                                        {settlement.transfers.map((transfer, idx) => {
                                            const from = settlement.participants.find(p => p.userId === transfer.fromUserId);
                                            const to = settlement.participants.find(p => p.userId === transfer.toUserId);
                                            return (
                                                <div key={`transfer-${idx}`} className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>{from?.displayName || transfer.fromUserId} pays {to?.displayName || transfer.toUserId}</span>
                                                    <span className={styles.metaValue}>{transfer.amount} {settlement.homeCurrency}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {settlement.expenseBreakdowns.length > 0 && (
                                    <>
                                        <Button size="sm" variant="text" onClick={() => setShowExpenseBreakdown(v => !v)}>
                                            {showExpenseBreakdown ? 'Hide split details' : 'Show split details'}
                                        </Button>
                                        {showExpenseBreakdown && (
                                            <div className={styles.breakdownList}>
                                                {settlement.expenseBreakdowns.map(expense => (
                                                    <div key={`breakdown-${expense.expenseId}`} className={styles.breakdownItem}>
                                                        <div className={styles.breakdownHead}>
                                                            <strong>{expense.note || 'Expense'}</strong>
                                                            <span>
                                                                {expense.amount} {expense.currency}
                                                            </span>
                                                        </div>
                                                        <p className={styles.helperText}>
                                                            Paid by {expense.payerDisplayName} · {expense.amountHome} {expense.homeCurrency}
                                                        </p>
                                                        <div className={styles.breakdownShares}>
                                                            {expense.shares.map(share => (
                                                                <span key={`share-${expense.expenseId}-${share.userId}`} className={styles.shareChip}>
                                                                    {share.displayName}: {share.amount} {expense.homeCurrency}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
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
                    enableComments
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
