import { Trip, TripCreate, TripUpdate, Person, PersonCreate, PersonUpdate, PlaceCreate, PlaceUpdate } from '../types/models';

/**
 * TravelMap — API Client
 * Wraps the fetch API with typed responses and error handling.
 */

const API_BASE = '/api';

class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...(!(options?.body instanceof FormData) && { 'Content-Type': 'application/json' }),
            ...options?.headers,
        },
    });

    if (!res.ok) {
        let msg = res.statusText;
        try {
            const data = await res.json();
            msg = data.detail || msg;
        } catch { }
        throw new ApiError(msg, res.status);
    }

    return res.json() as Promise<T>;
}

// ── Trips ──
export const getTrips = () => fetcher<Trip[]>('/trips');
export const getTrip = (id: number) => fetcher<Trip>(`/trips/${id}`);
export const createTrip = (data: TripCreate) => fetcher<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) });
export const updateTrip = (id: number, data: TripUpdate) => fetcher<Trip>(`/trips/${id}/update`, { method: 'POST', body: JSON.stringify(data) });
export const deleteTrip = (id: number) => fetcher<{ ok: boolean }>(`/trips/${id}`, { method: 'DELETE' });
export const setTripPersons = (tripId: number, personIds: number[]) =>
    fetcher<Trip>(`/trips/${tripId}/persons`, { method: 'POST', body: JSON.stringify({ personIds: personIds.join(',') }) }); // TODO: send as query param if backend expects it

// ── Persons ──
export const getPersons = () => fetcher<Person[]>('/persons');
export const createPerson = (data: PersonCreate) => fetcher<Person>('/persons', { method: 'POST', body: JSON.stringify(data) });
export const updatePerson = (id: number, data: PersonUpdate) => fetcher<Person>(`/persons/${id}/update`, { method: 'POST', body: JSON.stringify(data) });
export const deletePerson = (id: number) => fetcher<{ ok: boolean }>(`/persons/${id}`, { method: 'DELETE' });

// ── Places ──
export const createPlace = (tripId: number, data: PlaceCreate) => fetcher<Location>(`/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(data) });
export const updatePlace = (tripId: number, placeId: number, data: PlaceUpdate) => fetcher<Location>(`/trips/${tripId}/places/${placeId}/update`, { method: 'POST', body: JSON.stringify(data) });
export const deletePlace = (tripId: number, placeId: number) => fetcher<{}>(`/trips/${tripId}/places/${placeId}`, { method: 'DELETE' });
export const reorderPlaces = (tripId: number, orderedIds: number[]) => fetcher<Trip>(`/trips/${tripId}/places/reorder`, { method: 'POST', body: JSON.stringify({ order: orderedIds.join(',') }) });

// ── Photos ──
// Note: upload endpoint uses FormData and is usually handled directly by the upload component
// to support progress parsing via XMLHttpRequest, but here's the fetch equivalent.
export const uploadPhoto = (tripId: number, formData: FormData) => fetcher<any>(`/trips/${tripId}/photos`, { method: 'POST', body: formData });
export const updatePhoto = (tripId: number, photoId: number, placeId: number | null) => fetcher<any>(`/trips/${tripId}/photos/${photoId}/update`, { method: 'POST', body: JSON.stringify({ placeId }) });
export const deletePhoto = (tripId: number, photoId: number) => fetcher<{}>(`/trips/${tripId}/photos/${photoId}`, { method: 'DELETE' });
export const getAllPhotos = () => fetcher<any[]>('/photos');
export const clearAllPhotos = () => fetcher<{ removed: number }>('/photos', { method: 'DELETE' });
