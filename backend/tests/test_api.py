import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["DB_NAME"] = "test_travelmap.db"

from main import app
from dependencies import clear_rate_limits, set_store
from store import Store


@pytest.fixture(autouse=True)
async def setup_db():
    clear_rate_limits()
    db_path = Path("test_travelmap.db")
    if db_path.exists():
        db_path.unlink()

    store = Store(Path("test_travelmap.db"))
    set_store(store)
    await store.connect()
    yield
    await store.close()
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
async def authed_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        register = await client.post(
            "/api/auth/register",
            json={"username": "alice", "displayName": "Alice", "password": "secret"},
        )
        assert register.status_code == 201
        token = register.json()["token"]
        client.headers.update({"Authorization": f"Bearer {token}"})
        yield client


@pytest.mark.asyncio
async def test_auth_me(authed_client: AsyncClient):
    res = await authed_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["username"] == "alice"


@pytest.mark.asyncio
async def test_create_and_list_trips(authed_client: AsyncClient):
    created = await authed_client.post(
        "/api/trips",
        json={"name": "Japan", "color": "#FF0000", "visibility": "friends_only"},
    )
    assert created.status_code == 201

    listed = await authed_client.get("/api/trips")
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Japan"


@pytest.mark.asyncio
async def test_upload_unattached_and_assign_photo(authed_client: AsyncClient):
    trip = await authed_client.post(
        "/api/trips",
        json={"name": "Photo Trip", "color": "#00AAFF", "visibility": "friends_only"},
    )
    trip_id = trip.json()["id"]

    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xf4\x8f\x93\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("tiny.png", png_bytes, "image/png")}

    upload = await authed_client.post("/api/photos/upload", files=files)
    assert upload.status_code == 201
    photo_id = upload.json()["id"]

    assign = await authed_client.post(
        f"/api/photos/{photo_id}/assign",
        json={"tripId": trip_id, "placeId": None},
    )
    assert assign.status_code == 200
    assert assign.json()["id"] == photo_id

    all_photos = await authed_client.get("/api/photos")
    assert all_photos.status_code == 200
    assert len(all_photos.json()) == 1
    assert all_photos.json()[0]["tripId"] == trip_id


@pytest.mark.asyncio
async def test_notifications_for_friend_request_and_read_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as alice_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as bob_client:
        alice_register = await alice_client.post(
            "/api/auth/register",
            json={"username": "alice", "displayName": "Alice", "password": "secret"},
        )
        bob_register = await bob_client.post(
            "/api/auth/register",
            json={"username": "bob", "displayName": "Bob", "password": "secret"},
        )
        assert alice_register.status_code == 201
        assert bob_register.status_code == 201

        alice_client.headers.update({"Authorization": f"Bearer {alice_register.json()['token']}"})
        bob_client.headers.update({"Authorization": f"Bearer {bob_register.json()['token']}"})

        sent = await bob_client.post("/api/social/friend-requests", json={"username": "alice"})
        assert sent.status_code == 201

        unread = await alice_client.get("/api/notifications/unread-count")
        assert unread.status_code == 200
        assert unread.json()["count"] == 1

        notifications = await alice_client.get("/api/notifications")
        assert notifications.status_code == 200
        payload = notifications.json()
        assert len(payload) >= 1
        assert payload[0]["type"] == "friend_request_received"
        assert payload[0]["isRead"] is False

        mark = await alice_client.post("/api/notifications/read", json={"ids": [payload[0]["id"]]})
        assert mark.status_code == 200
        assert mark.json()["updated"] == 1

        unread_after = await alice_client.get("/api/notifications/unread-count")
        assert unread_after.status_code == 200
        assert unread_after.json()["count"] == 0


