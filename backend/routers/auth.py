from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlite3 import IntegrityError

from auth_utils import create_access_token, hash_password, verify_password
from dependencies import get_current_user, get_store
from models import UserCreate, UserLogin, UserOut, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(data: UserCreate):
    store = get_store()
    existing = await store.get_user_by_username(data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    try:
        user = await store.create_user(
            username=data.username,
            display_name=data.display_name,
            password_hash=hash_password(data.password),
        )
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")

    token = create_access_token(user.id)
    return {"token": token, "user": user.model_dump(by_alias=True)}


@router.post("/login")
async def login(data: UserLogin):
    store = get_store()
    user = await store.get_user_by_username(data.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash = await store.get_user_password_hash(data.username)
    if not password_hash or not verify_password(data.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)
    return {"token": token, "user": user.model_dump(by_alias=True)}


@router.get("/me", response_model=UserOut)
async def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(data: UserUpdate, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    updated = await store.update_user(current_user.id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated
