import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { MdPhotoLibrary } from 'react-icons/md';
import { motion } from 'framer-motion';
import styles from './AlbumsPage.module.css';

export const AlbumsPage = () => {
    const { trips } = useStore();
    const navigate = useNavigate();

    // Only show trips that actually have photos
    const albums = trips.filter(trip => trip.photos && trip.photos.length > 0);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Albums</h1>
                <p>Your photos organized by trip.</p>
            </header>

            <main className={styles.content}>
                {albums.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No albums yet. Upload photos to your trips to create albums automatically.</p>
                    </div>
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
                        {albums.map((trip) => {
                            // Use the first photo as the cover photo, or the latest taken
                            const coverPhoto = trip.photos.length > 0 ? trip.photos[0] : null;

                            return (
                                <motion.div
                                    key={trip.id}
                                    variants={{
                                        hidden: { opacity: 0, y: 20, scale: 0.95 },
                                        show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
                                    }}
                                    className={styles.albumCard}
                                    onClick={() => navigate(`/albums/${trip.id}`)}
                                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                >
                                    <div className={styles.coverContainer}>
                                        {coverPhoto ? (
                                            <img
                                                src={`http://localhost:8000${coverPhoto.thumbUrl}`}
                                                alt={`Cover for ${trip.name}`}
                                                className={styles.coverImage}
                                            />
                                        ) : (
                                            <div className={styles.placeholderCover}>
                                                <MdPhotoLibrary />
                                            </div>
                                        )}
                                        <div className={styles.photoCountBadge}>
                                            {trip.photos.length}
                                        </div>
                                    </div>
                                    <div className={styles.albumInfo}>
                                        <h3 className={styles.albumTitle}>{trip.name}</h3>
                                        <div className={styles.albumMeta}>
                                            {trip.startDate && new Date(trip.startDate).toLocaleDateString()}
                                            {trip.startDate && trip.endDate && ' - '}
                                            {trip.endDate && new Date(trip.endDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </main>
        </div>
    );
};
