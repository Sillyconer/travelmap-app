import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Modal.module.css';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    actions?: ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * TravelMap — M3 Dialog (Modal)
 * 
 * Uses Framer Motion for enter/exit animations and React Portals
 * to render outside the main DOM hierarchy.
 */
export const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    actions,
    width = 'md',
}: ModalProps) => {

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay}>
                    {/* Backdrop */}
                    <motion.div
                        className={styles.backdrop}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Dialog Container */}
                    <motion.div
                        className={`${styles.dialog} ${styles[width]}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="dialog-title"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className={styles.header}>
                            <h2 id="dialog-title" className={styles.title}>{title}</h2>
                            <Button
                                variant="text"
                                onClick={onClose}
                                className={styles.closeBtn}
                                aria-label="Close dialog"
                            >
                                ✕
                            </Button>
                        </div>

                        {/* Content Area */}
                        <div className={styles.content}>
                            {children}
                        </div>

                        {/* Action Area (Optional) */}
                        {actions && (
                            <div className={styles.actions}>
                                {actions}
                            </div>
                        )}

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    // Render modal into document body using a Portal
    return createPortal(modalContent, document.body);
};
