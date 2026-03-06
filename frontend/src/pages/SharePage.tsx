import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '../api/client';
import { Lightbox } from '../components/gallery/Lightbox';
import styles from './SharePage.module.css';

/**
 * SharePage — Standalone public viewer for shared photos/albums.
 *
 * Rendered OUTSIDE the app Layout (no sidebar, no navigation).
 * Shows a clean, dark, centered view of the shared content.
 */

interface ShareData {
    type: 'photo' | 'album';
    photo?: any;
    trip?: any;
    link: any;
}

export const SharePage = () => {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<ShareData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!token) return;

        const load = async () => {
            try {
                const result = await api.resolveShareLink(token);
                setData(result);

                // Set page title for social sharing / tab
                if (result.type === 'photo') {
                    document.title = `${result.photo.name} — Shared via TravelMap`;
                } else if (result.type === 'album') {
                    document.title = `${result.trip.name} Album — Shared via TravelMap`;
                }
            } catch (err: any) {
                setError(err.status === 404
                    ? 'This share link has expired or been revoked.'
                    : 'Failed to load shared content.'
                );
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [token]);

    if (isLoading) {
        return (
            <div className={styles.shareContainer}>
                <div className={styles.loading}>
                    <div>Loading shared content...</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={styles.shareContainer}>
                <div className={styles.error}>
                    <div style={{ fontSize: 48 }}>🔗</div>
                    <div>{error || 'Content not found'}</div>
                </div>
            </div>
        );
    }

    // ── Photo View ──
    if (data.type === 'photo' && data.photo) {
        const photo = data.photo;
        const photoUrl = `http://localhost:8000${photo.url}`;
        const takenDate = photo.takenAt
            ? new Date(photo.takenAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
            })
            : null;

        return (
            <div className={styles.shareContainer}>
                <div className={styles.photoViewer}>
                    <img
                        src={photoUrl}
                        alt={photo.name}
                        className={styles.sharedPhoto}
                    />
                    <div className={styles.photoMeta}>
                        <h1 className={styles.photoName}>{photo.name}</h1>
                        <div className={styles.photoDetails}>
                            {takenDate && <span>{takenDate}</span>}
                            {photo.width > 0 && (
                                <span>{photo.width} × {photo.height}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.footer}>Shared via TravelMap</div>
            </div>
        );
    }

    // ── Album View ──
    if (data.type === 'album' && data.trip) {
        const trip = data.trip;
        const photos = trip.photos || [];

        return (
            <div className={styles.shareContainer}>
                <div className={styles.albumViewer}>
                    <div className={styles.albumHeader}>
                        <div
                            className={styles.albumColorBar}
                            style={{ backgroundColor: trip.color }}
                        />
                        <h1 className={styles.albumTitle}>{trip.name}</h1>
                        <p className={styles.albumSubtitle}>
                            {photos.length} photo{photos.length !== 1 ? 's' : ''}
                            {trip.startDate && ` · ${new Date(trip.startDate).toLocaleDateString()}`}
                            {trip.endDate && ` – ${new Date(trip.endDate).toLocaleDateString()}`}
                        </p>
                    </div>

                    {photos.length === 0 ? (
                        <div className={styles.loading}>
                            <p>This album has no photos yet.</p>
                        </div>
                    ) : (
                        <div className={styles.albumGrid}>
                            {photos.map((photo: any, index: number) => (
                                <div
                                    key={photo.id}
                                    className={styles.albumPhoto}
                                    onClick={() => setLightboxIndex(index)}
                                >
                                    <img
                                        src={`http://localhost:8000${photo.thumbUrl}`}
                                        alt={photo.name}
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>Shared via TravelMap</div>

                {lightboxIndex !== null && (
                    <Lightbox
                        photos={photos}
                        currentIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                        onNavigate={(i) => setLightboxIndex(i)}
                    />
                )}
            </div>
        );
    }

    return null;
};
