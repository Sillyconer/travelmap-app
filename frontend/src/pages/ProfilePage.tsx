import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { CountryFlag } from '../components/ui/CountryFlag';
import { showSnackbar } from '../components/ui/Snackbar';
import { useAuthStore } from '../store/useAuthStore';
import * as api from '../api/client';
import type { Profile, ProfileFriend, ProfilePhoto, ProfileTrip } from '../types/models';
import styles from './ProfilePage.module.css';

const THEMES = ['dark-matter', 'positron', 'voyager', 'oceanic', 'atlas-sand', 'pine-trail'] as const;

const PROFILE_MAP_STYLE: Record<typeof THEMES[number], { url: string; className: string; attribution: string }> = {
    'dark-matter': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        className: 'profile-map-dark-matter',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    positron: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        className: 'profile-map-positron',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    voyager: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
        className: 'profile-map-voyager',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    oceanic: {
        url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        className: 'profile-map-oceanic',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    'atlas-sand': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        className: 'profile-map-atlas-sand',
        attribution: 'Map data &copy; OpenStreetMap contributors, SRTM',
    },
    'pine-trail': {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        className: 'profile-map-pine-trail',
        attribution: 'Map data &copy; OpenStreetMap contributors, SRTM',
    },
};

export const ProfilePage = () => {
    const navigate = useNavigate();
    const { username } = useParams();
    const authUser = useAuthStore(s => s.user);

    const targetUsername = username || authUser?.username || '';

    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [allTrips, setAllTrips] = useState<ProfileTrip[]>([]);
    const [allPhotos, setAllPhotos] = useState<ProfilePhoto[]>([]);
    const [allFriends, setAllFriends] = useState<ProfileFriend[]>([]);

    const [displayName, setDisplayName] = useState('');
    const [homeCountry, setHomeCountry] = useState('');
    const [homeCurrency, setHomeCurrency] = useState('USD');
    const [profileTheme, setProfileTheme] = useState<(typeof THEMES)[number]>('dark-matter');
    const [aboutMe, setAboutMe] = useState('');
    const [showWorldMap, setShowWorldMap] = useState(true);
    const [showFeaturedTrips, setShowFeaturedTrips] = useState(true);
    const [showFavoritePhotos, setShowFavoritePhotos] = useState(true);
    const [showFeaturedFriends, setShowFeaturedFriends] = useState(true);
    const [featuredTripIds, setFeaturedTripIds] = useState<number[]>([]);
    const [favoritePhotoIds, setFavoritePhotoIds] = useState<number[]>([]);
    const [featuredFriendIds, setFeaturedFriendIds] = useState<number[]>([]);

    const isSelf = !!profile?.isSelf;

    useEffect(() => {
        const load = async () => {
            if (!targetUsername) return;
            setIsLoading(true);
            try {
                const data = await api.getProfile(targetUsername);
                setProfile(data);
                setDisplayName(data.displayName);
                setHomeCountry(data.homeCountry || '');
                setHomeCurrency(data.homeCurrency || 'USD');
                setProfileTheme(data.profileTheme);
                setAboutMe(data.aboutMe || '');
                setShowWorldMap(data.showWorldMap);
                setShowFeaturedTrips(data.showFeaturedTrips);
                setShowFavoritePhotos(data.showFavoritePhotos);
                setShowFeaturedFriends(data.showFeaturedFriends);
                setFeaturedTripIds(data.featuredTrips.map(t => t.id));
                setFavoritePhotoIds(data.favoritePhotos.map(p => p.id));
                setFeaturedFriendIds(data.featuredFriends.map(f => f.userId));

                if (data.isSelf) {
                    const options = await api.getProfileOptions();
                    setAllTrips(options.trips);
                    setAllPhotos(options.photos);
                    setAllFriends(options.friends);
                }
            } catch (err: any) {
                showSnackbar(`Failed to load profile: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [targetUsername]);

    const selectedFavoriteCount = favoritePhotoIds.length;
    const visibleFavoritePhotos = useMemo(
        () => profile?.favoritePhotos || [],
        [profile],
    );
    const mapStyle = PROFILE_MAP_STYLE[profileTheme];

    const mapCenter = useMemo<[number, number]>(() => {
        if (!profile?.mapPlaces || profile.mapPlaces.length === 0) {
            return [20, 0];
        }
        const points = profile.mapPlaces;
        const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
        const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
        return [lat, lng];
    }, [profile]);

    const mapTripLines = useMemo(() => {
        if (!profile?.mapPlaces) return [] as Array<{ tripId: number; color: string; name: string; points: [number, number][] }>;
        const byTrip = new Map<number, { color: string; name: string; places: typeof profile.mapPlaces }>();
        for (const p of profile.mapPlaces) {
            if (!byTrip.has(p.tripId)) {
                byTrip.set(p.tripId, { color: p.tripColor, name: p.tripName, places: [] });
            }
            byTrip.get(p.tripId)!.places.push(p);
        }
        return Array.from(byTrip.entries()).map(([tripId, data]) => ({
            tripId,
            color: data.color,
            name: data.name,
            points: data.places
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(p => [p.lat, p.lng] as [number, number]),
        }));
    }, [profile]);

    const toggleSelection = (id: number, selected: number[], setter: (ids: number[]) => void, limit?: number) => {
        if (selected.includes(id)) {
            setter(selected.filter(x => x !== id));
            return;
        }
        if (limit && selected.length >= limit) {
            return;
        }
        setter([...selected, id]);
    };

    const handleSaveProfile = async () => {
        if (!profile) return;
        setIsSaving(true);
        try {
            const updated = await api.updateMyProfile({
                displayName,
                homeCountry,
                homeCurrency,
                profileTheme,
                aboutMe,
                showWorldMap,
                showFeaturedTrips,
                showFavoritePhotos,
                showFeaturedFriends,
            });
            const [updatedTrips, updatedPhotos, updatedFriends] = await Promise.all([
                api.setFeaturedTrips(featuredTripIds),
                api.setFavoritePhotos(favoritePhotoIds),
                api.setFeaturedFriends(featuredFriendIds),
            ]);
            setProfile({ ...updated, featuredTrips: updatedTrips, favoritePhotos: updatedPhotos, featuredFriends: updatedFriends, isSelf: true });
            showSnackbar('Profile updated');
        } catch (err: any) {
            showSnackbar(`Failed to update profile: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className={styles.loading}>Loading profile...</div>;
    }

    if (!profile) {
        return <div className={styles.loading}>Profile not found.</div>;
    }

    return (
        <div className={styles.page} data-theme={profileTheme}>
            <div className={styles.inner}>
                <Card className={styles.hero}>
                    <div className={styles.heroHead}>
                        <Avatar seed={profile.username} name={profile.displayName} size={84} />
                        <div>
                            <h1 className={styles.name}>{profile.displayName}</h1>
                            <p className={styles.username}>@{profile.username}</p>
                            <p className={styles.username}>
                                <CountryFlag country={profile.homeCountry} /> {profile.homeCountry || 'Unknown home country'} · {profile.homeCurrency}
                            </p>
                        </div>
                    </div>
                    <p className={styles.about}>{profile.aboutMe || 'No bio yet.'}</p>
                </Card>

                {profile.showWorldMap && (
                    <Card className={styles.widget}>
                        <h3>World Map Widget</h3>
                        <p className={styles.muted}>Country: {profile.homeCountry || 'N/A'} · Home currency: {profile.homeCurrency}</p>
                        {profile.mapPlaces.length > 0 ? (
                            <div className={styles.mapFrame}>
                                <MapContainer
                                    center={mapCenter}
                                    zoom={2}
                                    minZoom={2}
                                    maxZoom={8}
                                    maxBounds={[[-90, -180], [90, 180]]}
                                    className={styles.miniMap}
                                    zoomControl={false}
                                    attributionControl={false}
                                >
                                    <TileLayer
                                        attribution={mapStyle.attribution}
                                        url={mapStyle.url}
                                        className={mapStyle.className}
                                    />

                                    {mapTripLines.map(line => (
                                        line.points.length > 1 ? (
                                            <Polyline key={`line-${line.tripId}`} positions={line.points} pathOptions={{ color: line.color, weight: 3, opacity: 0.8 }} />
                                        ) : null
                                    ))}

                                    {profile.mapPlaces.map(place => (
                                        <CircleMarker
                                            key={`place-${place.placeId}`}
                                            center={[place.lat, place.lng]}
                                            radius={5}
                                            pathOptions={{ color: '#fff', weight: 1.2, fillColor: place.tripColor, fillOpacity: 0.95 }}
                                        >
                                            <Popup>{place.tripName}</Popup>
                                        </CircleMarker>
                                    ))}
                                </MapContainer>
                            </div>
                        ) : (
                            <p className={styles.muted}>No map places to display yet.</p>
                        )}
                    </Card>
                )}

                {profile.showFeaturedTrips && (
                    <Card className={styles.widget}>
                        <h3>Featured Trips</h3>
                        <div className={styles.tripGrid}>
                            {profile.featuredTrips.map(trip => (
                                <div key={trip.id} className={styles.tripCard}>
                                    <span className={styles.tripDot} style={{ backgroundColor: trip.color }} />
                                    <span>{trip.name}</span>
                                </div>
                            ))}
                            {profile.featuredTrips.length === 0 && <p className={styles.muted}>No featured trips yet.</p>}
                        </div>
                    </Card>
                )}

                {profile.showFavoritePhotos && (
                    <Card className={styles.widget}>
                        <h3>Favorite Photos</h3>
                        <div className={styles.photoGrid}>
                            {visibleFavoritePhotos.map(photo => (
                                <img key={photo.id} src={photo.thumbUrl || photo.url} alt={photo.name} className={styles.photo} />
                            ))}
                            {visibleFavoritePhotos.length === 0 && <p className={styles.muted}>No favorite photos yet.</p>}
                        </div>
                    </Card>
                )}

                {profile.showFeaturedFriends && (
                    <Card className={styles.widget}>
                        <h3>Featured Friends</h3>
                        <div className={styles.friendGrid}>
                            {profile.featuredFriends.map(friend => (
                                <button
                                    key={friend.userId}
                                    type="button"
                                    className={styles.friendCard}
                                    onClick={() => navigate(`/profiles/${friend.username}`)}
                                >
                                    <div className={styles.friendHead}>
                                        <Avatar seed={friend.username} name={friend.displayName} size={34} />
                                        <div>
                                            <strong>{friend.displayName}</strong>
                                            <span>@{friend.username}</span>
                                        </div>
                                    </div>
                                    <small><CountryFlag country={friend.homeCountry} /> {friend.homeCountry || 'N/A'} · {friend.homeCurrency}</small>
                                </button>
                            ))}
                            {profile.featuredFriends.length === 0 && <p className={styles.muted}>No featured friends yet.</p>}
                        </div>
                    </Card>
                )}

                {isSelf && (
                    <Card className={styles.editor}>
                        <h3>Edit Profile</h3>
                        <div className={styles.formGrid}>
                            <Input label="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} fullWidth />
                            <Input label="Home Country" value={homeCountry} onChange={e => setHomeCountry(e.target.value.toUpperCase())} fullWidth />
                            <Input label="Home Currency" value={homeCurrency} onChange={e => setHomeCurrency(e.target.value.toUpperCase())} fullWidth />
                            <label className={styles.fieldLabel}>
                                Profile Theme
                                <select value={profileTheme} onChange={e => setProfileTheme(e.target.value as (typeof THEMES)[number])} className={styles.select}>
                                    {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </label>
                            <label className={styles.fieldLabel}>
                                About Me
                                <textarea value={aboutMe} onChange={e => setAboutMe(e.target.value)} className={styles.textarea} maxLength={600} />
                            </label>
                        </div>

                        <div className={styles.toggleRow}>
                            <label><input type="checkbox" checked={showWorldMap} onChange={e => setShowWorldMap(e.target.checked)} /> Show world map widget</label>
                            <label><input type="checkbox" checked={showFeaturedTrips} onChange={e => setShowFeaturedTrips(e.target.checked)} /> Show featured trips</label>
                            <label><input type="checkbox" checked={showFavoritePhotos} onChange={e => setShowFavoritePhotos(e.target.checked)} /> Show favorite photos</label>
                            <label><input type="checkbox" checked={showFeaturedFriends} onChange={e => setShowFeaturedFriends(e.target.checked)} /> Show featured friends</label>
                        </div>

                        <div className={styles.pickers}>
                            <div>
                                <h4>Pick Featured Trips</h4>
                                <div className={styles.pickerList}>
                                    {allTrips.map(trip => (
                                        <label key={trip.id} className={styles.pickerItem}>
                                            <input
                                                type="checkbox"
                                                checked={featuredTripIds.includes(trip.id)}
                                                onChange={() => toggleSelection(trip.id, featuredTripIds, setFeaturedTripIds, 8)}
                                            />
                                            <span>{trip.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4>Pick Favorite Photos (1-6)</h4>
                                <p className={styles.muted}>{selectedFavoriteCount}/6 selected</p>
                                <div className={styles.photoPicker}>
                                    {allPhotos.map(photo => (
                                        <button
                                            type="button"
                                            key={photo.id}
                                            className={`${styles.photoPickItem} ${favoritePhotoIds.includes(photo.id) ? styles.photoPickActive : ''}`}
                                            onClick={() => toggleSelection(photo.id, favoritePhotoIds, setFavoritePhotoIds, 6)}
                                        >
                                            <img src={photo.thumbUrl || photo.url} alt={photo.name} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4>Pick Featured Friends</h4>
                                <div className={styles.pickerList}>
                                    {allFriends.map(friend => (
                                        <label key={friend.userId} className={styles.pickerItem}>
                                            <input
                                                type="checkbox"
                                                checked={featuredFriendIds.includes(friend.userId)}
                                                onChange={() => toggleSelection(friend.userId, featuredFriendIds, setFeaturedFriendIds, 12)}
                                            />
                                            <span>{friend.displayName} (@{friend.username})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Button onClick={handleSaveProfile} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Profile'}
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
};
