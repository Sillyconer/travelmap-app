import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import * as api from '../api/client';
import type { ProfileSearchResult } from '../types/models';
import styles from './ProfilesPage.module.css';

export const ProfilesPage = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ProfileSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const rows = await api.searchProfiles(q, 30);
                setResults(rows);
            } finally {
                setIsLoading(false);
            }
        }, 220);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Profiles</h1>
                <p className={styles.subtitle}>Search users by display name or username.</p>
            </header>

            <Card className={styles.searchCard}>
                <Input
                    label="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Sillycon, Alex"
                    fullWidth
                />
            </Card>

            <div className={styles.grid}>
                {results.map(profile => (
                    <Card key={profile.userId} className={styles.profileCard} interactive onClick={() => navigate(`/profiles/${profile.username}`)}>
                        <div className={styles.profileHead}>
                            <Avatar seed={profile.username} name={profile.displayName} size={44} />
                            <div>
                                <h3 className={styles.name}>{profile.displayName}</h3>
                                <p className={styles.username}>@{profile.username}</p>
                            </div>
                        </div>
                        <p className={styles.about}>{profile.aboutMe || 'No bio yet.'}</p>
                        <div className={styles.meta}>
                            <span>{profile.profileTheme}</span>
                            {profile.isFriend && <span>Friend</span>}
                        </div>
                    </Card>
                ))}
                {query.trim().length >= 2 && !isLoading && results.length === 0 && (
                    <p className={styles.empty}>No profiles found.</p>
                )}
            </div>
        </div>
    );
};
