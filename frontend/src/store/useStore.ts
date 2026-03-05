import { create } from 'zustand';
import { Trip, Person } from '../types/models';

interface AppState {
    // Data
    trips: Trip[];
    persons: Person[];

    // Loading states
    isLoadingTrips: boolean;
    isLoadingPersons: boolean;

    // Actions
    setTrips: (trips: Trip[]) => void;
    setPersons: (persons: Person[]) => void;
    updateTrip: (trip: Trip) => void;
    removeTrip: (id: number) => void;
}

/**
 * TravelMap — Global Zustand Store
 * Holds fetched data to avoid prop drilling and unnecessary re-fetches.
 */
export const useStore = create<AppState>((set) => ({
    trips: [],
    persons: [],
    isLoadingTrips: false,
    isLoadingPersons: false,

    setTrips: (trips) => set({ trips }),
    setPersons: (persons) => set({ persons }),

    updateTrip: (updated) => set((state) => ({
        trips: state.trips.map(t => t.id === updated.id ? updated : t)
    })),

    removeTrip: (id) => set((state) => ({
        trips: state.trips.filter(t => t.id !== id)
    }))
}));
