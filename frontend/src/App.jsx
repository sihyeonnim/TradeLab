import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { api } from "./api";

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";
import MarketPage from "./pages/MarketPage.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
import CourseDetailPage from "./pages/CourseDetailPage.jsx";
import CompetitionPage from "./pages/CompetitionPage.jsx";

import InstructorCoursesPage from "./pages/InstructorCoursesPage.jsx";
import InstructorCourseEditPage from "./pages/InstructorCourseEditPage.jsx";
import InstructorCompetitionsPage from "./pages/InstructorCompetitionsPage.jsx";

import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import AdminCoursesPage from "./pages/AdminCoursesPage.jsx";
import AdminCompetitionsPage from "./pages/AdminCompetitionsPage.jsx";

function getHomePathForRole(role) {
  if (role === "ADMIN") {
    return "/admin/users";
  }

  if (role === "INSTRUCTOR") {
    return "/instructor/courses";
  }

  return "/dashboard";
}

function LoadingPage() {
  return (
    <main className="dashboard-shell">
      <p>Loading...</p>
    </main>
  );
}

function RoleHomeRedirect() {
  const [state, setState] = useState({
    loading: true,
    redirectTo: "",
  });

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const response = await api.get("/auth/me");
        const role = response.data.user?.role;

        if (mounted) {
          setState({
            loading: false,
            redirectTo: getHomePathForRole(role),
          });
        }
      } catch {
        if (mounted) {
          setState({
            loading: false,
            redirectTo: "/login",
          });
        }
      }
    }

    checkUser();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return <LoadingPage />;
  }

  return <Navigate to={state.redirectTo} replace />;
}

function RoleGate({ allow, fallbackByRole, children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    redirectTo: "",
  });

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const response = await api.get("/auth/me");
        const user = response.data.user;
        const role = user?.role;

        if (!allow.includes(role)) {
          const fallback = fallbackByRole?.[role] || getHomePathForRole(role);

          if (mounted) {
            setState({
              loading: false,
              user,
              redirectTo: fallback,
            });
          }

          return;
        }

        if (mounted) {
          setState({
            loading: false,
            user,
            redirectTo: "",
          });
        }
      } catch {
        if (mounted) {
          setState({
            loading: false,
            user: null,
            redirectTo: "/login",
          });
        }
      }
    }

    checkUser();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.loading) {
    return <LoadingPage />;
  }

  if (state.redirectTo) {
    return <Navigate to={state.redirectTo} replace />;
  }

  return children;
}

function UserOnlyRoute({ children }) {
  return (
    <RoleGate
      allow={["USER"]}
      fallbackByRole={{
        ADMIN: "/admin/users",
        INSTRUCTOR: "/instructor/courses",
      }}
    >
      {children}
    </RoleGate>
  );
}

function InstructorOnlyRoute({ children }) {
  return (
    <RoleGate
      allow={["INSTRUCTOR"]}
      fallbackByRole={{
        ADMIN: "/admin/users",
        USER: "/dashboard",
      }}
    >
      {children}
    </RoleGate>
  );
}

function AdminOnlyRoute({ children }) {
  return (
    <RoleGate
      allow={["ADMIN"]}
      fallbackByRole={{
        INSTRUCTOR: "/instructor/courses",
        USER: "/dashboard",
      }}
    >
      {children}
    </RoleGate>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/dashboard"
        element={
          <UserOnlyRoute>
            <DashboardPage />
          </UserOnlyRoute>
        }
      />
      <Route
        path="/market"
        element={
          <UserOnlyRoute>
            <MarketPage />
          </UserOnlyRoute>
        }
      />
      <Route
        path="/courses"
        element={
          <UserOnlyRoute>
            <CoursesPage />
          </UserOnlyRoute>
        }
      />
      <Route
        path="/courses/:courseId"
        element={
          <UserOnlyRoute>
            <CourseDetailPage />
          </UserOnlyRoute>
        }
      />
      <Route
        path="/competition"
        element={
          <UserOnlyRoute>
            <CompetitionPage />
          </UserOnlyRoute>
        }
      />

      <Route
        path="/instructor/courses"
        element={
          <InstructorOnlyRoute>
            <InstructorCoursesPage />
          </InstructorOnlyRoute>
        }
      />
      <Route
        path="/instructor/courses/:courseId/edit"
        element={
          <InstructorOnlyRoute>
            <InstructorCourseEditPage />
          </InstructorOnlyRoute>
        }
      />
      <Route
        path="/instructor/competitions"
        element={
          <InstructorOnlyRoute>
            <InstructorCompetitionsPage />
          </InstructorOnlyRoute>
        }
      />

      <Route
        path="/admin"
        element={<Navigate to="/admin/users" replace />}
      />
      <Route
        path="/admin/users"
        element={
          <AdminOnlyRoute>
            <AdminUsersPage />
          </AdminOnlyRoute>
        }
      />
      <Route
        path="/admin/courses"
        element={
          <AdminOnlyRoute>
            <AdminCoursesPage />
          </AdminOnlyRoute>
        }
      />
      <Route
        path="/admin/competitions"
        element={
          <AdminOnlyRoute>
            <AdminCompetitionsPage />
          </AdminOnlyRoute>
        }
      />

      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
