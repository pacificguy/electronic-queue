import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ServicesPage from "./pages/ServicesPage";
import TicketsPage from "./pages/TicketsPage";
import AdminServicesPage from "./pages/AdminServicesPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminStatsPage from "./pages/AdminStatsPage";

function Shell({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/services"
        element={
          <Shell>
            <ServicesPage />
          </Shell>
        }
      />
      <Route
        path="/tickets"
        element={
          <Shell>
            <TicketsPage />
          </Shell>
        }
      />
      <Route
        path="/admin/services"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminServicesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminUsersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/stats"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminStatsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/services" replace />} />
      <Route path="*" element={<Navigate to="/services" replace />} />
    </Routes>
  );
}
