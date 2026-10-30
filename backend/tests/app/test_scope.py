import pytest

from app.core.exceptions import Forbidden, NotFound
from app.modules.auth import scope
from app.modules.seniors.models import Senior
from tests.app.factories import link_family, make_senior, make_user


@pytest.fixture
def world(db_session):
    db = db_session
    c1, c2 = make_user(db, "coordinator", city="Jaipur"), make_user(db, "coordinator", city="Pune")
    s1, u1 = make_senior(db, c1, city="Jaipur")
    s2, u2 = make_senior(db, c2, city="Pune")
    fam = make_user(db, "family")
    return dict(db=db, c1=c1, c2=c2, s1=s1, s2=s2, u1=u1, u2=u2, fam=fam)


def ids(db, user):
    return set(db.scalars(scope.accessible_senior_ids(db, user)))


def test_coordinator_sees_only_own_caseload(world):
    db, w = world["db"], world
    assert scope.require_senior_access(db, w["c1"], w["s1"].senior_id)
    with pytest.raises(Forbidden):
        scope.require_senior_access(db, w["c1"], w["s2"].senior_id)
    assert ids(db, w["c1"]) == {w["s1"].senior_id}


def test_senior_sees_only_self(world):
    db, w = world["db"], world
    assert scope.require_senior_access(db, w["u1"], w["s1"].senior_id)
    with pytest.raises(Forbidden):
        scope.require_senior_access(db, w["u1"], w["s2"].senior_id)
    assert ids(db, w["u1"]) == {w["s1"].senior_id}


def test_ops_scoped_by_city_and_admin_sees_all(world):
    db, w = world["db"], world
    ops_jaipur = make_user(db, "ops", city="Jaipur")
    ops_all = make_user(db, "ops")
    admin = make_user(db, "admin")
    assert ids(db, ops_jaipur) == {w["s1"].senior_id}
    with pytest.raises(Forbidden):
        scope.require_senior_access(db, ops_jaipur, w["s2"].senior_id)
    both = {w["s1"].senior_id, w["s2"].senior_id}
    assert ids(db, ops_all) == both and ids(db, admin) == both
    assert scope.require_senior_access(db, admin, w["s2"].senior_id)


def test_family_has_no_generic_access(world):
    db, w = world["db"], world
    link_family(db, w["fam"], w["s1"])
    assert ids(db, w["fam"]) == set()
    with pytest.raises(Forbidden):
        scope.require_senior_access(db, w["fam"], w["s1"].senior_id)


def test_unknown_senior_is_not_found(world):
    with pytest.raises(NotFound):
        scope.require_senior_access(world["db"], world["c1"], "S9999")


def test_family_consent_levels(world):
    db, w = world["db"], world
    link_family(db, w["fam"], w["s1"], level="summary_and_urgent")
    level = scope.family_consent_level(db, w["fam"], w["s1"].senior_id)
    assert level == "summary_and_urgent"
    assert scope.family_allows(level, "urgent_only") and scope.family_allows(level, "summary_and_urgent")
    assert not scope.family_allows(level, "full")
    with pytest.raises(Forbidden):  # no link to s2
        scope.family_consent_level(db, w["fam"], w["s2"].senior_id)


def test_family_without_consent_is_refused(world):
    db, w = world["db"], world
    link_family(db, w["fam"], w["s1"], consent=False)
    with pytest.raises(Forbidden):
        scope.family_consent_level(db, w["fam"], w["s1"].senior_id)
