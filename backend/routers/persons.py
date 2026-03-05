"""
TravelMap Backend — Person API Router

Endpoints for managing the global list of named travellers.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models import Person, PersonCreate, PersonUpdate
from dependencies import get_store

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.get("", response_model=list[Person])
async def list_persons():
    """List all persons."""
    store = get_store()
    return await store.get_persons()


@router.post("", response_model=Person, status_code=201)
async def create_person(data: PersonCreate):
    """Create a new person."""
    store = get_store()
    return await store.create_person(data)


@router.post("/{person_id}/update", response_model=Person)
async def update_person(person_id: int, data: PersonUpdate):
    """Update a person's name or colour."""
    store = get_store()
    person = await store.update_person(person_id, data)
    if not person:
        raise HTTPException(404, f"Person {person_id} not found")
    return person


@router.delete("/{person_id}")
async def delete_person(person_id: int):
    """Delete a person."""
    store = get_store()
    if not await store.delete_person(person_id):
        raise HTTPException(404, f"Person {person_id} not found")
    return {}