@pytest.mark.asyncio
async def test_trip_invite_creates_notification_for_invited_friend():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as alice_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as bob_client:
        alice_register = await alice_client.post(
            "/api/auth/register",
            json={"username": "alice", "displayName": "Alice", "password": "secret"},
        )
        bob_register = await bob_client.post(
            "/api/auth/register",
            json={"username": "bob", "displayName": "Bob", "password": "secret"},
        )
        assert alice_register.status_code == 201
        assert bob_register.status_code == 201

        alice_client.headers.update({"Authorization": f"Bearer {alice_register.json()['token']}"})
        bob_client.headers.update({"Authorization": f"Bearer {bob_register.json()['token']}"})

        request = await bob_client.post("/api/social/friend-requests", json={"username": "alice"})
        assert request.status_code == 201
        accepted = await alice_client.post(f"/api/social/friend-requests/{request.json()['id']}/accept")
        assert accepted.status_code == 200

        trip = await alice_client.post(
            "/api/trips",
            json={"name": "Iceland", "color": "#00AAFF", "visibility": "friends_only"},
        )
        assert trip.status_code == 201

        invited = await alice_client.post(f"/api/trips/{trip.json()['id']}/members/{bob_register.json()['user']['id']}")
        assert invited.status_code == 200

        notifications = await bob_client.get("/api/notifications")
        assert notifications.status_code == 200
        trip_invites = [n for n in notifications.json() if n["type"] == "trip_invite"]
        assert len(trip_invites) == 1
        assert trip_invites[0]["payload"]["tripId"] == trip.json()["id"]


@pytest.mark.asyncio
async def test_trip_member_roles_affect_edit_permissions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as owner_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as member_client:
        owner_register = await owner_client.post(
            "/api/auth/register",
            json={"username": "owner2", "displayName": "Owner", "password": "secret"},
        )
        member_register = await member_client.post(
            "/api/auth/register",
            json={"username": "member", "displayName": "Member", "password": "secret"},
        )
        assert owner_register.status_code == 201
        assert member_register.status_code == 201

        owner_client.headers.update({"Authorization": f"Bearer {owner_register.json()['token']}"})
        member_client.headers.update({"Authorization": f"Bearer {member_register.json()['token']}"})

        request = await member_client.post("/api/social/friend-requests", json={"username": "owner2"})
        assert request.status_code == 201
        accepted = await owner_client.post(f"/api/social/friend-requests/{request.json()['id']}/accept")
        assert accepted.status_code == 200

        trip = await owner_client.post(
            "/api/trips",
            json={"name": "Role Test", "color": "#1144AA", "visibility": "friends_only"},
        )
        assert trip.status_code == 201
        trip_id = trip.json()["id"]

        invited = await owner_client.post(
            f"/api/trips/{trip_id}/members/{member_register.json()['user']['id']}?role=viewer"
        )
        assert invited.status_code == 200

        member_trip = await member_client.get(f"/api/trips/{trip_id}")
        assert member_trip.status_code == 200
        assert member_trip.json()["accessRole"] == "viewer"

        cannot_add_place = await member_client.post(
            f"/api/trips/{trip_id}/places",
            json={"name": "Blocked", "lat": 40.0, "lng": -73.0, "note": ""},
        )
        assert cannot_add_place.status_code == 403

        role_update = await owner_client.post(
            f"/api/trips/{trip_id}/members/{member_register.json()['user']['id']}/role",
            json={"role": "editor"},
        )
        assert role_update.status_code == 200

        can_add_place = await member_client.post(
            f"/api/trips/{trip_id}/places",
            json={"name": "Now Allowed", "lat": 51.5, "lng": -0.1, "note": ""},
        )
        assert can_add_place.status_code == 201


@pytest.mark.asyncio
async def test_unified_search_returns_grouped_results(authed_client: AsyncClient):
    created = await authed_client.post(
        "/api/trips",
        json={"name": "Tokyo Adventure", "color": "#22AAEE", "visibility": "friends_only"},
    )
    assert created.status_code == 201
    trip_id = created.json()["id"]

    place = await authed_client.post(
        f"/api/trips/{trip_id}/places",
        json={"name": "Tokyo Tower", "lat": 35.6586, "lng": 139.7454, "note": "sunset"},
    )
    assert place.status_code == 201

    search = await authed_client.get("/api/search?q=tokyo")
    assert search.status_code == 200
    payload = search.json()
    assert any(t["name"] == "Tokyo Adventure" for t in payload["trips"])
    assert any(p["name"] == "Tokyo Tower" for p in payload["places"])


@pytest.mark.asyncio
async def test_login_rate_limit_blocks_excessive_attempts():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        register = await client.post(
            "/api/auth/register",
            json={"username": "ratelimit-user", "displayName": "Rate User", "password": "secret"},
        )
        assert register.status_code == 201

        latest_status = 0
        for _ in range(26):
            login = await client.post(
                "/api/auth/login",
                json={"username": "ratelimit-user", "password": "wrong-pass"},
            )
            latest_status = login.status_code

        assert latest_status == 429


