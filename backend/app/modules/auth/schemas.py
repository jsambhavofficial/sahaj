import uuid

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    display_name: str
    email: str | None = None
    external_ref: str | None = Field(None, description="Dataset id, e.g. COORD_001 or S0001")
    city: str | None = None
    team_id: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    user: UserOut


class PairingCodeRequest(BaseModel):
    senior_id: str


class PairingCodeResponse(BaseModel):
    pairing_code: str = Field(description="6 digits, read out or shown to the senior; single use")
    expires_in: int


class PairRequest(BaseModel):
    pairing_code: str


class PairResponse(TokenResponse):
    senior_id: str
    device_token: str = Field(description="Store securely on the device; used for later logins")


class SeniorLoginRequest(BaseModel):
    senior_id: str
    device_token: str
