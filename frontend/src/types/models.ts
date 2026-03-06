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
    avatarUrl: string;
    profileTheme: 'dark-matter' | 'positron' | 'voyager' | 'oceanic' | 'atlas-sand' | 'pine-trail';
    createdAt: string;
}

export interface Friend {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    personId: number;
    homeCountry: string;
    homeCurrency: string;
}

export interface TripMember extends Friend {
    role: 'owner' | 'viewer' | 'editor';
}

export interface FriendRequest {
    id: number;
    fromUserId: number;
    toUserId: number;
    fromUsername: string;
    fromDisplayName: string;
    toUsername: string;
    toDisplayName: string;
    status: string;
    createdAt: string;
}

export interface UserSearchResult {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    homeCountry: string;
    homeCurrency: string;
    isFriend: boolean;
    hasIncoming: boolean;
    hasOutgoing: boolean;
}

export interface NotificationItem {
    id: number;
    type: string;
    title: string;
    message: string;
    payload: Record<string, unknown>;
    occurrenceCount: number;
    isRead: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SearchTripResult {
    id: number;
    name: string;
    color: string;
    route: string;
}

export interface SearchPlaceResult {
    id: number;
    name: string;
    note: string;
    tripId: number;
    tripName: string;
    route: string;
}

export interface SearchPhotoResult {
    id: number;
    name: string;
    thumbUrl: string;
    tripId: number | null;
    tripName: string;
    route: string;
}

export interface SearchProfileResult {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    isFriend: boolean;
    route: string;
}

export interface UnifiedSearchResults {
    trips: SearchTripResult[];
    places: SearchPlaceResult[];
    photos: SearchPhotoResult[];
    profiles: SearchProfileResult[];
}

export interface CommentReaction {
    emoji: string;
    count: number;
    reacted: boolean;
}

export interface CommentItem {
    id: number;
    entityType: 'trip' | 'photo';
    entityId: number;
    userId: number;
    username: string;
    displayName: string;
    body: string;
    canDelete: boolean;
    createdAt: string;
    reactions: CommentReaction[];
}

export interface ProfileTrip {
    id: number;
    name: string;
    color: string;
    placesCount: number;
    photosCount: number;
}

export interface ProfilePhoto {
    id: number;
    name: string;
    url: string;
    thumbUrl: string;
}

export interface ProfileMapPlace {
    placeId: number;
    tripId: number;
    tripName: string;
    tripColor: string;
    lat: number;
    lng: number;
    sortOrder: number;
}

export interface ProfileFriend {
    userId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    homeCountry: string;
    homeCurrency: string;
}

export interface Profile {
    userId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    homeCountry: string;
    homeCurrency: string;
    profileTheme: 'dark-matter' | 'positron' | 'voyager' | 'oceanic' | 'atlas-sand' | 'pine-trail';
    aboutMe: string;
    showWorldMap: boolean;
    showFeaturedTrips: boolean;
    showFavoritePhotos: boolean;
    showFeaturedFriends: boolean;
    featuredTrips: ProfileTrip[];
    featuredFriends: ProfileFriend[];
    favoritePhotos: ProfilePhoto[];
    mapPlaces: ProfileMapPlace[];
    isSelf: boolean;
}

export interface ProfileSearchResult {
    userId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    profileTheme: 'dark-matter' | 'positron' | 'voyager' | 'oceanic' | 'atlas-sand' | 'pine-trail';
    aboutMe: string;
    isFriend: boolean;
}

export interface Place {
    id: number;
    name: string;
    lat: number;
    lng: number;
    note: string;
}

export interface ItineraryItem {
    id: number;
    tripId: number;
    title: string;
    dayIndex: number;
    startAt: string;
    endAt: string;
    placeId?: number;
    note: string;
    sortOrder: number;
    createdAt: string;
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
    publicId: string;
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
    accessRole: 'owner' | 'editor' | 'viewer';
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

export interface ExpenseSettlementParticipant {
    userId: number;
    username: string;
    displayName: string;
    paid: number;
    share: number;
    balance: number;
}

export interface ExpenseSettlementTransfer {
    fromUserId: number;
    toUserId: number;
    amount: number;
}

export interface ExpenseSettlementBreakdownShare {
    userId: number;
    username: string;
    displayName: string;
    amount: number;
}

export interface ExpenseSettlementBreakdown {
    expenseId: number;
    payerUserId: number;
    payerDisplayName: string;
    amount: number;
    currency: string;
    amountHome: number;
    homeCurrency: string;
    note: string;
    createdAt: string;
    shares: ExpenseSettlementBreakdownShare[];
}

export interface ExpenseSettlement {
    participants: ExpenseSettlementParticipant[];
    transfers: ExpenseSettlementTransfer[];
    expenseBreakdowns: ExpenseSettlementBreakdown[];
    total: number;
    perPerson: number;
    homeCurrency: string;
    mixedCurrencies: boolean;
}

export type PlaceCreate = Pick<Place, 'name' | 'lat' | 'lng' | 'note'>;
export type PlaceUpdate = Partial<Omit<Place, 'id'>>;
export type ItineraryItemCreate = Pick<ItineraryItem, 'title' | 'dayIndex' | 'startAt' | 'endAt' | 'placeId' | 'note'>;
export type ItineraryItemUpdate = Partial<ItineraryItemCreate>;

export type PersonCreate = Pick<Person, 'name' | 'color'>;
export type PersonUpdate = Partial<Omit<Person, 'id'>>;
