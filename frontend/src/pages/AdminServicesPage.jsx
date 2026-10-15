import { useEffect, useState } from "react";
import api, { extractError } from "../api";

const EMPTY = { name: "", description: "", duration_minutes: 15, is_active: true };

export default function AdminServicesPage() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api.get("/services", { params: { include_inactive: true } });
      setServices(res.data);
    } catch (err) {
      setError(extractError(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
    });
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      ...form,
      duration_minutes: Number(form.duration_minutes),
    };
    try {
      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
      } else {
        await api.post("/services", payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(service) {
    if (!window.confirm(`Удалить услугу «${service.name}»?`)) return;
    setError("");
    try {
      await api.delete(`/services/${service.id}`);
      if (editingId === service.id) resetForm();
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Управление услугами</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        <form className="card" onSubmit={handleSubmit}>
          <h3>{editingId ? `Редактирование #${editingId}` : "Новая услуга"}</h3>
          <label>
            Название
            <input
              required
              maxLength={255}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Описание
            <textarea
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Длительность, мин
            <input
              type="number"
              min={1}
              max={1440}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Активна
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {editingId ? "Сохранить" : "Создать"}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Отмена
              </button>
            )}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Мин</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.duration_minutes}</td>
                  <td>
                    <span className={`badge ${s.is_active ? "ok" : "off"}`}>
                      {s.is_active ? "активна" : "отключена"}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn btn-small" onClick={() => startEdit(s)}>
                      Изменить
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => remove(s)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted center">
                    Нет услуг
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
