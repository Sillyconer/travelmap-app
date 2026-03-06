import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { showSnackbar } from '../components/ui/Snackbar';
import * as api from '../api/client';
import type { UnifiedSearchResults } from '../types/models';
import styles from './SearchPage.module.css';

const EMPTY_RESULTS: UnifiedSearchResults = {
    trips: [],
    places: [],
    photos: [],
    profiles: [],
};

export const SearchPage = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<UnifiedSearchResults>(EMPTY_RESULTS);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults(EMPTY_RESULTS);
            return;
        }
        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await api.unifiedSearch(trimmed, 8);
                setResults(res);
            } catch (err: any) {
                showSnackbar(`Search failed: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [query]);

    const total = useMemo(
        () => results.trips.length + results.places.length + results.photos.length + results.profiles.length,
        [results],
    );

    return (
        <div className={styles.page}>
            <h1>Search</h1>
            <Input
                label="Search trips, places, photos, profiles"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Try 'tokyo', 'alice', or 'summer'"
                fullWidth
            />

            {isLoading && <p className={styles.muted}>Searching...</p>}
            {!isLoading && query.trim() && <p className={styles.muted}>{total} result(s)</p>}

            <div className={styles.grid}>
                <Card>
                    <h3>Trips</h3>
                    {results.trips.length === 0 ? <p className={styles.muted}>No matching trips.</p> : (
                        <div className={styles.list}>
                            {results.trips.map(item => (
                                <Link key={`trip-${item.id}`} to={item.route} className={styles.item}>
                                    <span className={styles.dot} style={{ backgroundColor: item.color }} />
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <h3>Places</h3>
                    {results.places.length === 0 ? <p className={styles.muted}>No matching places.</p> : (
                        <div className={styles.list}>
                            {results.places.map(item => (
                                <Link key={`place-${item.id}`} to={item.route} className={styles.item}>
                                    <strong>{item.name}</strong>
                                    <small>{item.tripName}</small>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <h3>Photos</h3>
                    {results.photos.length === 0 ? <p className={styles.muted}>No matching photos.</p> : (
                        <div className={styles.list}>
                            {results.photos.map(item => (
                                <Link key={`photo-${item.id}`} to={item.route} className={styles.item}>
                                    <span>{item.name}</span>
                                    <small>{item.tripName}</small>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <h3>Profiles</h3>
                    {results.profiles.length === 0 ? <p className={styles.muted}>No matching profiles.</p> : (
                        <div className={styles.list}>
                            {results.profiles.map(item => (
                                <Link key={`profile-${item.id}`} to={item.route} className={styles.item}>
                                    <span>{item.displayName}</span>
                                    <small>@{item.username}{item.isFriend ? ' · friend' : ''}</small>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
