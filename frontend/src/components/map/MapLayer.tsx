import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTrips } from '../../features/trips/useTrips';
import { useMapFilters } from '../../features/map/useMapFilters';
import { useEffect, useState } from 'react';
import { TripMarkers } from './TripMarkers';
import { TripPolylines } from './TripPolylines';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { MapStyle } from '../../store/useSettingsStore';
import styles from './MapLayer.module.css';

type TileSpec = {
    url: string;
    className?: string;
    opacity?: number;
};

type StyleSpec = {
    backgroundColor: string;
    attribution: string;
    layers: TileSpec[];
    useOceanicLandOverlay?: boolean;
};

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const TOPO_ATTRIBUTION = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>';

const MAP_STYLE_SPECS: Record<MapStyle, StyleSpec> = {
    'dark-matter': {
        backgroundColor: '#0e1013',
        attribution: CARTO_ATTRIBUTION,
        layers: [{ url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' }],
    },
    positron: {
        backgroundColor: '#f4f6fa',
        attribution: CARTO_ATTRIBUTION,
        layers: [{ url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' }],
    },
    voyager: {
        backgroundColor: '#f2efea',
        attribution: CARTO_ATTRIBUTION,
        layers: [{ url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' }],
    },
    'voyager-nolabels': {
        backgroundColor: '#ece9e2',
        attribution: CARTO_ATTRIBUTION,
        layers: [{ url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png' }],
    },
    'osm-standard': {
        backgroundColor: '#dfe9f1',
        attribution: OSM_ATTRIBUTION,
        layers: [{ url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }],
    },
    terrain: {
        backgroundColor: '#d7c8ad',
        attribution: TOPO_ATTRIBUTION,
        layers: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' }],
    },
    'oceanic-deep': {
        backgroundColor: '#5f7280',
        attribution: CARTO_ATTRIBUTION,
        layers: [
            { url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', className: 'tile-oceanic-boundaries', opacity: 0.42 },
            { url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', className: 'tile-oceanic-labels', opacity: 0.82 },
        ],
        useOceanicLandOverlay: true,
    },
    'voyager-neo': {
        backgroundColor: '#2a1b33',
        attribution: CARTO_ATTRIBUTION,
        layers: [
            { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', className: 'tile-voyager-base' },
            { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', className: 'tile-voyager-desert', opacity: 0.48 },
            { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', className: 'tile-voyager-labels', opacity: 0.62 },
        ],
    },
    'pine-earth': {
        backgroundColor: '#0f1d15',
        attribution: TOPO_ATTRIBUTION,
        layers: [
            { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', className: 'tile-pine-base' },
            { url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', className: 'tile-pine-water', opacity: 0.38 },
            { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', className: 'tile-pine-labels', opacity: 0.75 },
        ],
    },
};

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
    const [oceanicLandData, setOceanicLandData] = useState<any | null>(null);

    // Initialize all trips as visible by default
    useEffect(() => {
        if (trips.length > 0 && visibleTripIds.size === 0) {
            setAllTripsVisible(trips.map(t => t.id));
        }
    }, [trips, visibleTripIds.size, setAllTripsVisible]);

    useEffect(() => {
        if (mapStyle !== 'oceanic-deep' || oceanicLandData) {
            return;
        }

        let cancelled = false;
        const loadLand = async () => {
            try {
                const res = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json');
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setOceanicLandData(data);
                }
            } catch {
                // Keep fallback tiles only if overlay fetch fails.
            }
        };

        loadLand();
        return () => {
            cancelled = true;
        };
    }, [mapStyle, oceanicLandData]);

    const tripsAfterPersonFilter = activePersonIds.size > 0
        ? trips.filter(t => t.personIds?.some(pid => activePersonIds.has(pid)))
        : trips;

    const visibleTrips = tripsAfterPersonFilter.filter(trip => visibleTripIds.has(trip.id));
    const styleSpec = MAP_STYLE_SPECS[mapStyle] ?? MAP_STYLE_SPECS['dark-matter'];

    return (
        <div className={styles.mapWrapper} style={{ '--map-background': styleSpec.backgroundColor } as Record<string, string>}>
            <MapContainer
                center={[20, 0]}
                zoom={3}
                minZoom={3}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                className={styles.map}
                zoomControl={false}
            >
                {styleSpec.layers.map((layer, index) => (
                    <TileLayer
                        key={`${mapStyle}-${index}`}
                        attribution={index === 0 ? styleSpec.attribution : ''}
                        url={layer.url}
                        className={layer.className}
                        opacity={layer.opacity ?? 1}
                    />
                ))}

                {styleSpec.useOceanicLandOverlay && oceanicLandData && (
                    <GeoJSON
                        data={oceanicLandData}
                        style={() => ({
                            fillColor: '#4a8fcb',
                            fillOpacity: 0.98,
                            color: '#6f9ab6',
                            weight: 0.4,
                            opacity: 0.7,
                        })}
                    />
                )}

                <TripPolylines trips={visibleTrips} />
                <TripMarkers trips={visibleTrips} />

            </MapContainer>
        </div>
    );
};
