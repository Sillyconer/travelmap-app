import { Polyline } from 'react-leaflet';
import type { Trip } from '../../types/models';

interface TripPolylinesProps {
    trips: Trip[];
}

export const TripPolylines = ({ trips }: TripPolylinesProps) => {
    return (
        <>
            {trips.map(trip => {
                if (!trip.places || trip.places.length < 2) return null;

                // Map the sequentially ordered places into LatLng tuples
                const positions: [number, number][] = trip.places.map(p => [p.lat, p.lng]);

                return (
                    <Polyline
                        key={`line-${trip.id}`}
                        positions={positions}
                        pathOptions={{
                            color: trip.color,
                            weight: 3,
                            opacity: 0.6,
                            dashArray: '5, 5' // Dashed line to signify route
                        }}
                    />
                );
            })}
        </>
    );
};
