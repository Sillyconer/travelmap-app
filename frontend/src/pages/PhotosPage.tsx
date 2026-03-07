import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import { Lightbox } from '../components/gallery/Lightbox';
import { MdDownload, MdLocationOff, MdCheckCircle, MdChatBubbleOutline, MdDeleteOutline } from 'react-icons/md';
import { showSnackbar } from '../components/ui/Snackbar';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import styles from './PhotosPage.module.css';
import type { CommentItem, LibraryPhoto, Trip } from '../types/models';

export const PhotosPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [trips, setTrips] = useState<Trip[]>([]);

    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignTripId, setAssignTripId] = useState<number | null>(null);
    const [assignPlaceId, setAssignPlaceId] = useState<number | null>(null);
    const [assigningIds, setAssigningIds] = useState<number[]>([]);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const [commentPhoto, setCommentPhoto] = useState<LibraryPhoto | null>(null);
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [commentBody, setCommentBody] = useState('');
    const [isCommentLoading, setIsCommentLoading] = useState(false);
    const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});

    const assignableTrips = useMemo(() => trips.filter(trip => trip.accessRole !== 'viewer'), [trips]);

    useEffect(() => {
        const loadPhotos = async () => {
            try {
                const data = await api.getAllPhotos();
                setPhotos(data);
                const loadedTrips = await api.getTrips();
                setTrips(loadedTrips);
                if (data.length > 0) {
                    const counts = await api.getCommentCounts('photo', data.map(p => p.id));
                    const parsed: Record<number, number> = {};
                    for (const [key, value] of Object.entries(counts)) {
                        parsed[Number(key)] = value;
                    }
                    setCommentCounts(parsed);
                }
            } catch (err) {
                console.error("Failed to load photos", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadPhotos();
    }, []);

    useEffect(() => {
        const photoIdRaw = searchParams.get('photoId');
        const mode = searchParams.get('mode');
        if (!photoIdRaw || mode !== 'comments' || photos.length === 0) {
            return;
        }
        const photoId = Number(photoIdRaw);
        if (!Number.isFinite(photoId)) {
            return;
        }
        const target = photos.find(photo => photo.id === photoId);
        if (!target) {
            return;
        }
        openCommentModal(target);
        setSearchParams({}, { replace: true });
    }, [photos, searchParams]);

    const handlePhotoClick = (index: number, photoId: number) => {
        if (isSelectionMode) {
            toggleSelection(photoId);
        } else {
            setLightboxIndex(index);
        }
    };

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
        if (newSet.size === 0) {
            setIsSelectionMode(false);
        }
    };

    const handleLongPress = (id: number) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            toggleSelection(id);
        }
    };

    const handleSharePhoto = async (photoId: number) => {
        try {
            const result = await api.createShareLink({ type: 'photo', photoId });
            const fullUrl = `${window.location.origin}${result.url}`;
            await navigator.clipboard.writeText(fullUrl);
            showSnackbar('Share link copied to clipboard!');
        } catch {
            showSnackbar('Failed to create share link');
        }
    };

    const handleDownloadSelected = async () => {
        if (selectedIds.size === 0) return;

        // Group selected photos by tripId to download zip per trip, or download sequentially 
        // if the API requires tripId. The API is /api/trips/{trip_id}/photos/download.
        // We'll iterate through distinct trips and trigger downloads.
        const photosToDownload = photos.filter(p => selectedIds.has(p.id));
        const tripsToPhotos = new Map<number, number[]>();

        for (const photo of photosToDownload) {
            if (photo.tripId === null) {
                continue;
            }
            if (!tripsToPhotos.has(photo.tripId)) {
                tripsToPhotos.set(photo.tripId, []);
            }
            tripsToPhotos.get(photo.tripId)!.push(photo.id);
        }

        if (tripsToPhotos.size === 0) {
            showSnackbar('Selected photos are not assigned to trips yet');
            return;
        }

        try {
            for (const [tripId, pIds] of tripsToPhotos.entries()) {
                const blob = await api.downloadTripPhotosZip(tripId, pIds);
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = `trip_${tripId}_photos.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
            }
        } catch (err: any) {
            showSnackbar(`Download failed: ${err.message || 'Unknown error'}`);
            return;
        }

        // Clear selection after download
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const openCommentModal = async (photo: LibraryPhoto) => {
        setCommentPhoto(photo);
        setIsCommentOpen(true);
        setCommentBody('');
        setIsCommentLoading(true);
        try {
            const list = await api.getComments('photo', photo.id);
            setComments(list);
        } catch (err: any) {
            showSnackbar(`Failed to load comments: ${err.message}`);
            setComments([]);
        } finally {
            setIsCommentLoading(false);
        }
    };

    const handleAddPhotoComment = async () => {
        if (!commentPhoto || !commentBody.trim()) return;
        try {
            const created = await api.createComment('photo', commentPhoto.id, commentBody.trim());
            setComments(prev => [...prev, created]);
            setCommentCounts(prev => ({ ...prev, [commentPhoto.id]: (prev[commentPhoto.id] || 0) + 1 }));
            setCommentBody('');
            showSnackbar('Comment posted');
        } catch (err: any) {
            showSnackbar(`Failed to post comment: ${err.message}`);
        }
    };

    const handleDeletePhotoComment = async (commentId: number) => {
        try {
            await api.deleteComment(commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            if (commentPhoto) {
                setCommentCounts(prev => ({ ...prev, [commentPhoto.id]: Math.max(0, (prev[commentPhoto.id] || 1) - 1) }));
            }
        } catch (err: any) {
            showSnackbar(`Failed to delete comment: ${err.message}`);
        }
    };

    const handleTogglePhotoReaction = async (commentId: number, emoji: string) => {
        try {
            const reactions = await api.toggleCommentReaction(commentId, emoji);
            setComments(prev => prev.map(c => (c.id === commentId ? { ...c, reactions } : c)));
        } catch (err: any) {
            showSnackbar(`Failed to react: ${err.message}`);
        }
    };

    const handleUploadFromLibrary = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);

        try {
            const uploaded: LibraryPhoto[] = [];
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);
                const photo = await api.uploadUnattachedPhoto(formData);
                uploaded.push({ ...photo, tripId: photo.tripId ?? null, tripName: photo.tripName ?? 'Unassigned' });
            }

            setPhotos(prev => [...uploaded, ...prev]);
            showSnackbar(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'}`);
        } catch (err) {
            console.error('Upload failed', err);
            showSnackbar('Failed to upload one or more photos');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setIsUploading(false);
        }
    };

    const openAssignModal = () => {
        if (assignableTrips.length === 0) {
            showSnackbar('You do not have edit access to any trips yet');
            return;
        }
        const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (lightboxIndex !== null ? [photos[lightboxIndex].id] : []);
        if (targetIds.length === 0) {
            showSnackbar('Select one or more photos first');
            return;
        }
        setAssigningIds(targetIds);
        setAssignTripId(null);
        setAssignPlaceId(null);
        setIsAssignOpen(true);
    };

    const handleAssign = async () => {
        if (!assignTripId || assigningIds.length === 0) return;
        try {
            await Promise.all(assigningIds.map(photoId => api.assignPhoto(photoId, assignTripId, assignPlaceId)));
            const assignedTrip = trips.find(t => t.id === assignTripId);
            setPhotos(prev => prev.map(p => assigningIds.includes(p.id)
                ? { ...p, tripId: assignTripId, tripName: assignedTrip?.name ?? 'Assigned Trip', placeId: assignPlaceId ?? undefined }
                : p
            ));
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            setIsAssignOpen(false);
            showSnackbar(`Assigned ${assigningIds.length} photo${assigningIds.length === 1 ? '' : 's'}`);
        } catch {
            showSnackbar('Failed to assign photos');
        }
    };

    const selectedAssignableTrip = assignableTrips.find(t => t.id === assignTripId);

    // Group photos by month/year (takenAt if available, otherwise "Unknown Date")
    const groupedPhotos = useMemo(() => {
        const groups = new Map<string, LibraryPhoto[]>();

        for (const photo of photos) {
            let key = "Unknown Date";
            if (photo.takenAt) {
                const date = new Date(photo.takenAt);
                key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
            }
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(photo);
        }

        // Maintain the order of groups based on the first photo's timestamp in that group
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === "Unknown Date") return 1;
            if (b === "Unknown Date") return -1;
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            return dateB - dateA; // Descending
        });

        return sortedKeys.map(key => ({
            label: key,
            photos: groups.get(key)!
        }));
    }, [photos]);

    if (isLoading) {
        return <div className={styles.loading}>Loading library...</div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Photo Library</h1>
                <div className={styles.actions}>
                    {isSelectionMode ? (
                        <>
                            <span className={styles.selectionCount}>{selectedIds.size} selected</span>
                            <button
                                className={`${styles.btnBase} ${styles.downloadBtn}`}
                                onClick={handleDownloadSelected}
                                disabled={selectedIds.size === 0}
                            >
                                <MdDownload /> Download Selected
                            </button>
                            <button
                                className={`${styles.btnBase} ${styles.assignBtn}`}
                                onClick={openAssignModal}
                                disabled={selectedIds.size === 0 || assignableTrips.length === 0}
                            >
                                Assign to Trip
                            </button>
                            <button
                                className={`${styles.btnBase} ${styles.cancelBtn}`}
                                onClick={() => {
                                    setIsSelectionMode(false);
                                    setSelectedIds(new Set());
                                }}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => handleUploadFromLibrary(e.target.files)}
                            />
                            <button
                                className={`${styles.btnBase} ${styles.uploadBtn}`}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload Photos'}
                            </button>
                            <button
                                className={`${styles.btnBase} ${styles.assignBtn}`}
                                onClick={openAssignModal}
                                disabled={photos.length === 0 || assignableTrips.length === 0}
                            >
                                Assign
                            </button>
                            <button
                                className={`${styles.btnBase} ${styles.selectBtn}`}
                                onClick={() => setIsSelectionMode(true)}
                                disabled={photos.length === 0}
                            >
                                Select
                            </button>
                        </>
                    )}
                </div>
            </header>

            <main className={styles.content}>
                {photos.length === 0 ? (
                        <div className={styles.emptyState}>
                        <p>Your photo library is empty. Upload photos to start building your collection.</p>
                    </div>
                ) : (
                    groupedPhotos.map(group => (
                        <div key={group.label} className={styles.group}>
                            <h2 className={styles.groupLabel}>{group.label}</h2>
                            <div
                                className={styles.grid}
                            >
                                {group.photos.map((photo) => {
                                    // Calculate the global index for the lightbox
                                    const globalIndex = photos.findIndex(p => p.id === photo.id);
                                    const isSelected = selectedIds.has(photo.id);

                                    return (
                                        <div
                                            key={photo.id}
                                            className={`${styles.photoContainer} ${isSelected ? styles.selected : ''}`}
                                            onClick={() => handlePhotoClick(globalIndex, photo.id)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                if (isSelectionMode) {
                                                    handleLongPress(photo.id);
                                                } else {
                                                    handleSharePhoto(photo.id);
                                                }
                                            }}
                                        >
                                            <img
                                                src={`http://localhost:8000${photo.thumbUrl}`}
                                                alt={photo.name}
                                                className={styles.thumbnail}
                                                loading="lazy"
                                            />
                                            {photo.placeId === null && (
                                                <div className={styles.noLocationBadge} title="No location">
                                                    <MdLocationOff />
                                                </div>
                                            )}
                                            {!isSelectionMode && (
                                                <button
                                                    type="button"
                                                    className={styles.commentBadge}
                                                    title="Comments"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openCommentModal(photo);
                                                    }}
                                                >
                                                    <MdChatBubbleOutline />
                                                    {(commentCounts[photo.id] || 0) > 0 && (
                                                        <span className={styles.commentCount}>{commentCounts[photo.id]}</span>
                                                    )}
                                                </button>
                                            )}
                                            {isSelectionMode && (
                                                <div className={styles.selectionOverlay}>
                                                    {isSelected && <MdCheckCircle className={styles.checkIcon} />}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </main>

            {lightboxIndex !== null && (
                <Lightbox
                    photos={photos}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={(newIndex) => setLightboxIndex(newIndex)}
                    enableComments
                />
            )}

            <Modal
                isOpen={isAssignOpen}
                onClose={() => setIsAssignOpen(false)}
                title="Assign Photos"
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssign} disabled={!assignTripId}>Assign</Button>
                    </>
                }
            >
                <div className={styles.assignForm}>
                    <label>
                        Trip
                        <select value={assignTripId ?? ''} onChange={(e) => setAssignTripId(e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Select a trip</option>
                            {assignableTrips.map(trip => (
                                <option key={trip.id} value={trip.id}>{trip.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Place (optional)
                        <select value={assignPlaceId ?? ''} onChange={(e) => setAssignPlaceId(e.target.value ? Number(e.target.value) : null)} disabled={!selectedAssignableTrip}>
                            <option value="">No place</option>
                            {selectedAssignableTrip?.places.map(place => (
                                <option key={place.id} value={place.id}>{place.name}</option>
                            ))}
                        </select>
                    </label>
                    <p className={styles.assignInfo}>{assigningIds.length} photo(s) will be assigned.</p>
                </div>
            </Modal>

            <Modal
                isOpen={isCommentOpen}
                onClose={() => setIsCommentOpen(false)}
                title={commentPhoto ? `Comments · ${commentPhoto.name}` : 'Comments'}
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsCommentOpen(false)}>Close</Button>
                        <Button onClick={handleAddPhotoComment} disabled={!commentBody.trim()}>Post</Button>
                    </>
                }
            >
                <div className={styles.commentModalBody}>
                    <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        className={styles.commentInput}
                        placeholder="Add a comment"
                        maxLength={1000}
                    />
                    <div className={styles.commentList}>
                        {isCommentLoading && <p className={styles.assignInfo}>Loading comments...</p>}
                        {!isCommentLoading && comments.length === 0 && <p className={styles.assignInfo}>No comments yet.</p>}
                        {comments.map(comment => (
                            <div key={comment.id} className={styles.commentItem}>
                                <div className={styles.commentHead}>
                                    <strong>{comment.displayName}</strong>
                                    <small>@{comment.username}</small>
                                </div>
                                <p>{comment.body}</p>
                                <div className={styles.commentActions}>
                                    <button type="button" onClick={() => handleTogglePhotoReaction(comment.id, '👍')}>
                                        👍 {comment.reactions.find(r => r.emoji === '👍')?.count || 0}
                                    </button>
                                    <button type="button" onClick={() => handleTogglePhotoReaction(comment.id, '❤️')}>
                                        ❤️ {comment.reactions.find(r => r.emoji === '❤️')?.count || 0}
                                    </button>
                                    {comment.canDelete && (
                                        <button type="button" onClick={() => handleDeletePhotoComment(comment.id)}>
                                            <MdDeleteOutline />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
