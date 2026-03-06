from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_current_user, get_store
from models import ItineraryItemCreate, ItineraryItemOut, ItineraryItemUpdate, UserOut

router = APIRouter(prefix="/api/trips/{trip_id}/itinerary", tags=["itinerary"])


@router.get("", response_model=list[ItineraryItemOut])
async def list_itinerary(trip_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_access_trip(current_user.id, trip_id):
        raise HTTPException(404, "Trip not found")
    return await store.list_itinerary_items(trip_id, current_user.id)


@router.post("", response_model=ItineraryItemOut, status_code=201)
async def create_itinerary_item(trip_id: int, data: ItineraryItemCreate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    item = await store.create_itinerary_item(trip_id, current_user.id, data)
    if not item:
        raise HTTPException(403, "You only have viewer access to this trip")
    return item


@router.post("/{item_id}/update", response_model=ItineraryItemOut)
async def update_itinerary_item(
    trip_id: int,
    item_id: int,
    data: ItineraryItemUpdate,
    current_user: UserOut = Depends(get_current_user),
):
    store = get_store()
    item = await store.update_itinerary_item(trip_id, item_id, current_user.id, data)
    if not item:
        raise HTTPException(404, "Itinerary item not found")
    return item


@router.delete("/{item_id}")
async def delete_itinerary_item(trip_id: int, item_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    ok = await store.delete_itinerary_item(trip_id, item_id, current_user.id)
    if not ok:
        raise HTTPException(404, "Itinerary item not found")
    return {"ok": True}
