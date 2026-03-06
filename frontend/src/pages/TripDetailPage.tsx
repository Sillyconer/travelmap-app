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

export const TripDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { trips, updateTrip: updateTripInStore } = useStore();

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

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const loadTrip = async () => {
            // Check if we already loaded it
            if (trip && trip.id === Number(id)) return;

            // Try local store first as initial state
            const localTrip = trips.find((t: Trip) => t.id === Number(id));
            if (localTrip && localTrip.places) {
                setTrip(localTrip);
                setIsLoading(false);
                return; // Prevent infinite re-fetching
            }

            try {
                const freshData = await api.getTrip(Number(id));
                setTrip(freshData);
                updateTripInStore(freshData);
            } catch (err) {
                showSnackbar('Failed to load trip details');
                navigate('/trips');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) loadTrip();
    }, [id, trips, navigate, updateTripInStore, trip]);

    const handleAddPlace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trip || !placeName.trim() || !placeLat || !placeLng) return;

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

    const handleDownloadAllPhotos = () => {
        if (!trip || trip.photos.length === 0) return;
        const url = `http://localhost:8000/api/trips/${trip.id}/photos/download`;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
                    <Button onClick={() => setIsAddPlaceOpen(true)}>+ Add Place</Button>
                </div>
            </motion.header>

            <div className={styles.contentGrid}>

                {/* Left Column: Places Timeline */}
                <section className={styles.placesSection}>
                    <div className={styles.sectionHeader}>
                        <h2>Itinerary ({trip.places.length})</h2>
                        {/* Reordering functionality will be added in Phase 3 with @dnd-kit */}
                        {trip.places.length > 1 && <Button variant="text" size="sm">Reorder</Button>}
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
