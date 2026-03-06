import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { PhotoGrid } from '../components/gallery/PhotoGrid';
import { Lightbox } from '../components/gallery/Lightbox';
import { useState, useMemo, useEffect } from 'react';
import type { Trip, PhotoOut } from '../types/models';
import { Button } from '../components/ui/Button';
import { MdDownload, MdArrowBack } from 'react-icons/md';
import styles from './AlbumDetailPage.module.css';
import * as api from '../api/client';
import { showSnackbar } from '../components/ui/Snackbar';

export const AlbumDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { trips, updateTrip } = useStore();

    const [trip, setTrip] = useState<Trip | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    useEffect(() => {
        const loadTrip = async () => {
            if (trip && trip.id === Number(id)) return;

            const localTrip = trips.find((t: Trip) => t.id === Number(id));
            if (localTrip && localTrip.places) {
                setTrip(localTrip);
                setIsLoading(false);
                return;
            }

            try {
                const freshData = await api.getTrip(Number(id));
                setTrip(freshData);
                updateTrip(freshData);
            } catch (err) {
                showSnackbar('Failed to load album details');
                navigate('/albums');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) loadTrip();
    }, [id, trips, navigate, updateTrip, trip]);

    // Group photos by Place, and a group for "Unlocated"
    const groupedPhotos = useMemo(() => {
        if (!trip) return [];

        const groups = new Map<number | null, PhotoOut[]>();
        for (const photo of trip.photos) {
            const key = photo.placeId ?? null;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(photo);
        }

        // Convert to array in order of trip places, then unlocated
        const result: { title: string; photos: PhotoOut[] }[] = [];

        // Order by itinerary places
        for (const place of trip.places) {
            if (groups.has(place.id)) {
                result.push({
                    title: place.name,
                    photos: groups.get(place.id)!
                });
                groups.delete(place.id);
            }
        }

        // Unlocated or deleted places
        if (groups.has(null) || groups.size > 0) {
            const remaining = Array.from(groups.values()).flat();
            if (remaining.length > 0) {
                result.push({
                    title: "Unlocated / Overview",
                    photos: remaining
                });
            }
        }

        return result;
    }, [trip]);

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
        return <div className={styles.loading}>Loading album...</div>;
    }

    if (!trip) return null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerNav}>
                    <Button variant="text" onClick={() => navigate('/albums')} className={styles.backBtn}>
                        <MdArrowBack /> Albums
                    </Button>
                    <div className={styles.actions}>
                        <Button
                            variant="text"
                            onClick={handleDownloadAllPhotos}
                            disabled={trip.photos.length === 0}
                        >
                            <MdDownload style={{ marginRight: 8 }} /> Download ZIP
                        </Button>
                    </div>
                </div>

                <h1 className={styles.title}>{trip.name}</h1>
                <div className={styles.meta}>
                    <span>{trip.photos.length} photos</span>
                    <span>•</span>
                    <span>{trip.places.length} locations</span>
                </div>
            </header>

            <main className={styles.content}>
                {trip.photos.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No photos have been uploaded to this trip yet.</p>
                        <Button onClick={() => navigate(`/trips/${trip.id}`)}>Go to Trip Details to Upload</Button>
                    </div>
                ) : (
                    groupedPhotos.map(group => (
                        <section key={group.title} className={styles.groupSection}>
                            <h2 className={styles.groupTitle}>{group.title}</h2>
                            <PhotoGrid
                                photos={group.photos}
                                onPhotoClick={(indexInGroup) => {
                                    // Map local index to the global index in trip.photos
                                    const photo = group.photos[indexInGroup];
                                    const globalIndex = trip.photos.findIndex(p => p.id === photo.id);
                                    if (globalIndex !== -1) setLightboxIndex(globalIndex);
                                }}
                            />
                        </section>
                    ))
                )}
            </main>

            {lightboxIndex !== null && (
                <Lightbox
                    photos={trip.photos}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={(newIndex) => setLightboxIndex(newIndex)}
                />
            )}
        </div>
    );
};
