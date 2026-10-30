from datetime import timedelta

from app.core.security import create_token
from app.modules.auth.models import AuditLog
from tests.app.factories import PASSWORD, auth, link_family, make_senior, make_user

API = "/api/v1"


def test_login_me_roundtrip(client, db_session):
    coord = make_user(db_session, "coordinator", city="Jaipur")
    r = client.post(f"{API}/auth/login", json={"email": coord.email, "password": PASSWORD})
    body = r.json()
    assert r.status_code == 200 and body["user"]["role"] == "coordinator"
    assert body["expires_in"] > 0 and body["refresh_token"]
    me = client.get(f"{API}/auth/me", headers=auth(client, coord.email))
    assert me.json()["id"] == str(coord.id)
    assert "password_hash" not in me.text


def test_login_failures_share_one_error(client, db_session):
    coord = make_user(db_session, "coordinator")
    inactive = make_user(db_session, "coordinator", active=False)
    cases = [(coord.email, "wrong"), ("nobody@test.local", PASSWORD), (inactive.email, PASSWORD)]
    for email, pw in cases:
        r = client.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"


def test_me_requires_valid_access_token(client, db_session):
    coord = make_user(db_session, "coordinator")
    assert client.get(f"{API}/auth/me").status_code == 401
    assert client.get(f"{API}/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401
    refresh = create_token(str(coord.id), "refresh", timedelta(days=1))  # wrong token type
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {refresh}"}).status_code == 401
    expired = create_token(str(coord.id), "access", timedelta(seconds=-5))
    r = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_expired"


def test_refresh(client, db_session):
    coord = make_user(db_session, "coordinator")
    tokens = client.post(f"{API}/auth/login", json={"email": coord.email, "password": PASSWORD}).json()
    r = client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200 and r.json()["access_token"]
    bad = client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert bad.status_code == 401


def test_deactivated_user_token_stops_working(client, db_session):
    coord = make_user(db_session, "coordinator")
    headers = auth(client, coord.email)
    coord.is_active = False
    db_session.commit()
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 401


def test_senior_pairing_flow(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, suser = make_senior(db_session, coord)
    headers = auth(client, coord.email)
    code = client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": senior.senior_id},
                       headers=headers).json()["pairing_code"]
    paired = client.post(f"{API}/auth/senior/pair", json={"pairing_code": code})
    assert paired.status_code == 200
    body = paired.json()
    assert body["senior_id"] == senior.senior_id and body["user"]["role"] == "senior"
    # single use
    again = client.post(f"{API}/auth/senior/pair", json={"pairing_code": code})
    assert again.status_code == 409 and again.json()["error"]["code"] == "pairing_code_used"
    # device login works with the token and not without it
    ok = client.post(f"{API}/auth/senior/login",
                     json={"senior_id": senior.senior_id, "device_token": body["device_token"]})
    assert ok.status_code == 200 and ok.json()["user"]["id"] == str(suser.id)
    bad = client.post(f"{API}/auth/senior/login",
                      json={"senior_id": senior.senior_id, "device_token": "nope"})
    assert bad.status_code == 401
    # re-pairing issues a new token and the old one stops working
    code2 = client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": senior.senior_id},
                        headers=headers).json()["pairing_code"]
    new = client.post(f"{API}/auth/senior/pair", json={"pairing_code": code2}).json()
    old_login = client.post(f"{API}/auth/senior/login",
                            json={"senior_id": senior.senior_id, "device_token": body["device_token"]})
    assert old_login.status_code == 401 and new["device_token"] != body["device_token"]
    actions = {a.action for a in db_session.query(AuditLog)}
    assert {"issue_pairing_code", "senior_paired"} <= actions


def test_unpaired_senior_cannot_login(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    r = client.post(f"{API}/auth/senior/login", json={"senior_id": senior.senior_id, "device_token": ""})
    assert r.status_code == 401


def test_only_own_coordinator_can_issue_pairing_code(client, db_session):
    a, b = make_user(db_session, "coordinator"), make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, a)
    r = client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": senior.senior_id},
                    headers=auth(client, b.email))
    assert r.status_code == 403
    ops = make_user(db_session, "ops")
    r = client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": senior.senior_id},
                    headers=auth(client, ops.email))
    assert r.status_code == 403
    missing = client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": "S9999"},
                          headers=auth(client, a.email))
    assert missing.status_code == 404


