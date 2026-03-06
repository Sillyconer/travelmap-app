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
