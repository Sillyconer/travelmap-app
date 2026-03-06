import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import type { Place } from '../../../types/models';
import styles from './SortablePlaceCard.module.css';

interface SortablePlaceCardProps {
    place: Place;
    index: number;
    total: number;
    tripColor: string;
    onDelete: (id: number) => void;
}

export const SortablePlaceCard = ({ place, index, total, tripColor, onDelete }: SortablePlaceCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: place.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.wrapper}>
            <Card className={`${styles.placeCard} ${isDragging ? styles.dragging : ''}`}>

                {/* Drag Handle */}
                <div className={styles.dragHandle} {...attributes} {...listeners}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--md-sys-color-on-surface-variant)">
                        <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                </div>

                {/* Timeline Node */}
                <div className={styles.timelineNode}>
                    <div className={styles.nodeCircle} style={{ borderColor: tripColor }} />
                    {index < total - 1 && <div className={styles.nodeLine} />}
                </div>

                {/* Content */}
                <div className={styles.placeContent}>
                    <div className={styles.placeHeader}>
                        <h3>{place.name}</h3>
                        <div className={styles.placeActions}>
                            <Button
                                variant="text"
                                size="sm"
                                onClick={() => onDelete(place.id)}
                                style={{ color: 'var(--md-sys-color-error)' }}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                    {place.note && <p className={styles.placeNote}>{place.note}</p>}
                    <div className={styles.placeCoords}>
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </div>
                </div>
            </Card>
        </div>
    );
};
