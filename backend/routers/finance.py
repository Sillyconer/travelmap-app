from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies import get_current_user, get_store
from models import ExpenseOut, UserOut
from services.currency_service import convert_amount, list_supported_currencies

router = APIRouter(prefix="/api", tags=["finance"])


class ConvertRequest(BaseModel):
    amount: float
    from_currency: str = Field(alias="fromCurrency")
    to_currency: str = Field(alias="toCurrency")

    model_config = {"populate_by_name": True}


class ExpenseRequest(BaseModel):
    amount: float
    currency: str
    place_id: int | None = Field(None, alias="placeId")
    note: str = ""
    split_mode: str = Field("equal", alias="splitMode")
    participant_user_ids: list[int] | None = Field(None, alias="participantUserIds")
    custom_shares: dict[str, float] | None = Field(None, alias="customShares")

    model_config = {"populate_by_name": True}


@router.get("/currencies")
async def get_currencies():
    return list_supported_currencies()


@router.post("/currency/convert")
async def convert_currency(data: ConvertRequest):
    try:
        return convert_amount(data.amount, data.from_currency, data.to_currency)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/trips/{trip_id}/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(trip_id: int, data: ExpenseRequest, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_access_trip(current_user.id, trip_id):
        raise HTTPException(status_code=404, detail="Trip not found")
    if not await store.user_can_edit_trip(current_user.id, trip_id):
        raise HTTPException(status_code=403, detail="You only have viewer access to this trip")

    home_currency = current_user.home_currency or "USD"
    try:
        conversion = convert_amount(data.amount, data.currency, home_currency)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    trip_participants = await store.get_trip_participant_ids(trip_id)
    if not trip_participants:
        raise HTTPException(status_code=400, detail="Trip has no participants")

    requested_participants = data.participant_user_ids if data.participant_user_ids else trip_participants
    participant_ids = sorted({int(uid) for uid in requested_participants})
    if not participant_ids:
        raise HTTPException(status_code=400, detail="At least one participant is required")
    if any(uid not in trip_participants for uid in participant_ids):
        raise HTTPException(status_code=400, detail="Split contains users outside this trip")

    split_mode = data.split_mode.strip().lower()
    split_rows: list[tuple[int, float]] = []
    if split_mode == "equal":
        equal_share = conversion["converted"] / len(participant_ids)
        split_rows = [(uid, equal_share) for uid in participant_ids]
    elif split_mode == "custom":
        custom = data.custom_shares or {}
        weighted_users = [(uid, float(custom.get(str(uid), 0.0))) for uid in participant_ids]
        weighted_users = [(uid, weight) for uid, weight in weighted_users if weight > 0]
        if not weighted_users:
            raise HTTPException(status_code=400, detail="Custom split requires positive shares")
        total_weight = sum(weight for _, weight in weighted_users)
        split_rows = [
            (uid, conversion["converted"] * (weight / total_weight))
            for uid, weight in weighted_users
        ]
    else:
        raise HTTPException(status_code=400, detail="Unsupported split mode")

    return await store.create_expense(
        user_id=current_user.id,
        trip_id=trip_id,
        place_id=data.place_id,
        amount=data.amount,
        currency=data.currency,
        amount_home=conversion["converted"],
        home_currency=home_currency,
        rate_used=conversion["rate"],
        note=data.note,
        splits_home=split_rows,
    )


@router.get("/trips/{trip_id}/expenses", response_model=list[ExpenseOut])
async def list_expenses(trip_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_access_trip(current_user.id, trip_id):
        raise HTTPException(status_code=404, detail="Trip not found")
    return await store.list_expenses(trip_id, current_user.id)


@router.get("/trips/{trip_id}/expenses/settlement", response_model=dict)
async def get_trip_settlement(trip_id: int, current_user: UserOut = Depends(get_current_user)):
    store = get_store()
    if not await store.user_can_access_trip(current_user.id, trip_id):
        raise HTTPException(status_code=404, detail="Trip not found")
    return await store.get_trip_settlement(trip_id, current_user.id)
