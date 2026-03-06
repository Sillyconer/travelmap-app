import type {
    CommentItem,
    CommentReaction,
    CurrencyOption,
    Expense,
    ExpenseSettlement,
    Friend,
    FriendRequest,
    ItineraryItem,
    ItineraryItemCreate,
    ItineraryItemUpdate,
    NotificationItem,
    Person,
    PersonCreate,
    PersonUpdate,
    Place,
    Profile,
    ProfileFriend,
    ProfilePhoto,
    ProfileSearchResult,
    ProfileTrip,
    PlaceCreate,
    PlaceUpdate,
    Trip,
    TripMember,
    TripCreate,
    TripUpdate,
    UnifiedSearchResults,
    User,
    UserSearchResult,
} from '../types/models';

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

async function fetchBlob(endpoint: string): Promise<Blob> {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        let msg = res.statusText;
        try {
            const data = await res.json();
            msg = data.detail || msg;
        } catch {
            // ignore parse error
        }
        throw new ApiError(msg, res.status);
    }

    return res.blob();
}

// ── Trips ──
export const getTrips = () => fetcher<Trip[]>('/trips');
export const getTripByPublicId = (publicId: string) => fetcher<Trip>(`/trips/${encodeURIComponent(publicId)}`);
export const createTrip = (data: TripCreate) => fetcher<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) });
export const updateTrip = (id: number, data: TripUpdate) => fetcher<Trip>(`/trips/${id}/update`, { method: 'POST', body: JSON.stringify(data) });
export const deleteTrip = (id: number) => fetcher<{ ok: boolean }>(`/trips/${id}`, { method: 'DELETE' });
export const setTripPersons = (tripId: number, personIds: number[]) =>
    fetcher<Trip>(`/trips/${tripId}/persons?person_ids=${encodeURIComponent(personIds.join(','))}`, { method: 'POST' });
export const getTripMembers = (tripId: number) => fetcher<TripMember[]>(`/trips/${tripId}/members`);
export const inviteTripMember = (tripId: number, friendUserId: number, role: 'viewer' | 'editor' = 'viewer') =>
    fetcher<{ ok: boolean }>(`/trips/${tripId}/members/${friendUserId}?role=${encodeURIComponent(role)}`, { method: 'POST' });
export const removeTripMember = (tripId: number, memberUserId: number) => fetcher<{ ok: boolean }>(`/trips/${tripId}/members/${memberUserId}`, { method: 'DELETE' });
export const setTripMemberRole = (tripId: number, memberUserId: number, role: 'viewer' | 'editor') =>
    fetcher<{ ok: boolean }>(`/trips/${tripId}/members/${memberUserId}/role`, { method: 'POST', body: JSON.stringify({ role }) });

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

// ── Itinerary ──
export const getItineraryItems = (tripId: number) => fetcher<ItineraryItem[]>(`/trips/${tripId}/itinerary`);
export const createItineraryItem = (tripId: number, data: ItineraryItemCreate) =>
    fetcher<ItineraryItem>(`/trips/${tripId}/itinerary`, { method: 'POST', body: JSON.stringify(data) });
export const updateItineraryItem = (tripId: number, itemId: number, data: ItineraryItemUpdate) =>
    fetcher<ItineraryItem>(`/trips/${tripId}/itinerary/${itemId}/update`, { method: 'POST', body: JSON.stringify(data) });
export const deleteItineraryItem = (tripId: number, itemId: number) =>
    fetcher<{ ok: boolean }>(`/trips/${tripId}/itinerary/${itemId}`, { method: 'DELETE' });

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
export const downloadTripPhotosZip = (tripId: number, photoIds?: number[]) =>
    fetchBlob(`/trips/${tripId}/photos/download${photoIds && photoIds.length > 0 ? `?ids=${encodeURIComponent(photoIds.join(','))}` : ''}`);

// ── Auth ──
export const register = (data: { username: string; displayName: string; password: string }) =>
    fetcher<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const login = (data: { username: string; password: string }) =>
    fetcher<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const getMe = () => fetcher<User>('/auth/me');
export const updateMe = (data: Partial<Pick<User, 'displayName' | 'homeCountry' | 'homeCurrency'>>) =>
    fetcher<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) });

// ── Social ──
export const getFriends = () => fetcher<Friend[]>('/social/friends');
export const getFriendRequests = () => fetcher<FriendRequest[]>('/social/friend-requests');
export const getOutgoingFriendRequests = () => fetcher<FriendRequest[]>('/social/friend-requests/outgoing');
export const sendFriendRequest = (username: string) =>
    fetcher<FriendRequest>('/social/friend-requests', { method: 'POST', body: JSON.stringify({ username }) });
export const acceptFriendRequest = (requestId: number) =>
    fetcher<{ ok: boolean }>(`/social/friend-requests/${requestId}/accept`, { method: 'POST' });
export const declineFriendRequest = (requestId: number) =>
    fetcher<{ ok: boolean }>(`/social/friend-requests/${requestId}/decline`, { method: 'POST' });
export const cancelFriendRequest = (requestId: number) =>
    fetcher<{ ok: boolean }>(`/social/friend-requests/${requestId}`, { method: 'DELETE' });
export const removeFriend = (friendUserId: number) =>
    fetcher<{ ok: boolean }>(`/social/friends/${friendUserId}`, { method: 'DELETE' });