@pytest.mark.asyncio
async def test_trip_comments_and_reactions(authed_client: AsyncClient):
    created = await authed_client.post(
        "/api/trips",
        json={"name": "Commentable Trip", "color": "#FF8800", "visibility": "friends_only"},
    )
    assert created.status_code == 201
    trip_id = created.json()["id"]

    comment = await authed_client.post(
        "/api/comments",
        json={"entityType": "trip", "entityId": trip_id, "body": "Great route and photos."},
    )
    assert comment.status_code == 201
    comment_payload = comment.json()
    assert comment_payload["body"] == "Great route and photos."
    assert comment_payload["reactions"] == []

    listed = await authed_client.get(f"/api/comments?entity_type=trip&entity_id={trip_id}")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    reacted = await authed_client.post(
        f"/api/comments/{comment_payload['id']}/reactions",
        json={"emoji": "👍"},
    )
    assert reacted.status_code == 200
    assert reacted.json()[0]["emoji"] == "👍"
    assert reacted.json()[0]["count"] == 1
    assert reacted.json()[0]["reacted"] is True

    deleted = await authed_client.delete(f"/api/comments/{comment_payload['id']}")
    assert deleted.status_code == 200


@pytest.mark.asyncio
async def test_trip_expense_settlement_summary(authed_client: AsyncClient):
    trip = await authed_client.post(
        "/api/trips",
        json={"name": "Settlement Trip", "color": "#33AA99", "visibility": "friends_only"},
    )
    assert trip.status_code == 201
    trip_id = trip.json()["id"]

    exp_a = await authed_client.post(
        f"/api/trips/{trip_id}/expenses",
        json={"amount": 60, "currency": "USD", "note": "Hotel"},
    )
    assert exp_a.status_code == 201

    settlement = await authed_client.get(f"/api/trips/{trip_id}/expenses/settlement")
    assert settlement.status_code == 200
    payload = settlement.json()
    assert payload["total"] >= 60
    assert payload["perPerson"] >= 60
    assert len(payload["participants"]) >= 1


@pytest.mark.asyncio
async def test_comment_mentions_create_notification_for_mentioned_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as alice_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as bob_client:
        alice_register = await alice_client.post(
            "/api/auth/register",
            json={"username": "alice77", "displayName": "Alice", "password": "secret"},
        )
        bob_register = await bob_client.post(
            "/api/auth/register",
            json={"username": "bob77", "displayName": "Bob", "password": "secret"},
        )
        assert alice_register.status_code == 201
        assert bob_register.status_code == 201

        alice_client.headers.update({"Authorization": f"Bearer {alice_register.json()['token']}"})
        bob_client.headers.update({"Authorization": f"Bearer {bob_register.json()['token']}"})

        request = await bob_client.post("/api/social/friend-requests", json={"username": "alice77"})
        assert request.status_code == 201
        accepted = await alice_client.post(f"/api/social/friend-requests/{request.json()['id']}/accept")
        assert accepted.status_code == 200

        trip = await alice_client.post(
            "/api/trips",
            json={"name": "Mention Trip", "color": "#0099AA", "visibility": "friends_only"},
        )
        assert trip.status_code == 201
        trip_id = trip.json()["id"]

        invited = await alice_client.post(f"/api/trips/{trip_id}/members/{bob_register.json()['user']['id']}?role=viewer")
        assert invited.status_code == 200

        comment = await bob_client.post(
            "/api/comments",
            json={"entityType": "trip", "entityId": trip_id, "body": "Looks great @alice77"},
        )
        assert comment.status_code == 201

        alice_notifications = await alice_client.get("/api/notifications")
        assert alice_notifications.status_code == 200
        mention_notifications = [n for n in alice_notifications.json() if n["type"] == "comment_mention"]
        assert len(mention_notifications) >= 1


