import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { usePersons } from '../features/persons/usePersons';
import { showSnackbar } from '../components/ui/Snackbar';
import * as api from '../api/client';
import type { Friend, FriendRequest } from '../types/models';
import styles from './ManagePersonsPage.module.css';

export const ManagePersonsPage = () => {
    const { persons, isLoading, createPerson, updatePerson, deletePerson } = usePersons();

    // State for Create Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#4A90D9');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for Delete Confirmation Modal
    const [personToDelete, setPersonToDelete] = useState<number | null>(null);

    // State for Edit Modal
    const [editingPerson, setEditingPerson] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#4A90D9');

    const [friendUsername, setFriendUsername] = useState('');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);

    const owner = persons.find(p => p.isOwner);
    const companions = persons.filter(p => !p.isOwner);
    const sortedPersons = owner ? [owner, ...companions] : persons;

    const loadSocial = async () => {
        try {
            const [friendsData, requestsData] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
            setFriends(friendsData);
            setRequests(requestsData);
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        loadSocial();
    }, []);

    const openEditModal = (person: (typeof persons)[number]) => {
        setEditingPerson(person.id);
        setEditName(person.name);
        setEditColor(person.color);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPerson || !editName.trim()) return;

        setIsSubmitting(true);
        try {
            await updatePerson(editingPerson, { name: editName.trim(), color: editColor });
            setEditingPerson(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            await createPerson({ name: newName.trim(), color: newColor });
            setIsCreateOpen(false);
            setNewName('');
            setNewColor('#4A90D9'); // Reset to default blue
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!personToDelete) return;
        setIsSubmitting(true);
        try {
            await deletePerson(personToDelete);
            setPersonToDelete(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!friendUsername.trim()) return;
        try {
            await api.sendFriendRequest(friendUsername.trim());
            setFriendUsername('');
            showSnackbar('Friend request sent');
        } catch (err: any) {
            showSnackbar(err.message || 'Failed to send request');
        }
    };

    const handleAcceptRequest = async (requestId: number) => {
        try {
            await api.acceptFriendRequest(requestId);
            showSnackbar('Friend request accepted');
            await loadSocial();
        } catch {
            showSnackbar('Failed to accept request');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>People</h1>
                    <p className={styles.subtitle}>Define the travellers who go on these trips.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>+ Add Person</Button>
            </header>

            <section className={styles.socialSection}>
                <Card className={styles.socialCard}>
                    <h3>Friends</h3>
                    <div className={styles.friendRow}>
                        <Input label="Add by username" value={friendUsername} onChange={e => setFriendUsername(e.target.value)} fullWidth />
                        <Button onClick={handleSendFriendRequest}>Send Request</Button>
                    </div>
                    {requests.length > 0 && (
                        <div className={styles.requestList}>
                            <h4>Incoming Requests</h4>
                            {requests.map(req => (
                                <div key={req.id} className={styles.requestItem}>
                                    <span>{req.fromDisplayName || req.fromUsername} (@{req.fromUsername})</span>
                                    <Button size="sm" onClick={() => handleAcceptRequest(req.id)}>Accept</Button>
                                </div>
                            ))}
                        </div>
                    )}
                    {friends.length > 0 && (
                        <p className={styles.friendCount}>{friends.length} friend(s) will automatically appear in your people list.</p>
                    )}
                </Card>
            </section>

            {isLoading && persons.length === 0 ? (
                <div className={styles.loading}>Loading people...</div>
            ) : (
                <div className={styles.grid}>
                    {sortedPersons.map(person => (
                        <Card key={person.id} className={`${styles.personCard} ${person.isOwner ? styles.ownerCard : ''}`}>
                            <div className={styles.avatar} style={{ backgroundColor: person.color }}>
                                {person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.cardContent}>
                                <h3 className={styles.personName}>{person.name}</h3>
                                {person.isOwner && <p className={styles.ownerBadge}>Your profile</p>}
                            </div>
                            <div className={styles.actions}>
                                <Button variant="text" size="sm" onClick={() => openEditModal(person)}>
                                    Edit
                                </Button>
                                <Button
                                    variant="text"
                                    size="sm"
                                    disabled={person.isOwner}
                                    onClick={() => setPersonToDelete(person.id)}
                                    style={{ color: 'var(--md-sys-color-error)' }}
                                >
                                    Delete
                                </Button>
                            </div>
                        </Card>
                    ))}
                    {persons.length === 0 && !isLoading && (
                        <div className={styles.emptyState}>
                            <p>No people defined yet. Add yourself or your travel partners!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => !isSubmitting && setIsCreateOpen(false)}
                title="Add New Person"
                actions={
                    <>
                        <Button variant="text" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>
                            Add Person
                        </Button>
                    </>
                }
            >
                <form id="create-person-form" onSubmit={handleCreate} className={styles.form}>
                    <Input
                        label="Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Alice"
                        autoFocus
                        required
                        fullWidth
                    />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Marker Color</label>
                        <div className={styles.colorRow}>
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewColor(e.target.value)}
                                className={styles.colorInput}
                            />
                            <span className={styles.colorHex}>{newColor.toUpperCase()}</span>
                        </div>
                        <p className={styles.helperText}>Used to color code their paths on the map.</p>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={editingPerson !== null}
                onClose={() => !isSubmitting && setEditingPerson(null)}
                title="Edit Person"
                actions={
                    <>
                        <Button variant="text" onClick={() => setEditingPerson(null)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleEdit} disabled={!editName.trim() || isSubmitting}>
                            Save Changes
                        </Button>
                    </>
                }
            >
                <form id="edit-person-form" onSubmit={handleEdit} className={styles.form}>
                    <Input
                        label="Name"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        required
                        fullWidth
                    />
                    <div className={styles.colorPickerGroup}>
                        <label className={styles.colorLabel}>Marker Color</label>
                        <div className={styles.colorRow}>
                            <input
                                type="color"
                                value={editColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditColor(e.target.value)}
                                className={styles.colorInput}
                            />
                            <span className={styles.colorHex}>{editColor.toUpperCase()}</span>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={personToDelete !== null}
                onClose={() => !isSubmitting && setPersonToDelete(null)}
                title="Delete Person"
                actions={
                    <>
                        <Button variant="text" onClick={() => setPersonToDelete(null)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDelete}
                            disabled={isSubmitting}
                            style={{ backgroundColor: 'var(--md-sys-color-error)', color: 'var(--md-sys-color-on-error)' }}
                        >
                            Delete Permanently
                        </Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to delete <strong>{persons.find(p => p.id === personToDelete)?.name}</strong>?
                </p>
                <p style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    This will remove them from all trips they are assigned to.
                </p>
            </Modal>

        </div>
    );
};
