import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { extractError } from "../api";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/services");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Регистрация</h1>
        <p className="muted">Создайте аккаунт клиента</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Имя
          <input value={form.full_name} onChange={update("full_name")} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={update("email")} />
        </label>
        <label>
          Пароль (мин. 6 символов)
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={update("password")}
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Создание…" : "Создать аккаунт"}
        </button>
        <p className="muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