@pytest.mark.asyncio
async def test_custom_expense_split_affects_settlement():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as owner_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as member_client:
        owner_register = await owner_client.post(
            "/api/auth/register",
            json={"username": "splitowner", "displayName": "Split Owner", "password": "secret"},
        )
        member_register = await member_client.post(
            "/api/auth/register",
            json={"username": "splitmember", "displayName": "Split Member", "password": "secret"},
        )
        assert owner_register.status_code == 201
        assert member_register.status_code == 201

        owner_client.headers.update({"Authorization": f"Bearer {owner_register.json()['token']}"})
        member_client.headers.update({"Authorization": f"Bearer {member_register.json()['token']}"})

        req = await member_client.post("/api/social/friend-requests", json={"username": "splitowner"})
        assert req.status_code == 201
        accepted = await owner_client.post(f"/api/social/friend-requests/{req.json()['id']}/accept")
        assert accepted.status_code == 200

        trip = await owner_client.post(
            "/api/trips",
            json={"name": "Custom Split Trip", "color": "#3355AA", "visibility": "friends_only"},
        )
        assert trip.status_code == 201
        trip_id = trip.json()["id"]

        invited = await owner_client.post(
            f"/api/trips/{trip_id}/members/{member_register.json()['user']['id']}?role=editor"
        )
        assert invited.status_code == 200

        expense = await owner_client.post(
            f"/api/trips/{trip_id}/expenses",
            json={
                "amount": 80,
                "currency": "USD",
                "note": "Dinner",
                "splitMode": "custom_amount",
                "participantUserIds": [owner_register.json()["user"]["id"], member_register.json()["user"]["id"]],
                "customShares": {
                    str(owner_register.json()["user"]["id"]): 20,
                    str(member_register.json()["user"]["id"]): 60,
                },
            },
        )
        assert expense.status_code == 201

        settlement = await owner_client.get(f"/api/trips/{trip_id}/expenses/settlement")
        assert settlement.status_code == 200
        payload = settlement.json()
        transfers = payload["transfers"]
        assert len(transfers) == 1
        assert transfers[0]["amount"] == 60.0
        assert len(payload["expenseBreakdowns"]) == 1
        breakdown = payload["expenseBreakdowns"][0]
        assert breakdown["note"] == "Dinner"
        assert len(breakdown["shares"]) == 2

        invalid_split = await owner_client.post(
            f"/api/trips/{trip_id}/expenses",
            json={
                "amount": 50,
                "currency": "USD",
                "note": "Invalid",
                "splitMode": "custom_amount",
                "participantUserIds": [owner_register.json()["user"]["id"], member_register.json()["user"]["id"]],
                "customShares": {
                    str(owner_register.json()["user"]["id"]): 10,
                    str(member_register.json()["user"]["id"]): 10,
                },
            },
        )
        assert invalid_split.status_code == 400


@pytest.mark.asyncio
async def test_photo_comment_notification_and_counts_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as owner_client, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as commenter_client:
        owner_register = await owner_client.post(
            "/api/auth/register",
            json={"username": "photoowner", "displayName": "Photo Owner", "password": "secret"},
        )
        commenter_register = await commenter_client.post(
            "/api/auth/register",
            json={"username": "photocommenter", "displayName": "Photo Commenter", "password": "secret"},
        )
        assert owner_register.status_code == 201
        assert commenter_register.status_code == 201

        owner_client.headers.update({"Authorization": f"Bearer {owner_register.json()['token']}"})
        commenter_client.headers.update({"Authorization": f"Bearer {commenter_register.json()['token']}"})

        request = await commenter_client.post("/api/social/friend-requests", json={"username": "photoowner"})
        assert request.status_code == 201
        accepted = await owner_client.post(f"/api/social/friend-requests/{request.json()['id']}/accept")
        assert accepted.status_code == 200

        trip = await owner_client.post(
            "/api/trips",
            json={"name": "Photo Notify", "color": "#556677", "visibility": "friends_only"},
        )
        assert trip.status_code == 201
        trip_id = trip.json()["id"]

        invite = await owner_client.post(
            f"/api/trips/{trip_id}/members/{commenter_register.json()['user']['id']}?role=viewer"
        )
        assert invite.status_code == 200

        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xf4\x8f\x93\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        uploaded = await owner_client.post(
            "/api/photos/upload",
            files={"file": ("tiny.png", png_bytes, "image/png")},
        )
        assert uploaded.status_code == 201
        photo_id = uploaded.json()["id"]

        assigned = await owner_client.post(
            f"/api/photos/{photo_id}/assign",
            json={"tripId": trip_id},
        )
        assert assigned.status_code == 200

        comment = await commenter_client.post(
            "/api/comments",
            json={"entityType": "photo", "entityId": photo_id, "body": "Great shot"},
        )
        assert comment.status_code == 201

        counts = owner_client.get(f"/api/comments/counts?entity_type=photo&entity_ids={photo_id}")
        counts_res = await counts
        assert counts_res.status_code == 200
        assert counts_res.json().get(str(photo_id)) == 1

        notifications = await owner_client.get("/api/notifications")
        assert notifications.status_code == 200
        assert any(n["type"] == "photo_commented" for n in notifications.json())
