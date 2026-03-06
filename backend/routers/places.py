"""
TravelMap Backend — Place API Router

Endpoints for place CRUD and reordering within a trip.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from models import Place, PlaceCreate, PlaceUpdate, PlaceReorder, Trip, UserOut
from dependencies import get_current_user, get_store

router = APIRouter(prefix="/api/trips/{trip_id}/places", tags=["places"])


@router.post("", response_model=Place, status_code=201)
async def create_place(trip_id: int, data: PlaceCreate, current_user: UserOut = Depends(get_current_user)):
    """Add a new place to a trip."""
    store = get_store()
    # Verify trip exists
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    return await store.create_place(trip_id, data)


@router.post("/{place_id}/update", response_model=Place)
async def update_place(trip_id: int, place_id: int, data: PlaceUpdate, current_user: UserOut = Depends(get_current_user)):
    """Update a place's name, coordinates, or note."""
    store = get_store()
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    place = await store.update_place(trip_id, place_id, data)
    if not place:
        raise HTTPException(404, f"Place {place_id} not found in trip {trip_id}")
    return place


@router.delete("/{place_id}")
async def delete_place(trip_id: int, place_id: int, current_user: UserOut = Depends(get_current_user)):
    """Remove a place from a trip."""
    store = get_store()
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    if not await store.delete_place(trip_id, place_id):
        raise HTTPException(404, f"Place {place_id} not found in trip {trip_id}")
    return {}


@router.post("/reorder", response_model=Trip)
async def reorder_places(trip_id: int, payload: PlaceReorder, current_user: UserOut = Depends(get_current_user)):
    """
    Reorder places within a trip.
    Accepts a comma-separated list of place IDs in the desired order.
    """
    store = get_store()
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(403, "You only have viewer access to this trip")
    ordered_ids = [int(x.strip()) for x in payload.order.split(",") if x.strip()]
    trip = await store.reorder_places(trip_id, current_user.id, ordered_ids)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip
