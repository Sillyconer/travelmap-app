import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTrips } from '../../features/trips/useTrips';
import { useMapFilters } from '../../features/map/useMapFilters';
import { useEffect } from 'react';
import { TripMarkers } from './TripMarkers';
import { TripPolylines } from './TripPolylines';
import { useSettingsStore } from '../../store/useSettingsStore';
import styles from './MapLayer.module.css';

const TILE_PROVIDERS = {
    'dark-matter': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    positron: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    voyager: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    'voyager-nolabels': {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    'osm-standard': {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    terrain: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
} as const;

// Fix for default Leaflet icons in Webpack/Vite
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export const MapLayer = () => {
    const { trips } = useTrips();
    const { visibleTripIds, activePersonIds, setAllTripsVisible } = useMapFilters();
    const { mapStyle } = useSettingsStore();

    // Initialize all trips as visible by default
    useEffect(() => {
        if (trips.length > 0 && visibleTripIds.size === 0) {
            setAllTripsVisible(trips.map(t => t.id));
        }
    }, [trips, visibleTripIds.size, setAllTripsVisible]);

    const tripsAfterPersonFilter = activePersonIds.size > 0
        ? trips.filter(t => t.personIds?.some(pid => activePersonIds.has(pid)))
        : trips;

    const visibleTrips = tripsAfterPersonFilter.filter(trip => visibleTripIds.has(trip.id));
    const tileProvider = TILE_PROVIDERS[mapStyle] ?? TILE_PROVIDERS['dark-matter'];

    return (
        <div className={styles.mapWrapper}>
            <MapContainer
                center={[20, 0]}
                zoom={3}
                minZoom={3}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                className={styles.map}
                zoomControl={false}
            >
                <TileLayer
                    attribution={tileProvider.attribution}
                    url={tileProvider.url}
                />

                <TripPolylines trips={visibleTrips} />
                <TripMarkers trips={visibleTrips} />

            </MapContainer>
        </div>
    );
};
