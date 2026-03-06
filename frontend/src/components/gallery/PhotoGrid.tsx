import type { PhotoOut } from '../../types/models';
import { MdLocationOff } from 'react-icons/md';
import styles from './PhotoGrid.module.css';

interface PhotoGridProps {
    photos: PhotoOut[];
    onPhotoClick?: (index: number) => void;
}

export const PhotoGrid = ({ photos, onPhotoClick }: PhotoGridProps) => {
    if (photos.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>No photos have been uploaded yet.</p>
            </div>
        );
    }

    return (
        <div className={styles.grid}>
            {photos.map((photo, i) => (
                <div
                    key={photo.id}
                    className={styles.photoContainer}
                    onClick={() => onPhotoClick && onPhotoClick(i)}
                >
                    <img
                        src={`http://localhost:8000${photo.thumbUrl}`}
                        alt={photo.name}
                        className={styles.thumbnail}
                        loading="lazy"
                    />
                    {/* Badge for photos with no location assigned */}
                    {photo.placeId === null && (
                        <div className={styles.noLocationBadge} title="No place assigned">
                            <MdLocationOff />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
