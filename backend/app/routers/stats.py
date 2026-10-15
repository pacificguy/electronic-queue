from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Service, Ticket, TicketStatus, User
from ..schemas import ServiceStat, StatsOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    services = db.query(Service).order_by(Service.name).all()

    rows = (
        db.query(Ticket.service_id, Ticket.status, func.count(Ticket.id))
        .group_by(Ticket.service_id, Ticket.status)
        .all()
    )
    aggregated: dict[int, dict[str, int]] = {}
    for service_id, ticket_status, count in rows:
        aggregated.setdefault(service_id, {})[ticket_status] = count

    by_service: list[ServiceStat] = []
    totals = {s.value: 0 for s in TicketStatus}
    total_tickets = 0

    for service in services:
        counts = aggregated.get(service.id, {})
        stat = ServiceStat(
            service_id=service.id,
            service_name=service.name,
            total=sum(counts.values()),
            waiting=counts.get(TicketStatus.waiting.value, 0),
            called=counts.get(TicketStatus.called.value, 0),
            served=counts.get(TicketStatus.served.value, 0),
            cancelled=counts.get(TicketStatus.cancelled.value, 0),
        )
        by_service.append(stat)
        total_tickets += stat.total
        totals[TicketStatus.waiting.value] += stat.waiting
        totals[TicketStatus.called.value] += stat.called
        totals[TicketStatus.served.value] += stat.served
        totals[TicketStatus.cancelled.value] += stat.cancelled

    return StatsOut(
        total_tickets=total_tickets,
        waiting=totals[TicketStatus.waiting.value],
        called=totals[TicketStatus.called.value],
        served=totals[TicketStatus.served.value],
        cancelled=totals[TicketStatus.cancelled.value],
        by_service=by_service,
    )
