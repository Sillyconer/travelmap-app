import { useState, useEffect } from 'react';
import exifr from 'exifr';
import { MdDelete, MdLocationOff, MdCloudUpload } from 'react-icons/md';
import styles from './StagingTable.module.css';
import type { Place } from '../../types/models';

export interface StagedPhoto {
    id: string;
    file: File;
    previewUrl: string;
    lat: number | null;
    lng: number | null;
    takenAt: number | null;
    placeId: number | null;
    status: 'staging' | 'uploading' | 'success' | 'error';
    progress: number;
}

interface StagingTableProps {
    files: File[];
    places: Place[];
    onUpload: (stagedPhotos: StagedPhoto[]) => void;
    onRemove: (id: string) => void;
}

export const StagingTable = ({ files, places, onUpload, onRemove }: StagingTableProps) => {
    const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Process new files to extract EXIF and make previews
    useEffect(() => {
        if (files.length === 0) return;

        let isMounted = true;
        setIsProcessing(true);

        const processFiles = async () => {
            const newStaged: StagedPhoto[] = [];

            for (const file of files) {
                // Skip if already staged
                if (stagedPhotos.some(p => p.file.name === file.name && p.file.size === file.size)) {
                    continue;
                }

                // Create object URL for preview
                const previewUrl = URL.createObjectURL(file);

                let lat: number | null = null;
                let lng: number | null = null;
                let takenAt: number | null = null;

                try {
                    // Extract GPS and Date
                    const gps = await exifr.gps(file);
                    if (gps) {
                        lat = gps.latitude;
                        lng = gps.longitude;
                    }
                    const parsed = await exifr.parse(file, ['DateTimeOriginal']);
                    if (parsed && parsed.DateTimeOriginal) {
                        takenAt = new Date(parsed.DateTimeOriginal).getTime();
                    }
                } catch (e) {
                    console.warn(`Failed to parse EXIF for ${file.name}`, e);
                }

                // Autodetect place if close enough? (Simplified for now)
                let placeId: number | null = null;

                newStaged.push({
                    id: `${file.name}-${file.size}-${Date.now()}`,
                    file,
                    previewUrl,
                    lat,
                    lng,
                    takenAt,
                    placeId,
                    status: 'staging',
                    progress: 0
                });
            }

            if (isMounted && newStaged.length > 0) {
                setStagedPhotos(prev => [...prev, ...newStaged]);
            }
            if (isMounted) setIsProcessing(false);
        };

        processFiles();

        return () => {
            isMounted = false;
        };
        // We only want to run this when `files` completely changes identity or length, 
        // but React strict mode makes this tricky. We depend on files array explicitly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files]);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            stagedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
        };
    }, [stagedPhotos]);

    const handlePlaceChange = (id: string, placeIdStr: string) => {
        const pId = placeIdStr === 'unlocated' ? null : parseInt(placeIdStr, 10);
        setStagedPhotos(prev => prev.map(p => p.id === id ? { ...p, placeId: pId } : p));
    };

    const handleRemove = (id: string) => {
        setStagedPhotos(prev => prev.filter(p => p.id !== id));
        onRemove(id);
    };

    const handleUploadAll = () => {
        onUpload(stagedPhotos.filter(p => p.status === 'staging' || p.status === 'error'));
    };

    if (stagedPhotos.length === 0 && !isProcessing) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Staging ({stagedPhotos.length} photos)</h3>
                <button
                    onClick={handleUploadAll}
                    disabled={isProcessing || stagedPhotos.every(p => p.status === 'success')}
                    className={styles.uploadBtn}
                >
                    <MdCloudUpload /> Upload All
                </button>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Filename</th>
                            <th>Location/GPS</th>
                            <th>Assign to Place</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {stagedPhotos.map(photo => (
                            <tr key={photo.id}>
                                <td className={styles.previewCell}>
                                    <img src={photo.previewUrl} alt="Preview" className={styles.preview} />
                                </td>
                                <td>
                                    <div className={styles.filename} title={photo.file.name}>
                                        {photo.file.name}
                                    </div>
                                    <div className={styles.filesize}>
                                        {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                </td>
                                <td>
                                    {photo.lat && photo.lng ? (
                                        <span className={styles.gpsBadge}>Has GPS</span>
                                    ) : (
                                        <span className={styles.noGpsBadge}><MdLocationOff /> No GPS</span>
                                    )}
                                </td>
                                <td>
                                    <select
                                        value={photo.placeId === null ? 'unlocated' : photo.placeId}
                                        onChange={(e) => handlePlaceChange(photo.id, e.target.value)}
                                        className={styles.select}
                                        disabled={photo.status === 'uploading' || photo.status === 'success'}
                                    >
                                        <option value="unlocated">Unlocated</option>
                                        {places.map(place => (
                                            <option key={place.id} value={place.id}>{place.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    {photo.status === 'uploading' && <span className={styles.uploading}>Uploading... {photo.progress}%</span>}
                                    {photo.status === 'success' && <span className={styles.success}>Success</span>}
                                    {photo.status === 'error' && <span className={styles.error}>Error</span>}
                                    {photo.status === 'staging' && <span className={styles.staging}>Ready</span>}
                                </td>
                                <td>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleRemove(photo.id)}
                                        disabled={photo.status === 'uploading'}
                                    >
                                        <MdDelete />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
