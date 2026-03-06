from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen


SUPPORTED_CURRENCIES = {
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "JPY": "Japanese Yen",
    "AUD": "Australian Dollar",
    "CAD": "Canadian Dollar",
    "CHF": "Swiss Franc",
    "CNY": "Chinese Yuan",
    "INR": "Indian Rupee",
    "SEK": "Swedish Krona",
    "NOK": "Norwegian Krone",
    "DKK": "Danish Krone",
    "NZD": "New Zealand Dollar",
    "SGD": "Singapore Dollar",
    "HKD": "Hong Kong Dollar",
    "MXN": "Mexican Peso",
    "BRL": "Brazilian Real",
    "ZAR": "South African Rand",
    "KRW": "South Korean Won",
    "THB": "Thai Baht",
}

_cache: dict[tuple[str, str], tuple[float, datetime]] = {}


def list_supported_currencies() -> list[dict]:
    return [{"code": code, "name": name} for code, name in sorted(SUPPORTED_CURRENCIES.items())]


def get_rate(from_currency: str, to_currency: str) -> float:
    from_code = from_currency.upper()
    to_code = to_currency.upper()
    if from_code == to_code:
        return 1.0

    cache_key = (from_code, to_code)
    cached = _cache.get(cache_key)
    now = datetime.now(timezone.utc)
    if cached and now - cached[1] < timedelta(hours=6):
        return cached[0]

    url = f"https://api.exchangerate.host/convert?from={from_code}&to={to_code}&amount=1"
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not payload.get("success"):
        raise ValueError("Could not fetch exchange rate")

    rate = float(payload.get("result", 0))
    if rate <= 0:
        raise ValueError("Invalid exchange rate")

    _cache[cache_key] = (rate, now)
    return rate


def convert_amount(amount: float, from_currency: str, to_currency: str) -> dict:
    rate = get_rate(from_currency, to_currency)
    converted = round(amount * rate, 2)
    return {
        "fromCurrency": from_currency.upper(),
        "toCurrency": to_currency.upper(),
        "rate": rate,
        "amount": amount,
        "converted": converted,
    }
