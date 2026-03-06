import { useState, useCallback, useRef } from 'react';
import { MdCloudUpload } from 'react-icons/md';
import styles from './UploadZone.module.css';

interface UploadZoneProps {
    onFilesAdded: (files: File[]) => void;
    maxFiles?: number;
    accept?: string;
}

export const UploadZone = ({ onFilesAdded, maxFiles = 50, accept = 'image/*' }: UploadZoneProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).slice(0, maxFiles);
            onFilesAdded(files);
            e.dataTransfer.clearData();
        }
    }, [onFilesAdded, maxFiles]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).slice(0, maxFiles);
            onFilesAdded(files);
        }
        // Reset the input so the same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onFilesAdded, maxFiles]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div
            className={`${styles.uploadZone} ${isDragging ? styles.dragging : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                onChange={handleChange}
                className={styles.fileInput}
            />
            <div className={styles.content}>
                <MdCloudUpload className={styles.icon} />
                <h3>Drop photos here or click to browse</h3>
                <p>Supports JPEG, PNG, HEIC, AVIF, WebP (Max {maxFiles} at once)</p>
            </div>
        </div>
    );
};
