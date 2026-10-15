import { useEffect, useState } from "react";
import api, { extractError } from "../api";

export default function AdminStatsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/stats")
      .then((res) => setStats(res.data))
      .catch((err) => setError(extractError(err)));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div className="loading">Загрузка…</div>;

  const cards = [
    { label: "Всего талонов", value: stats.total_tickets, cls: "" },
    { label: "Ожидают", value: stats.waiting, cls: "status-waiting" },
    { label: "Вызваны", value: stats.called, cls: "status-called" },
    { label: "Обслужены", value: stats.served, cls: "status-served" },
    { label: "Отменены", value: stats.cancelled, cls: "status-cancelled" },
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Отчёты</h1>
      </div>

      <div className="stat-cards">
        {cards.map((c) => (
          <div className={`card stat-card ${c.cls}`} key={c.label}>
            <span className="stat-value">{c.value}</span>
            <span className="stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <h2>По услугам</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Всего</th>
              <th>Ожидают</th>
              <th>Вызваны</th>
              <th>Обслужены</th>
              <th>Отменены</th>
            </tr>
          </thead>
          <tbody>
            {stats.by_service.map((s) => (
              <tr key={s.service_id}>
                <td>{s.service_name}</td>
                <td>{s.total}</td>
                <td>{s.waiting}</td>
                <td>{s.called}</td>
                <td>{s.served}</td>
                <td>{s.cancelled}</td>
              </tr>
            ))}
            {stats.by_service.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
