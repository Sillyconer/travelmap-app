import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import * as api from '../../api/client';
import type { TripCreate, TripUpdate } from '../../types/models';
import { showSnackbar } from '../../components/ui/Snackbar';

/**
 * Hook to manage Trips data fetching and mutations.
 */
export function useTrips() {
    const { trips, setTrips, updateTrip: updateTripInStore, removeTrip } = useStore();
    const [isLoading, setIsLoading] = useState(false);

    // Fetch all trips
    const fetchTrips = async () => {
        setIsLoading(true);
        try {
            const data = await api.getTrips();
            setTrips(data);
        } catch (err: any) {
            showSnackbar(`Failed to load trips: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Create a trip
    const createTrip = async (data: TripCreate) => {
        try {
            const newTrip = await api.createTrip(data);
            setTrips([...trips, newTrip]);
            showSnackbar('Trip created successfully');
            return newTrip;
        } catch (err: any) {
            showSnackbar(`Failed to create trip: ${err.message}`);
            throw err;
        }
    };

    // Update a trip
    const updateTrip = async (id: number, data: TripUpdate) => {
        try {
            const updated = await api.updateTrip(id, data);
            updateTripInStore(updated);
            showSnackbar('Trip updated');
            return updated;
        } catch (err: any) {
            showSnackbar(`Failed to update trip: ${err.message}`);
            throw err;
        }
    };

    // Delete a trip
    const deleteTrip = async (id: number) => {
        try {
            await api.deleteTrip(id);
            removeTrip(id);
            showSnackbar('Trip deleted');
        } catch (err: any) {
            showSnackbar(`Failed to delete trip: ${err.message}`);
            throw err;
        }
    };

    useEffect(() => {
        if (trips.length === 0) {
            fetchTrips();
        }
    }, []); // Only fetch once on mount if empty

    return {
        trips,
        isLoading,
        fetchTrips,
        createTrip,
        updateTrip,
        deleteTrip
    };
}
