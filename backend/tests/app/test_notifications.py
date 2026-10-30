import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.integrations.stub.providers import StubPush
from app.modules.notifications import service
from app.modules.notifications.models import Notification
from tests.app.factories import auth, make_device, make_senior, make_user

API = "/api/v1"
NOW = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def push(monkeypatch):
    p = StubPush()
    monkeypatch.setattr(service, "get_push", lambda: p)
    return p


def test_notify_creates_pending_generic_row(db_session):
    u = make_user(db_session, "coordinator")
    n = service.notify(db_session, u.id, "alert_new", "New alert", "Call 98765 43210 now",
                       data={"alert_id": "ALT_1", "note": "free text", "n": None})
    assert n.delivery_status == "pending"
    assert "98765" not in n.body and "[number]" in n.body
    assert n.data == {"alert_id": "ALT_1"}  # only id keys survive
    assert n.scheduled_for is not None


def test_notify_rejects_unknown_kind(db_session):
    u = make_user(db_session, "coordinator")
    with pytest.raises(service.InvalidNotification):
        service.notify(db_session, u.id, "bogus", "t", "b")


def test_send_pending_sends_and_is_idempotent(db_session, push):
    u = make_user(db_session, "coordinator")
    make_device(db_session, u, "token-a-12345")
    make_device(db_session, u, "token-b-12345")
    service.notify(db_session, u.id, "alert_new", "New alert", "Open the app", {"alert_id": "A1"},
                   scheduled_for=NOW)
    assert service.send_pending(db_session, now=NOW + timedelta(minutes=1)) == 1
    assert len(push.sent) == 2 and push.sent[0]["data"] == {"alert_id": "A1"}
    n = db_session.query(Notification).one()
    assert n.delivery_status == "sent" and n.sent_at is not None
    assert service.send_pending(db_session, now=NOW + timedelta(minutes=2)) == 0
    assert len(push.sent) == 2


def test_send_pending_skips_without_devices_and_future_and_stale(db_session, push):
    u = make_user(db_session, "coordinator")
    make_device(db_session, u)
    other = make_user(db_session, "coordinator")  # no device
    service.notify(db_session, other.id, "alert_new", "t", "b", scheduled_for=NOW)
    future = service.notify(db_session, u.id, "alert_new", "t", "b", scheduled_for=NOW + timedelta(hours=1))
    stale = service.notify(db_session, u.id, "alert_new", "t", "b", scheduled_for=NOW - timedelta(hours=8))
    assert service.send_pending(db_session, now=NOW) == 0
    rows = {n.id: n.delivery_status for n in db_session.query(Notification)}
    assert rows[future.id] == "pending" and rows[stale.id] == "skipped"
    assert sorted(rows.values()) == ["pending", "skipped", "skipped"]
    assert push.sent == []


def test_rejected_token_is_revoked_and_marked_failed(db_session, monkeypatch):
    class Rejecting:
        def send(self, *a, **k):
            return False

    monkeypatch.setattr(service, "get_push", lambda: Rejecting())
    u = make_user(db_session, "coordinator")
    dev = make_device(db_session, u)
    service.notify(db_session, u.id, "alert_new", "t", "b", scheduled_for=NOW)
    assert service.send_pending(db_session, now=NOW) == 0
    assert db_session.query(Notification).one().delivery_status == "failed"
    db_session.refresh(dev)
    assert dev.revoked_at is not None


def test_provider_exception_marks_failed_keeps_token(db_session, monkeypatch):
    class Boom:
        def send(self, *a, **k):
            raise RuntimeError("down")

    monkeypatch.setattr(service, "get_push", lambda: Boom())
    u = make_user(db_session, "coordinator")
    dev = make_device(db_session, u)
    service.notify(db_session, u.id, "alert_new", "t", "b", scheduled_for=NOW)
    service.send_pending(db_session, now=NOW)
    assert db_session.query(Notification).one().delivery_status == "failed"
    db_session.refresh(dev)
    assert dev.revoked_at is None


def _seed(db_session):
    u = make_user(db_session, "coordinator")
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    for i in range(3):
        service.notify(db_session, u.id, "alert_new", f"t{i}", "b", scheduled_for=past - timedelta(minutes=i))
    service.notify(db_session, u.id, "alert_new", "later", "b",
                   scheduled_for=datetime.now(timezone.utc) + timedelta(hours=2))
    return u


def test_list_paginates_filters_unread_and_hides_future(client, db_session):
    u = _seed(db_session)
    h = auth(client, u.email)
    r = client.get(f"{API}/notifications", headers=h, params={"limit": 2})
    body = r.json()
    assert r.status_code == 200 and body["total"] == 3 and len(body["items"]) == 2
    assert body["limit"] == 2 and body["offset"] == 0
    assert set(body["items"][0]) == {"id", "kind", "title", "body", "data", "scheduled_for",
                                     "sent_at", "read_at"}
    nid = body["items"][0]["id"]
    assert client.post(f"{API}/notifications/{nid}/read", headers=h).status_code == 204
    assert client.post(f"{API}/notifications/{nid}/read", headers=h).status_code == 204  # idempotent
    unread = client.get(f"{API}/notifications", headers=h, params={"unread": True}).json()
    assert unread["total"] == 2 and nid not in [i["id"] for i in unread["items"]]


def test_list_validation_and_auth(client, db_session):
    u = _seed(db_session)
    h = auth(client, u.email)
    assert client.get(f"{API}/notifications").status_code == 401
    assert client.get(f"{API}/notifications", headers=h, params={"limit": 500}).status_code == 422
    assert client.get(f"{API}/notifications", headers=h, params={"offset": -1}).status_code == 422
    assert client.post(f"{API}/notifications/not-a-uuid/read", headers=h).status_code == 422


def test_only_own_rows(client, db_session):
    u, other = _seed(db_session), make_user(db_session, "coordinator")
    nid = db_session.query(Notification).filter_by(user_id=u.id).first().id
    ho = auth(client, other.email)
    assert client.get(f"{API}/notifications", headers=ho).json()["total"] == 0
    assert client.post(f"{API}/notifications/{nid}/read", headers=ho).status_code == 404
    assert client.post(f"{API}/notifications/{uuid.uuid4()}/read", headers=ho).status_code == 404
    assert client.post(f"{API}/notifications/{nid}/read").status_code == 401
    assert db_session.get(Notification, nid).read_at is None


def test_me_notifications_senior_only(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, suser = make_senior(db_session, coord)
    service.notify(db_session, suser.id, "medication_reminder", "t", "b",
                   scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=1))
    from app.core.security import create_token
    tok = create_token(str(suser.id), "access", timedelta(minutes=5))
    hs = {"Authorization": f"Bearer {tok}"}
    r = client.get(f"{API}/me/notifications", headers=hs)
    assert r.status_code == 200 and r.json()["total"] == 1
    assert client.get(f"{API}/me/notifications", headers=auth(client, coord.email)).status_code == 403
    assert client.get(f"{API}/me/notifications").status_code == 401
