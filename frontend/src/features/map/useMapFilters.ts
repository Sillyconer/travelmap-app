import { create } from 'zustand';

interface MapFiltersState {
    visibleTripIds: Set<number>;
    activePersonIds: Set<number>;
    toggleTripVisibility: (tripId: number) => void;
    togglePersonFilter: (personId: number) => void;
    setAllTripsVisible: (tripIds: number[]) => void;
    clearFilters: () => void;
}

export const useMapFilters = create<MapFiltersState>((set) => ({
    visibleTripIds: new Set<number>(),
    activePersonIds: new Set<number>(),

    toggleTripVisibility: (tripId: number) => set((state) => {
        const newSet = new Set(state.visibleTripIds);
        if (newSet.has(tripId)) {
            newSet.delete(tripId);
        } else {
            newSet.add(tripId);
        }
        return { visibleTripIds: newSet };
    }),

    togglePersonFilter: (personId: number) => set((state) => {
        const newSet = new Set(state.activePersonIds);
        if (newSet.has(personId)) {
            newSet.delete(personId);
        } else {
            newSet.add(personId);
        }
        return { activePersonIds: newSet };
    }),

    setAllTripsVisible: (tripIds: number[]) => set({
        visibleTripIds: new Set(tripIds)
    }),

    clearFilters: () => set({
        visibleTripIds: new Set(),
        activePersonIds: new Set()
    }),
}));
