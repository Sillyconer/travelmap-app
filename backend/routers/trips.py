"""
TravelMap Backend — Trip API Router

Endpoints for trip CRUD, person assignment, and trip listing.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from models import Trip, TripCreate, TripUpdate, UserOut
from dependencies import get_current_user, get_store

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("", response_model=list[Trip])
async def list_trips(current_user: UserOut = Depends(get_current_user)):
    """List all trips with places, photos, and person IDs."""
    store = get_store()
    return await store.get_trips(current_user.id)


@router.get("/{trip_id}", response_model=Trip)
async def get_trip(trip_id: int, current_user: UserOut = Depends(get_current_user)):
    """Get a single trip by ID."""
    store = get_store()
    trip = await store.get_trip(trip_id, current_user.id)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip


@router.post("", response_model=Trip, status_code=201)
async def create_trip(data: TripCreate, current_user: UserOut = Depends(get_current_user)):
    """Create a new trip."""
    store = get_store()
    return await store.create_trip(current_user.id, data)


@router.post("/{trip_id}/update", response_model=Trip)
async def update_trip(trip_id: int, data: TripUpdate, current_user: UserOut = Depends(get_current_user)):
    """Update trip metadata."""
    store = get_store()
    trip = await store.update_trip(trip_id, current_user.id, data)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip


@router.delete("/{trip_id}")
async def delete_trip(trip_id: int, current_user: UserOut = Depends(get_current_user)):
    """Delete a trip and all associated data."""
    store = get_store()
    if not await store.delete_trip(trip_id, current_user.id):
        raise HTTPException(404, f"Trip {trip_id} not found")
    return {"ok": True}


@router.post("/{trip_id}/persons", response_model=Trip)
async def assign_persons(trip_id: int, person_ids: str, current_user: UserOut = Depends(get_current_user)):
    """
    Set person assignments for a trip.
    Accepts a comma-separated list of person IDs.
    """
    store = get_store()
    ids = [int(x.strip()) for x in person_ids.split(",") if x.strip()]
    trip = await store.set_trip_persons(trip_id, current_user.id, ids)
    if not trip:
        raise HTTPException(404, f"Trip {trip_id} not found")
    return trip
