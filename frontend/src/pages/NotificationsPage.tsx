import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { showSnackbar } from '../components/ui/Snackbar';
import * as api from '../api/client';
import type { NotificationItem } from '../types/models';
import styles from './NotificationsPage.module.css';

const toTime = (value: string) => {
    const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const NotificationsPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    const unreadCount = useMemo(() => items.filter(item => !item.isRead).length, [items]);

    const load = async (unreadOnly: boolean) => {
        setIsLoading(true);
        try {
            const notifications = await api.getNotifications({ limit: 100, unreadOnly });
            setItems(notifications);
        } catch (err: any) {
            showSnackbar(`Failed to load notifications: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load(showUnreadOnly);
    }, [showUnreadOnly]);

    const markOneRead = async (id: number) => {
        setIsSubmitting(true);
        try {
            await api.markNotificationsRead([id]);
            setItems(prev => prev.map(item => (item.id === id ? { ...item, isRead: true } : item)));
            window.dispatchEvent(new Event('notifications:changed'));
        } catch (err: any) {
            showSnackbar(`Failed to mark notification: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const markAllRead = async () => {
        setIsSubmitting(true);
        try {
            await api.markAllNotificationsRead();
            setItems(prev => prev.map(item => ({ ...item, isRead: true })));
            window.dispatchEvent(new Event('notifications:changed'));
            showSnackbar('All notifications marked as read');
        } catch (err: any) {
            showSnackbar(`Failed to mark all as read: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const routeForNotification = (item: NotificationItem): string | null => {
        const payload = item.payload as Record<string, unknown>;
        const tripId = payload.tripId;
        if (typeof tripId === 'number') {
            return `/trips/${tripId}`;
        }

        const entityType = payload.entityType;
        const entityId = payload.entityId;
        if (entityType === 'trip' && typeof entityId === 'number') {
            return `/trips/${entityId}`;
        }
        if (entityType === 'photo') {
            const photoId = typeof payload.photoId === 'number' ? payload.photoId : (typeof entityId === 'number' ? entityId : null);
            return photoId ? `/photos?photoId=${photoId}&mode=comments` : '/photos';
        }

        const username = payload.username;
        if (typeof username === 'string' && username.trim()) {
            return `/profiles/${username}`;
        }

        const fromUsername = payload.fromUsername;
        if (typeof fromUsername === 'string' && fromUsername.trim()) {
            return `/profiles/${fromUsername}`;
        }

        if (item.type === 'friend_request_received' || item.type === 'friend_request_accepted') {
            return '/people';
        }

        return null;
    };

    const openNotificationTarget = async (item: NotificationItem) => {
        const route = routeForNotification(item);
        if (!route) {
            showSnackbar('No destination for this notification');
            return;
        }
        if (!item.isRead) {
            await markOneRead(item.id);
        }
        navigate(route);
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1>Notifications</h1>
                <div className={styles.actions}>
                    <label className={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            checked={showUnreadOnly}
                            onChange={e => setShowUnreadOnly(e.target.checked)}
                        />
                        Show unread only
                    </label>
                    <Button onClick={markAllRead} disabled={isSubmitting || unreadCount === 0}>Mark all read</Button>
                </div>
            </div>

            <p className={styles.meta}>{unreadCount} unread</p>

            {isLoading ? (
                <Card className={styles.empty}>Loading notifications...</Card>
            ) : items.length === 0 ? (
                <Card className={styles.empty}>No notifications yet.</Card>
            ) : (
                <div className={styles.list}>
                    {items.map(item => (
                        <Card key={item.id} className={`${styles.item} ${item.isRead ? styles.read : styles.unread}`}>
                            <div className={styles.itemHead}>
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.message}</p>
                                </div>
                                <span className={styles.date}>{toTime(item.updatedAt || item.createdAt)}</span>
                            </div>
                            <div className={styles.itemFoot}>
                                <span className={styles.type}>
                                    {item.type}{item.occurrenceCount > 1 ? ` · x${item.occurrenceCount}` : ''}
                                </span>
                                <div className={styles.inlineActions}>
                                    <Button onClick={() => openNotificationTarget(item)} disabled={isSubmitting}>Open</Button>
                                    {!item.isRead && (
                                        <Button onClick={() => markOneRead(item.id)} disabled={isSubmitting}>Mark read</Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
