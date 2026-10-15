import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkClass = (path) =>
    location.pathname.startsWith(path) ? "nav-link active" : "nav-link";

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Электронная&nbsp;очередь
        </Link>
        <nav className="nav">
          <Link className={linkClass("/services")} to="/services">
            Услуги
          </Link>
          <Link className={linkClass("/tickets")} to="/tickets">
            {isAdmin ? "Очередь" : "Мои талоны"}
          </Link>
          {isAdmin && (
            <>
              <Link className={linkClass("/admin/services")} to="/admin/services">
                Управление услугами
              </Link>
              <Link className={linkClass("/admin/users")} to="/admin/users">
                Пользователи
              </Link>
              <Link className={linkClass("/admin/stats")} to="/admin/stats">
                Отчёты
              </Link>
            </>
          )}
        </nav>
        <div className="user-box">
          {user && (
            <span className="user-info">
              {user.full_name || user.email}
              <span className={`badge role-${user.role}`}>{user.role}</span>
            </span>
          )}
          <button className="btn btn-ghost" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
