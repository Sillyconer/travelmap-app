import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SearchPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<UnifiedSearchResults>(EMPTY_RESULTS);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const initialQuery = searchParams.get('q') ?? '';
        if (initialQuery && !query) {
            setQuery(initialQuery);
        }
        if (searchParams.get('focus') === '1') {
            window.setTimeout(() => inputRef.current?.focus(), 0);
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('focus');
            setSearchParams(nextParams, { replace: true });
        }
    }, [query, searchParams, setSearchParams]);

    useEffect(() => {
        const trimmed = query.trim();
        const nextParams = new URLSearchParams(searchParams);
        if (trimmed) {
            nextParams.set('q', trimmed);
        } else {
            nextParams.delete('q');
        }
        setSearchParams(nextParams, { replace: true });
    }, [query]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            return;
        }
        const key = 'mapper_recent_searches';
        const raw = window.localStorage.getItem(key);
        const previous = raw ? (JSON.parse(raw) as string[]) : [];
        const next = [trimmed, ...previous.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
        window.localStorage.setItem(key, JSON.stringify(next));
    }, [query]);

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

    const quickResults = useMemo(
        () => [
            ...results.trips.map(item => ({ label: `Trip: ${item.name}`, route: item.route })),
            ...results.places.map(item => ({ label: `Place: ${item.name}`, route: item.route })),
            ...results.photos.map(item => ({ label: `Photo: ${item.name}`, route: item.route })),
            ...results.profiles.map(item => ({ label: `Profile: ${item.displayName}`, route: item.route })),
        ],
        [results],
    );

    const recentSearches = useMemo(() => {
        const raw = window.localStorage.getItem('mapper_recent_searches');
        return raw ? (JSON.parse(raw) as string[]) : [];
    }, [query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (query.trim()) {
                setQuery('');
                setResults(EMPTY_RESULTS);
            } else {
                inputRef.current?.blur();
            }
            return;
        }
        if (quickResults.length === 0) {
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(prev => (prev + 1) % quickResults.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(prev => (prev - 1 + quickResults.length) % quickResults.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = quickResults[Math.max(0, Math.min(activeIndex, quickResults.length - 1))];
            if (target) {
                navigate(target.route);
            }
        }
    };

    const highlightText = (text: string) => {
        const term = query.trim();
        if (!term) {
            return text;
        }
        const regex = new RegExp(`(${escapeRegExp(term)})`, 'ig');
        const parts = text.split(regex);
        return (
            <>
                {parts.map((part, index) => (
                    index % 2 === 1 ? <mark key={`mark-${index}`} className={styles.match}>{part}</mark> : <span key={`txt-${index}`}>{part}</span>
                ))}
            </>
        );
    };

    return (
        <div className={styles.page}>
            <h1>Search</h1>
            <Input
                label="Search trips, places, photos, profiles"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Try 'tokyo', 'alice', or 'summer'"
                fullWidth
                ref={inputRef}
            />

            {!query.trim() && recentSearches.length > 0 && (
                <div className={styles.recentWrap}>
                    <p className={styles.muted}>Recent searches</p>
                    <div className={styles.recentList}>
                        {recentSearches.map(item => (
                            <button
                                type="button"
                                key={`recent-${item}`}
                                className={styles.recentChip}
                                onClick={() => setQuery(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {isLoading && <p className={styles.muted}>Searching...</p>}
            {!isLoading && query.trim() && <p className={styles.muted}>{total} result(s)</p>}

            {query.trim() && quickResults.length > 0 && (
                <Card>
                    <h3>Quick Jump</h3>
                    <div className={styles.quickList}>
                        {quickResults.slice(0, 8).map((item, index) => (
                            <Link
                                key={`quick-${item.route}-${index}`}
                                to={item.route}
                                className={`${styles.quickItem} ${index === activeIndex ? styles.quickItemActive : ''}`}
                            >
                                {highlightText(item.label)}
                            </Link>
                        ))}
                    </div>
                </Card>
            )}

            <div className={styles.grid}>
                <Card>
                    <h3>Trips</h3>
                    {results.trips.length === 0 ? <p className={styles.muted}>No matching trips.</p> : (
                        <div className={styles.list}>
                            {results.trips.map(item => (
                                <Link key={`trip-${item.id}`} to={item.route} className={styles.item}>
                                    <span className={styles.dot} style={{ backgroundColor: item.color }} />
                                    {highlightText(item.name)}
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
                                    <strong>{highlightText(item.name)}</strong>
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
                                    <span>{highlightText(item.name)}</span>
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
                                    <span>{highlightText(item.displayName)}</span>
                                    <small>@{highlightText(item.username)}{item.isFriend ? ' · friend' : ''}</small>
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
