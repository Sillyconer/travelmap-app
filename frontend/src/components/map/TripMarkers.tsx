import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import type { Trip } from '../../types/models';
import { usePersons } from '../../features/persons/usePersons';
import { Avatar } from '../ui/Avatar';

interface TripMarkersProps {
    trips: Trip[];
}

export const TripMarkers = ({ trips }: TripMarkersProps) => {
    const { persons } = usePersons();

    // Helper to create a custom HTML marker icon that respects the person colors or trip fallback
    const createCustomIcon = (trip: Trip, delayMs: number) => {
        let backgroundStyle = `background-color: ${trip.color};`;

        if (trip.personIds && trip.personIds.length > 0) {
            // Find the active persons for this trip
            const tripPersons = trip.personIds
                .map(id => persons.find(p => p.id === id))
                .filter(p => p !== undefined);

            if (tripPersons.length === 1) {
                backgroundStyle = `background-color: ${tripPersons[0]!.color};`;
            } else if (tripPersons.length > 1) {
                // Create a conic or linear gradient for multiple people
                const stops = tripPersons.map((p, i) => {
                    const percentage = (i / tripPersons.length) * 100;
                    const nextPercentage = ((i + 1) / tripPersons.length) * 100;
                    return `${p!.color} ${percentage}% ${nextPercentage}%`;
                }).join(', ');
                backgroundStyle = `background: conic-gradient(${stops});`;
            }
        }

        return L.divIcon({
            html: `<div class="marker-drop" style="${backgroundStyle} width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); animation-delay: ${delayMs}ms;"></div>`,
            className: 'custom-trip-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -9]
        });
    };

    return (
        <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={40}
            showCoverageOnHover={false}
        >
            {trips.map((trip, tripIndex) =>
                trip.places.map((place, placeIndex) => {
                    // Stagger by trip, then by place
                    const delayMs = tripIndex * 150 + placeIndex * 50;
                    const tripPersons = (trip.personIds || [])
                        .map(id => persons.find(p => p.id === id))
                        .filter((person): person is NonNullable<typeof person> => !!person)
                        .slice(0, 4);
                    return (
                        <Marker
                            key={`${trip.id}-${place.id}`}
                            position={[place.lat, place.lng]}
                            icon={createCustomIcon(trip, delayMs)}
                        >
                            <Popup>
                                <div style={{ padding: '4px' }}>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{place.name}</h3>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>Trip: {trip.name}</p>
                                    {tripPersons.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 0', flexWrap: 'wrap' }}>
                                            {tripPersons.map(person => (
                                                <span key={`popup-person-${trip.id}-${person.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <Avatar seed={String(person.id)} name={person.name} size={22} />
                                                    <span style={{ fontSize: '12px', color: '#444' }}>{person.name}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {place.note && <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px' }}>{place.note}</p>}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })
            )}
        </MarkerClusterGroup>
    );
};
