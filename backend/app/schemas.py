from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import Role, TicketStatus


# ---------- Auth / Users ----------
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(default="", max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserRegister(UserCreate):
    pass


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = None
    role: Optional[Role] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: Role
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- Services ----------
class ServiceBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    duration_minutes: int = Field(default=15, ge=1, le=1440)
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    is_active: Optional[bool] = None


class ServiceOut(ServiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ---------- Tickets ----------
class TicketCreate(BaseModel):
    service_id: int
    comment: str = Field(default="", max_length=1000)


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    comment: Optional[str] = Field(default=None, max_length=1000)


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    number: int
    status: TicketStatus
    comment: str
    client_id: int
    service_id: int
    created_at: datetime
    called_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    service: Optional[ServiceOut] = None
    client: Optional[UserOut] = None


# ---------- Stats ----------
class ServiceStat(BaseModel):
    service_id: int
    service_name: str
    total: int
    waiting: int
    called: int
    served: int
    cancelled: int


class StatsOut(BaseModel):
    total_tickets: int
    waiting: int
    called: int
    served: int
    cancelled: int
    by_service: list[ServiceStat]
