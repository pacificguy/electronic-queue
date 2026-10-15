import { useEffect, useState } from "react";
import api, { extractError } from "../api";
import { useAuth } from "../AuthContext";

export default function ServicesPage() {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const res = await api.get("/services", {
        params: isAdmin ? { include_inactive: true } : {},
      });
      setServices(res.data);
    } catch (err) {
      setError(extractError(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTicket(service) {
    setError("");
    setNotice("");
    setBusyId(service.id);
    try {
      const res = await api.post("/tickets", { service_id: service.id });
      setNotice(`Талон №${res.data.number} создан на услугу «${service.name}».`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Услуги</h1>
        {!isAdmin && <p className="muted">Выберите услугу, чтобы встать в очередь.</p>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="grid">
        {services.map((s) => (
          <div className="card service-card" key={s.id}>
            <div className="service-head">
              <h3>{s.name}</h3>
              <span className={`badge ${s.is_active ? "ok" : "off"}`}>
                {s.is_active ? "активна" : "отключена"}
              </span>
            </div>
            <p className="muted">{s.description || "Без описания"}</p>
            <p className="muted">≈ {s.duration_minutes} мин</p>
            {!isAdmin && (
              <button
                className="btn btn-primary"
                disabled={busyId === s.id || !s.is_active}
                onClick={() => createTicket(s)}
              >
                {busyId === s.id ? "Запись…" : "Записаться"}
              </button>
            )}
          </div>
        ))}
        {services.length === 0 && <p className="muted">Услуг пока нет.</p>}
      </div>
    </div>
  );
}
