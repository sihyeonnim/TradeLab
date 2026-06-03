import { Link, useLocation, useNavigate } from "react-router-dom";

import { api } from "../api";

const userItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/market", label: "Market" },
  { to: "/courses", label: "Courses" },
  { to: "/competition", label: "Competition" },
];

const instructorItems = [
  { to: "/instructor/courses", label: "Courses" },
  { to: "/instructor/competitions", label: "Competitions" },
];

const adminItems = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/courses", label: "Courses" },
  { to: "/admin/competitions", label: "Competitions" },
];

function getItemsForRole(role) {
  if (role === "ADMIN") {
    return adminItems;
  }

  if (role === "INSTRUCTOR") {
    return instructorItems;
  }

  return userItems;
}

function isActive(pathname, target) {
  if (target === "/courses") {
    return pathname === "/courses" || pathname.startsWith("/courses/");
  }

  if (target === "/competition") {
    return pathname === "/competition";
  }

  if (target === "/instructor/courses") {
    return (
      pathname === "/instructor/courses" ||
      pathname.startsWith("/instructor/courses/")
    );
  }

  if (target === "/instructor/competitions") {
    return pathname === "/instructor/competitions";
  }

  if (target === "/admin/users") {
    return pathname === "/admin" || pathname === "/admin/users";
  }

  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function BottomNav({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const items = getItemsForRole(user?.role);
  const roleClass =
    user?.role === "ADMIN"
      ? "admin-bottom-nav"
      : user?.role === "INSTRUCTOR"
        ? "instructor-bottom-nav"
        : "";

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Keep logout resilient even if the network request fails.
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <nav className={`bottom-nav ${roleClass}`}>
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`bottom-nav-item ${
              isActive(location.pathname, item.to) ? "active" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}

        <button
          type="button"
          className="bottom-nav-item bottom-nav-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
