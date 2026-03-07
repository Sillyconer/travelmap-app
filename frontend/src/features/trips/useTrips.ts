import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import * as api from '../../api/client';
import type { TripCreate, TripUpdate } from '../../types/models';
import { showSnackbar } from '../../components/ui/Snackbar';

/**
 * Hook to manage Trips data fetching and mutations.
 */
export function useTrips() {
    const {
        trips,
        isLoadingTrips,
        setTrips,
        setTripsLoading,
        updateTrip: updateTripInStore,
        removeTrip,
    } = useStore();

    // Fetch all trips
    const fetchTrips = async () => {
        if (isLoadingTrips) {
            return;
        }
        setTripsLoading(true);
        try {
            const data = await api.getTrips();
            setTrips(data);
        } catch (err: any) {
            showSnackbar(`Failed to load trips: ${err.message}`);
        } finally {
            setTripsLoading(false);
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
        if (trips.length === 0 && !isLoadingTrips) {
            fetchTrips();
        }
    }, [trips.length, isLoadingTrips]);

    return {
        trips,
        isLoading: isLoadingTrips,
        fetchTrips,
        createTrip,
        updateTrip,
        deleteTrip
    };
}
