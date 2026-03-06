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


def _fetch_rate_exchangerate_host(from_code: str, to_code: str) -> float:
    url = f"https://api.exchangerate.host/convert?from={from_code}&to={to_code}&amount=1"
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("success"):
        raise ValueError("exchangerate.host returned unsuccessful response")
    rate = float(payload.get("result", 0))
    if rate <= 0:
        raise ValueError("exchangerate.host returned invalid rate")
    return rate


def _fetch_rate_frankfurter(from_code: str, to_code: str) -> float:
    url = f"https://api.frankfurter.app/latest?from={from_code}&to={to_code}"
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rates = payload.get("rates") or {}
    rate = float(rates.get(to_code, 0))
    if rate <= 0:
        raise ValueError("frankfurter returned invalid rate")
    return rate


def _fetch_rate_open_er_api(from_code: str, to_code: str) -> float:
    url = f"https://open.er-api.com/v6/latest/{from_code}"
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    rates = payload.get("rates") or {}
    rate = float(rates.get(to_code, 0))
    if rate <= 0:
        raise ValueError("open.er-api returned invalid rate")
    return rate


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

    fetchers = (
        _fetch_rate_exchangerate_host,
        _fetch_rate_frankfurter,
        _fetch_rate_open_er_api,
    )

    rate = 0.0
    last_error: Exception | None = None
    for fetch in fetchers:
        try:
            rate = float(fetch(from_code, to_code))
            if rate > 0:
                break
        except Exception as exc:
            last_error = exc

    if rate <= 0:
        # Fallback: use inverse cached pair if available, even if stale.
        inverse_cached = _cache.get((to_code, from_code))
        if inverse_cached and inverse_cached[0] > 0:
            rate = round(1.0 / inverse_cached[0], 8)

    if rate <= 0:
        if cached and cached[0] > 0:
            return cached[0]
        raise ValueError(f"Could not fetch exchange rate ({last_error})" if last_error else "Could not fetch exchange rate")

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
