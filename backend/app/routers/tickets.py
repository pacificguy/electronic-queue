from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Role, Service, Ticket, TicketStatus, User
from ..schemas import TicketCreate, TicketOut, TicketUpdate

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _next_number(db: Session) -> int:
    current_max = db.query(func.max(Ticket.number)).scalar() or 0
    return current_max + 1


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status_filter: TicketStatus | None = None,
    service_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Администратор видит все талоны, клиент — только свои."""
    query = db.query(Ticket).options(
        joinedload(Ticket.service), joinedload(Ticket.client)
    )
    if current_user.role != Role.admin.value:
        query = query.filter(Ticket.client_id == current_user.id)
    if status_filter:
        query = query.filter(Ticket.status == status_filter.value)
    if service_id:
        query = query.filter(Ticket.service_id == service_id)
    return query.order_by(Ticket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Талон не найден")
    if current_user.role != Role.admin.value and ticket.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к чужому талону")
    return ticket


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = db.get(Service, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    if not service.is_active:
        raise HTTPException(status_code=400, detail="Услуга неактивна")

    ticket = Ticket(
        number=_next_number(db),
        status=TicketStatus.waiting.value,
        client_id=current_user.id,
        service_id=service.id,
        comment=payload.comment,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.put("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Талон не найден")

    is_admin = current_user.role == Role.admin.value
    if not is_admin and ticket.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к чужому талону")

    data = payload.model_dump(exclude_unset=True)

    if not is_admin:
        # Клиент может только отменить свой талон и лишь до вызова.
        if "status" in data and data["status"] != TicketStatus.cancelled:
            raise HTTPException(status_code=403, detail="Клиент может только отменить талон")
        if ticket.status != TicketStatus.waiting.value:
            raise HTTPException(status_code=409, detail="Нельзя изменить талон в текущем статусе")

    if data.get("status") == TicketStatus.cancelled and ticket.status in (
        TicketStatus.served.value,
        TicketStatus.cancelled.value,
    ):
        raise HTTPException(status_code=409, detail="Талон уже закрыт")

    if "status" in data:
        new_status = data["status"]
        ticket.status = new_status.value
        if new_status == TicketStatus.called and not ticket.called_at:
            ticket.called_at = datetime.now(timezone.utc)
        if new_status in (TicketStatus.served, TicketStatus.cancelled):
            ticket.closed_at = datetime.now(timezone.utc)
    if "comment" in data:
        ticket.comment = data["comment"]

    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Талон не найден")
    db.delete(ticket)
    db.commit()
