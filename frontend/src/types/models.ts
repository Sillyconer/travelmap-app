/*
 * TravelMap — TypeScript Types
 * Mirrors the backend Pydantic models exactly.
 */

export interface Person {
    id: number;
    name: string;
    color: string;
    isOwner?: boolean;
    isFriend?: boolean;
}

export interface User {
    id: number;
    username: string;
    displayName: string;
    personId: number;
    homeCountry: string;
    homeCurrency: string;
    createdAt: string;
}

export interface Friend {
    id: number;
    username: string;
    displayName: string;
    personId: number;
    homeCountry: string;
    homeCurrency: string;
}

export interface FriendRequest {
    id: number;
    fromUserId: number;
    toUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    status: string;
    createdAt: string;
}

export interface Place {
    id: number;
    name: string;
    lat: number;
    lng: number;
    note: string;
}

export interface PhotoOut {
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

export interface LibraryPhoto extends PhotoOut {
    tripId: number | null;
    tripName: string;
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
    visibility: 'friends_only' | 'anyone_with_link';
    ownerUserId: number;
    isShared: boolean;
    places: Place[];
    photos: PhotoOut[];
    personIds: number[];
}

// ── Update Payloads ──

export type TripCreate = Pick<Trip, 'name' | 'color' | 'visibility' | 'budget' | 'description' | 'startDate' | 'endDate'>;
export type TripUpdate = Partial<Omit<Trip, 'id' | 'places' | 'photos' | 'personIds'>>;

export interface CurrencyOption {
    code: string;
    name: string;
}

export interface Expense {
    id: number;
    tripId: number;
    placeId?: number;
    amount: number;
    currency: string;
    amountHome: number;
    homeCurrency: string;
    rateUsed: number;
    note: string;
    createdAt: string;
}

export type PlaceCreate = Pick<Place, 'name' | 'lat' | 'lng' | 'note'>;
export type PlaceUpdate = Partial<Omit<Place, 'id'>>;

export type PersonCreate = Pick<Person, 'name' | 'color'>;
export type PersonUpdate = Partial<Omit<Person, 'id'>>;
