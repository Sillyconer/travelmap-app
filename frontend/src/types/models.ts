/*
 * TravelMap — TypeScript Types
 * Mirrors the backend Pydantic models exactly.
 */

export interface Person {
    id: number;
    name: string;
    color: string;
}

export interface Place {
    id: number;
    name: string;
    lat: number;
    lng: number;
    note: string;
}

export interface Photo {
    id: number;
    name: string;
    filename: string;
    mime: string;
    width: number;
    height: number;
    lat?: number;
    lng?: number;
    placeId?: number;
    takenAt?: number;
    url: string;
    thumbUrl: string;
}

export interface Trip {
    id: number;
    name: string;
    color: string;
    description: string;
    budget: number;
    spent: number;
    startDate: string;
    endDate: string;
    rating: number;
    places: Place[];
    photos: Photo[];
    personIds: number[];
}

// ── Update Payloads ──

export type TripCreate = Pick<Trip, 'name' | 'color'>;
export type TripUpdate = Partial<Omit<Trip, 'id' | 'places' | 'photos' | 'personIds'>>;

export type PlaceCreate = Pick<Place, 'name' | 'lat' | 'lng' | 'note'>;
export type PlaceUpdate = Partial<Omit<Place, 'id'>>;

export type PersonCreate = Pick<Person, 'name' | 'color'>;
export type PersonUpdate = Partial<Omit<Person, 'id'>>;
