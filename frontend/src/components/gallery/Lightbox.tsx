import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose, MdChevronLeft, MdChevronRight, MdFileDownload, MdLocationOn, MdLocationOff } from 'react-icons/md';
import * as api from '../../api/client';
import type { CommentItem, PhotoOut } from '../../types/models';
import styles from './Lightbox.module.css';

interface LightboxProps {
    photos: PhotoOut[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (newIndex: number) => void;
    enableComments?: boolean;
}

export const Lightbox = ({ photos, currentIndex, onClose, onNavigate, enableComments = false }: LightboxProps) => {
    const photo = photos[currentIndex];
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [commentBody, setCommentBody] = useState('');
    const [isCommentsLoading, setIsCommentsLoading] = useState(false);

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

    useEffect(() => {
        const loadComments = async () => {
            if (!enableComments || !photo) {
                setComments([]);
                return;
            }
            setIsCommentsLoading(true);
            try {
                const list = await api.getComments('photo', photo.id);
                setComments(list);
            } catch {
                setComments([]);
            } finally {
                setIsCommentsLoading(false);
            }
        };
        loadComments();
    }, [enableComments, photo?.id]);

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

    const handleCreateComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo || !commentBody.trim()) return;
        try {
            const created = await api.createComment('photo', photo.id, commentBody.trim());
            setComments(prev => [...prev, created]);
            setCommentBody('');
        } catch {
            // no-op in lightbox
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.deleteComment(commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch {
            // no-op in lightbox
        }
    };

    const handleReact = async (commentId: number, emoji: string) => {
        try {
            const reactions = await api.toggleCommentReaction(commentId, emoji);
            setComments(prev => prev.map(c => (c.id === commentId ? { ...c, reactions } : c)));
        } catch {
            // no-op in lightbox
        }
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

                {enableComments && (
                    <aside className={styles.commentsPanel} onClick={(e) => e.stopPropagation()}>
                        <h3>Photo discussion</h3>
                        <form className={styles.commentForm} onSubmit={handleCreateComment}>
                            <input
                                value={commentBody}
                                onChange={e => setCommentBody(e.target.value)}
                                placeholder="Add a comment"
                                maxLength={1000}
                            />
                            <button type="submit" disabled={!commentBody.trim()}>Post</button>
                        </form>
                        <div className={styles.commentList}>
                            {isCommentsLoading && <p>Loading...</p>}
                            {!isCommentsLoading && comments.length === 0 && <p>No comments yet.</p>}
                            {comments.map(comment => (
                                <div key={comment.id} className={styles.commentItem}>
                                    <div className={styles.commentHead}>
                                        <strong>{comment.displayName}</strong>
                                        <small>@{comment.username}</small>
                                    </div>
                                    <p>{comment.body}</p>
                                    <div className={styles.commentActions}>
                                        <button type="button" onClick={() => handleReact(comment.id, '👍')}>
                                            👍 {comment.reactions.find(r => r.emoji === '👍')?.count || 0}
                                        </button>
                                        <button type="button" onClick={() => handleReact(comment.id, '❤️')}>
                                            ❤️ {comment.reactions.find(r => r.emoji === '❤️')?.count || 0}
                                        </button>
                                        {comment.canDelete && (
                                            <button type="button" onClick={() => handleDeleteComment(comment.id)}>Delete</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </motion.div>
        </AnimatePresence>
    );
};