export const searchUsers = (query: string, limit = 25) =>
    fetcher<UserSearchResult[]>(`/social/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);

// ── Notifications ──
export const getNotifications = (options?: { limit?: number; offset?: number; unreadOnly?: boolean; includeArchived?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    if (options?.unreadOnly !== undefined) params.set('unread_only', String(options.unreadOnly));
    if (options?.includeArchived !== undefined) params.set('include_archived', String(options.includeArchived));
    const qs = params.toString();
    return fetcher<NotificationItem[]>(`/notifications${qs ? `?${qs}` : ''}`);
};
export const getUnreadNotificationCount = () => fetcher<{ count: number }>('/notifications/unread-count');
export const markNotificationsRead = (ids: number[]) =>
    fetcher<{ updated: number }>('/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) });
export const markAllNotificationsRead = () =>
    fetcher<{ updated: number }>('/notifications/read-all', { method: 'POST' });
export const archiveNotifications = (ids: number[]) =>
    fetcher<{ updated: number }>('/notifications/archive', { method: 'POST', body: JSON.stringify({ ids }) });

// ── Unified Search ──
export const unifiedSearch = (query: string, limit = 8) =>
    fetcher<UnifiedSearchResults>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);

// ── Comments ──
export const getComments = (entityType: 'trip' | 'photo', entityId: number, limit = 100) =>
    fetcher<CommentItem[]>(`/comments?entity_type=${encodeURIComponent(entityType)}&entity_id=${entityId}&limit=${limit}`);
export const getCommentCounts = (entityType: 'trip' | 'photo', entityIds: number[]) =>
    fetcher<Record<string, number>>(
        `/comments/counts?entity_type=${encodeURIComponent(entityType)}&entity_ids=${entityIds.map(id => String(id)).join(',')}`,
    );
export const createComment = (entityType: 'trip' | 'photo', entityId: number, body: string) =>
    fetcher<CommentItem>('/comments', { method: 'POST', body: JSON.stringify({ entityType, entityId, body }) });
export const deleteComment = (commentId: number) =>
    fetcher<{ ok: boolean }>(`/comments/${commentId}`, { method: 'DELETE' });
export const toggleCommentReaction = (commentId: number, emoji: string) =>
    fetcher<CommentReaction[]>(`/comments/${commentId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });

// ── Profiles ──
export const searchProfiles = (query: string, limit = 25) =>
    fetcher<ProfileSearchResult[]>(`/profiles/search?q=${encodeURIComponent(query)}&limit=${limit}`);
export const getMyProfile = () => fetcher<Profile>('/profiles/me');
export const getProfile = (username: string) => fetcher<Profile>(`/profiles/${encodeURIComponent(username)}`);
export const updateMyProfile = (data: Partial<Pick<Profile, 'displayName' | 'homeCountry' | 'homeCurrency' | 'profileTheme' | 'aboutMe' | 'showWorldMap' | 'showFeaturedTrips' | 'showFavoritePhotos' | 'showFeaturedFriends'>>) =>
    fetcher<Profile>('/profiles/me', { method: 'PATCH', body: JSON.stringify(data) });
export const uploadMyAvatar = (formData: FormData) =>
    fetcher<Profile>('/profiles/me/avatar', { method: 'POST', body: formData });
export const deleteMyAvatar = () =>
    fetcher<Profile>('/profiles/me/avatar', { method: 'DELETE' });
export const getProfileOptions = () => fetcher<{ trips: ProfileTrip[]; photos: ProfilePhoto[]; friends: ProfileFriend[]; themes: string[] }>('/profiles/me/options');
export const setFeaturedTrips = (tripIds: number[]) =>
    fetcher<ProfileTrip[]>('/profiles/me/featured-trips', { method: 'PUT', body: JSON.stringify({ tripIds }) });
export const setFavoritePhotos = (photoIds: number[]) =>
    fetcher<ProfilePhoto[]>('/profiles/me/favorite-photos', { method: 'PUT', body: JSON.stringify({ photoIds }) });
export const setFeaturedFriends = (userIds: number[]) =>
    fetcher<ProfileFriend[]>('/profiles/me/featured-friends', { method: 'PUT', body: JSON.stringify({ userIds }) });

// ── Finance ──
export const getCurrencies = () => fetcher<CurrencyOption[]>('/currencies');
export const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string) =>
    fetcher<{ rate: number; converted: number; fromCurrency: string; toCurrency: string; amount: number }>('/currency/convert', {
        method: 'POST',
        body: JSON.stringify({ amount, fromCurrency, toCurrency }),
    });
export const createExpense = (
    tripId: number,
    data: {
        amount: number;
        currency: string;
        placeId?: number;
        note?: string;
        splitMode?: 'equal' | 'custom_amount';
        participantUserIds?: number[];
        customShares?: Record<string, number>;
    },
) =>
    fetcher<Expense>(`/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(data) });
export const getExpenses = (tripId: number) => fetcher<Expense[]>(`/trips/${tripId}/expenses`);
export const getExpenseSettlement = (tripId: number) => fetcher<ExpenseSettlement>(`/trips/${tripId}/expenses/settlement`);

// ── Share Links ──
export const createShareLink = (data: { type: string; photoId?: number; tripId?: number }) =>
    fetcher<{ token: string; url: string }>('/share', { method: 'POST', body: JSON.stringify(data) });
export const resolveShareLink = (token: string) => fetcher<any>(`/share/${token}`);
export const revokeShareLink = (token: string) => fetcher<{ ok: boolean }>(`/share/${token}`, { method: 'DELETE' });

