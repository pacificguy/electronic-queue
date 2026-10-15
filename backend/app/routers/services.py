from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Service, Ticket, TicketStatus, User
from ..schemas import ServiceCreate, ServiceOut, ServiceUpdate

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
def list_services(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список услуг. Клиент видит только активные, администратор — все."""
    query = db.query(Service)
    if current_user.role != "admin" or not include_inactive:
        query = query.filter(Service.is_active.is_(True))
    return query.order_by(Service.name).all()


@router.get("/{service_id}", response_model=ServiceOut)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    return service


@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = Service(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.put("/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    active = (
        db.query(Ticket)
        .filter(
            Ticket.service_id == service_id,
            Ticket.status.in_([TicketStatus.waiting.value, TicketStatus.called.value]),
        )
        .count()
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail="Нельзя удалить услугу: есть активные талоны. Отключите её вместо удаления.",
        )

    db.delete(service)
    db.commit()
