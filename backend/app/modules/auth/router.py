from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.ratelimit import limit
from app.core.deps import get_current_user, require_role
from app.modules.auth import service
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    LoginRequest, PairingCodeRequest, PairingCodeResponse, PairRequest, PairResponse,
    RefreshRequest, SeniorLoginRequest, TokenResponse, UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", dependencies=[Depends(limit("login"))], response_model=TokenResponse, summary="Log in staff or demo family accounts")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    return service.login(db, body.email, body.password)


@router.post("/refresh", dependencies=[Depends(limit("refresh"))], response_model=TokenResponse, summary="Exchange a refresh token for new tokens")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    return service.refresh(db, body.refresh_token)


@router.get("/me", response_model=UserOut, summary="The current user")
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/senior/pairing-code", response_model=PairingCodeResponse,
             summary="Coordinator issues a single-use code to pair a senior's device")
def pairing_code(body: PairingCodeRequest, user: User = Depends(require_role("coordinator", "admin")),
                 db: Session = Depends(get_db)):
    code, expires_in = service.create_pairing_code(db, user, body.senior_id)
    return PairingCodeResponse(pairing_code=code, expires_in=expires_in)


@router.post("/senior/pair", dependencies=[Depends(limit("pair", per_minute=10))], response_model=PairResponse, summary="Senior device redeems a pairing code")
def pair(body: PairRequest, db: Session = Depends(get_db)):
    return service.pair(db, body.pairing_code)


@router.post("/senior/login", dependencies=[Depends(limit("senior_login"))], response_model=TokenResponse, summary="Senior device login")
def senior_login(body: SeniorLoginRequest, db: Session = Depends(get_db)):
    return service.senior_login(db, body.senior_id, body.device_token)
