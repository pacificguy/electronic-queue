import { useEffect, useState } from "react";
import api, { extractError } from "../api";
import { useAuth } from "../AuthContext";

const STATUS_LABELS = {
  waiting: "Ожидает",
  called: "Вызван",
  served: "Обслужен",
  cancelled: "Отменён",
};

function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function fmt(dt) {
  return dt ? new Date(dt).toLocaleString("ru-RU") : "—";
}

export default function TicketsPage() {
  const { isAdmin } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const params = {};
      if (statusFilter) params.status_filter = statusFilter;
      const res = await api.get("/tickets", { params });
      setTickets(res.data);
    } catch (err) {
      setError(extractError(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function changeStatus(ticket, status) {
    setError("");
    setBusyId(ticket.id);
    try {
      await api.put(`/tickets/${ticket.id}`, { status });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removeTicket(ticket) {
    if (!window.confirm(`Удалить талон №${ticket.number}?`)) return;
    setError("");
    try {
      await api.delete(`/tickets/${ticket.id}`);
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  const activeWaiting = tickets.filter((t) => t.status === "waiting").length;

  return (
    <div>
      <div className="page-head">
        <h1>{isAdmin ? "Очередь" : "Мои талоны"}</h1>
        {isAdmin && <p className="muted">Ожидают вызова: {activeWaiting}</p>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isAdmin && (
        <div className="filters">
          <label>
            Фильтр по статусу
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost" onClick={load}>
            Обновить
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Услуга</th>
              {isAdmin && <th>Клиент</th>}
              <th>Статус</th>
              <th>Создан</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.number}</td>
                <td>{t.service?.name || t.service_id}</td>
                {isAdmin && <td>{t.client?.full_name || t.client?.email || t.client_id}</td>}
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td>{fmt(t.created_at)}</td>
                <td>{t.comment || "—"}</td>
                <td className="actions">
                  {isAdmin && t.status === "waiting" && (
                    <button
                      className="btn btn-small"
                      disabled={busyId === t.id}
                      onClick={() => changeStatus(t, "called")}
                    >
                      Вызвать
                    </button>
                  )}
                  {isAdmin && t.status === "called" && (
                    <button
                      className="btn btn-small btn-primary"
                      disabled={busyId === t.id}
                      onClick={() => changeStatus(t, "served")}
                    >
                      Завершить
                    </button>
                  )}
                  {isAdmin && ["waiting", "called"].includes(t.status) && (
                    <button
                      className="btn btn-small btn-danger"
                      disabled={busyId === t.id}
                      onClick={() => changeStatus(t, "cancelled")}
                    >
                      Отменить
                    </button>
                  )}
                  {isAdmin && (
                    <button className="btn btn-small btn-ghost" onClick={() => removeTicket(t)}>
                      Удалить
                    </button>
                  )}
                  {!isAdmin && t.status === "waiting" && (
                    <button
                      className="btn btn-small btn-danger"
                      disabled={busyId === t.id}
                      onClick={() => changeStatus(t, "cancelled")}
                    >
                      Отменить
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="muted center">
                  Талоны отсутствуют
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
