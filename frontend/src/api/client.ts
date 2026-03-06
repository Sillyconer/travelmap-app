import type { Trip, TripCreate, TripUpdate, Person, PersonCreate, PersonUpdate, Place, PlaceCreate, PlaceUpdate, User } from '../types/models';

function getStoredToken(): string | null {
    const raw = localStorage.getItem('travelmap-auth');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed?.state?.token ?? null;
    } catch {
        return null;
    }
}

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
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...(!(options?.body instanceof FormData) && { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
export const createPlace = (tripId: number, data: PlaceCreate) => fetcher<Place>(`/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(data) });
export const updatePlace = (tripId: number, placeId: number, data: PlaceUpdate) => fetcher<Place>(`/trips/${tripId}/places/${placeId}/update`, { method: 'POST', body: JSON.stringify(data) });
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
export const uploadUnattachedPhoto = (formData: FormData) => fetcher<any>('/photos/upload', { method: 'POST', body: formData });
export const assignPhoto = (photoId: number, tripId: number | null, placeId: number | null) =>
    fetcher<any>(`/photos/${photoId}/assign`, { method: 'POST', body: JSON.stringify({ tripId, placeId }) });

// ── Auth ──
export const register = (data: { username: string; displayName: string; password: string }) =>
    fetcher<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const login = (data: { username: string; password: string }) =>
    fetcher<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const getMe = () => fetcher<User>('/auth/me');

// ── Share Links ──
export const createShareLink = (data: { type: string; photoId?: number; tripId?: number }) =>
    fetcher<{ token: string; url: string }>('/share', { method: 'POST', body: JSON.stringify(data) });
export const resolveShareLink = (token: string) => fetcher<any>(`/share/${token}`);
export const revokeShareLink = (token: string) => fetcher<{ ok: boolean }>(`/share/${token}`, { method: 'DELETE' });