def test_devices_register_and_revoke(client, db_session):
    a, b = make_user(db_session, "coordinator"), make_user(db_session, "coordinator")
    ha, hb = auth(client, a.email), auth(client, b.email)
    body = {"platform": "android", "token": "fcm-token-12345"}
    d = client.post(f"{API}/devices", json=body, headers=ha)
    assert d.status_code == 200
    dev_id = d.json()["id"]
    assert client.post(f"{API}/devices", json=body, headers=ha).json()["id"] == dev_id  # idempotent
    assert client.delete(f"{API}/devices/{dev_id}", headers=hb).status_code == 404  # not b's
    assert client.delete(f"{API}/devices/{dev_id}", headers=ha).status_code == 204
    assert client.post(f"{API}/devices", json={"platform": "palm", "token": "x" * 10},
                       headers=ha).status_code == 422
    assert client.post(f"{API}/devices", json=body).status_code == 401


def test_login_is_rate_limited(client, db_session, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setenv("AUTH_RATE_LIMIT_PER_MINUTE", "3")
    get_settings.cache_clear()
    try:
        codes = [client.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "p"}).status_code
                 for _ in range(5)]
    finally:
        get_settings.cache_clear()
    assert codes == [401, 401, 401, 429, 429]


def _issue(client, headers, senior_id):
    return client.post(f"{API}/auth/senior/pairing-code", json={"senior_id": senior_id}, headers=headers).json()


def test_pairing_code_is_six_digits_and_tolerates_spaces(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    code = _issue(client, auth(client, coord.email), senior.senior_id)["pairing_code"]
    assert len(code) == 6 and code.isdigit()
    spaced = f"{code[:3]} {code[3:]}"
    assert client.post(f"{API}/auth/senior/pair", json={"pairing_code": spaced}).status_code == 200


def test_pairing_code_is_stored_hashed_not_in_clear(client, db_session):
    from app.modules.auth.models import PairingCode
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    code = _issue(client, auth(client, coord.email), senior.senior_id)["pairing_code"]
    row = db_session.query(PairingCode).one()
    assert code not in row.code_hash and row.senior_id == senior.senior_id and row.used_at is None


def test_wrong_or_malformed_pairing_codes_are_rejected(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    code = _issue(client, auth(client, coord.email), senior.senior_id)["pairing_code"]
    wrong = f"{(int(code) + 1) % 10**6:06d}"
    for bad in (wrong, "12345", "abcdef", ""):
        r = client.post(f"{API}/auth/senior/pair", json={"pairing_code": bad})
        assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


def test_issuing_a_new_code_cancels_the_old_one(client, db_session):
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    headers = auth(client, coord.email)
    first = _issue(client, headers, senior.senior_id)["pairing_code"]
    second = _issue(client, headers, senior.senior_id)["pairing_code"]
    assert client.post(f"{API}/auth/senior/pair", json={"pairing_code": first}).status_code == 409
    assert client.post(f"{API}/auth/senior/pair", json={"pairing_code": second}).status_code == 200


def test_expired_pairing_code_is_rejected(client, db_session):
    from datetime import datetime, timedelta, timezone
    from app.modules.auth.models import PairingCode
    coord = make_user(db_session, "coordinator")
    senior, _ = make_senior(db_session, coord)
    code = _issue(client, auth(client, coord.email), senior.senior_id)["pairing_code"]
    db_session.query(PairingCode).update({"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db_session.commit()
    r = client.post(f"{API}/auth/senior/pair", json={"pairing_code": code})
    assert r.status_code == 401 and r.json()["error"]["code"] == "token_expired"


def test_pairing_attempts_are_rate_limited(client, db_session):
    codes = [client.post(f"{API}/auth/senior/pair", json={"pairing_code": "000000"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
