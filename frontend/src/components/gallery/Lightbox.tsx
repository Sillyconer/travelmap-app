import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose, MdChevronLeft, MdChevronRight, MdFileDownload, MdLocationOn, MdLocationOff } from 'react-icons/md';
import type { PhotoOut } from '../../types/models';
import styles from './Lightbox.module.css';

interface LightboxProps {
    photos: PhotoOut[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (newIndex: number) => void;
}

export const Lightbox = ({ photos, currentIndex, onClose, onNavigate }: LightboxProps) => {
    const photo = photos[currentIndex];

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft') onNavigate((currentIndex - 1 + photos.length) % photos.length);
        if (e.key === 'ArrowRight') onNavigate((currentIndex + 1) % photos.length);
    }, [currentIndex, photos.length, onClose, onNavigate]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll when open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [handleKeyDown]);

    if (!photo) return null;

    const handlePrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigate((currentIndex - 1 + photos.length) % photos.length);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigate((currentIndex + 1) % photos.length);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Trigger direct download
        const a = document.createElement('a');
        a.href = `http://localhost:8000${photo.url}`;
        a.download = photo.filename; // Use explicit filename if API headers don't force it
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <AnimatePresence>
            <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                {/* Header Actions */}
                <div className={styles.header} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.counter}>
                        {currentIndex + 1} / {photos.length}
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.iconBtn} onClick={handleDownload} title="Download Original">
                            <MdFileDownload />
                        </button>
                        <button className={styles.iconBtn} onClick={onClose} title="Close (Esc)">
                            <MdClose />
                        </button>
                    </div>
                </div>

                {/* Left Arrow */}
                <button
                    className={`${styles.navBtn} ${styles.prevBtn}`}
                    onClick={handlePrevious}
                    title="Previous (Arrow Left)"
                >
                    <MdChevronLeft />
                </button>

                {/* Main Image Container */}
                <div className={styles.imageContainer} onClick={(e) => e.stopPropagation()}>
                    <motion.img
                        key={photo.id}
                        src={`http://localhost:8000${photo.url}`}
                        alt={photo.name}
                        className={styles.image}
                        layoutId={`photo-${photo.id}`} // Links thumbnail to lightbox if we wrapped the thumb in motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    />
                </div>

                {/* Right Arrow */}
                <button
                    className={`${styles.navBtn} ${styles.nextBtn}`}
                    onClick={handleNext}
                    title="Next (Arrow Right)"
                >
                    <MdChevronRight />
                </button>

                {/* Footer Metadata */}
                <div className={styles.footer} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.filename}>{photo.name}</div>
                    <div className={styles.metaRow}>
                        {photo.takenAt ? (
                            <span>{new Date(photo.takenAt).toLocaleString()}</span>
                        ) : (
                            <span>Date unknown</span>
                        )}
                        <span className={styles.divider}>•</span>
                        {photo.placeId !== null ? (
                            <span className={styles.locationMeta}><MdLocationOn /> Has Location</span>
                        ) : (
                            <span className={styles.locationMeta}><MdLocationOff /> Unlocated</span>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
