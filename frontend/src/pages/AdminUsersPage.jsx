import { useEffect, useState } from "react";
import api, { extractError } from "../api";
import { useAuth } from "../AuthContext";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      setError(extractError(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(user, patch) {
    setError("");
    try {
      await api.put(`/users/${user.id}`, patch);
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  async function remove(user) {
    if (!window.confirm(`Удалить пользователя ${user.email}?`)) return;
    setError("");
    try {
      await api.delete(`/users/${user.id}`);
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Пользователи</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.full_name || "—"}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge role-${u.role}`}>{u.role}</span>
                </td>
                <td>{u.is_active ? "да" : "нет"}</td>
                <td className="actions">
                  <select
                    value={u.role}
                    disabled={u.id === me.id}
                    onChange={(e) => update(u, { role: e.target.value })}
                  >
                    <option value="client">client</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    className="btn btn-small"
                    disabled={u.id === me.id}
                    title={u.id === me.id ? "Нельзя заблокировать себя" : undefined}
                    onClick={() => update(u, { is_active: !u.is_active })}
                  >
                    {u.is_active ? "Заблокировать" : "Разблокировать"}
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    disabled={u.id === me.id}
                    onClick={() => remove(u)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  Нет пользователей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
