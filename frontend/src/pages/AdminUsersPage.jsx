import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  const sign = numberValue > 0 ? "+" : "";
  return `${sign}${numberValue.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getUserId(item) {
  return String(item?.user?.id || item?.id || item?._id || "");
}

function getUserObject(item) {
  return item?.user || item || null;
}

function getUserDisplayName(item) {
  const user = getUserObject(item);
  return user?.displayName || user?.name || user?.email || "Unknown User";
}

function getTotalMarketValue(holdings) {
  if (!Array.isArray(holdings)) {
    return 0;
  }

  return holdings.reduce((sum, holding) => sum + Number(holding.marketValue || 0), 0);
}

export default function AdminUsersPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  const selectedUserSummary = useMemo(() => {
    return users.find((item) => getUserId(item) === selectedUserId) || null;
  }, [users, selectedUserId]);

  async function loadUsers(nextSelectedId) {
    const [meResponse, usersResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/admin/users"),
    ]);

    const me = meResponse.data.user;

    if (me.role !== "ADMIN") {
      navigate("/dashboard");
      return;
    }

    const userList = usersResponse.data.users || [];
    const resolvedSelectedId =
      nextSelectedId || selectedUserId || getUserId(userList[0]) || "";

    setCurrentUser(me);
    setUsers(userList);
    setSelectedUserId(resolvedSelectedId);

    if (resolvedSelectedId) {
      const detailResponse = await api.get(`/admin/users/${resolvedSelectedId}`);
      setSelectedDetail(detailResponse.data);
    } else {
      setSelectedDetail(null);
    }
  }

  async function loadSelectedDetail(userId) {
    if (!userId) {
      setSelectedDetail(null);
      return;
    }

    try {
      const response = await api.get(`/admin/users/${userId}`);
      setSelectedDetail(response.data);
      setStatus((prev) => ({ ...prev, error: "" }));
    } catch (error) {
      setSelectedDetail(null);
      setStatus((prev) => ({
        ...prev,
        error: error.response?.data?.message || "Failed to load selected user detail.",
      }));
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadUsers();

        setStatus({
          loading: false,
          error: "",
          message: "",
        });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load admin users.",
          message: "",
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    loadSelectedDetail(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading admin users...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab Admin</span>
          <h1>Users</h1>
          <p className="dashboard-subtitle">
            Review registered users, portfolios, enrollments, and competitions.
          </p>
        </div>

        <div className="user-pill">
          {currentUser?.displayName || currentUser?.name || "Admin"}
        </div>
      </nav>

      {status.error && <p className="error">{status.error}</p>}
      {status.message && <p className="success">{status.message}</p>}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total Users</span>
          <strong>{users.length}</strong>
        </article>

        <article className="stat-card">
          <span>Instructors</span>
          <strong>
            {users.filter((item) => getUserObject(item)?.role === "INSTRUCTOR").length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Verified Users</span>
          <strong>
            {users.filter((item) => getUserObject(item)?.isEmailVerified).length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Total Platform Equity</span>
          <strong>
            {formatCurrency(
              users.reduce(
                (sum, item) => sum + Number(item.portfolio?.totalEquity || 0),
                0
              )
            )}
          </strong>
        </article>
      </section>

      <section className="dashboard-grid admin-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Registered users</p>
          <h3>User overview</h3>

          <label className="admin-select-row">
            Select User
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              {users.length === 0 ? (
                <option value="">No users</option>
              ) : (
                users.map((item) => {
                  const user = getUserObject(item);
                  const userId = getUserId(item);

                  return (
                    <option key={userId} value={userId}>
                      {getUserDisplayName(item)} · {user?.email || "no email"} · {user?.role || "role"}
                    </option>
                  );
                })
              )}
            </select>
          </label>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Cash</th>
                  <th>Assets</th>
                  <th>Total Equity</th>
                  <th>ROI</th>
                  <th>Courses</th>
                  <th>Competitions</th>
                  <th>Detail</th>
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="10">No registered users.</td>
                  </tr>
                ) : (
                  users.map((item) => {
                    const user = getUserObject(item);
                    const userId = getUserId(item);
                    const selected = userId === selectedUserId;

                    return (
                      <tr key={userId} className={selected ? "selected-row" : ""}>
                        <td>
                          <strong>{getUserDisplayName(item)}</strong>
                          <span>{user?.email}</span>
                        </td>
                        <td>{user?.role}</td>
                        <td>{user?.isEmailVerified ? "Yes" : "No"}</td>
                        <td>{formatCurrency(item.portfolio?.cashBalance)}</td>
                        <td>{formatCurrency(getTotalMarketValue(item.holdings || []))}</td>
                        <td>{formatCurrency(item.portfolio?.totalEquity)}</td>
                        <td
                          className={
                            Number(item.portfolio?.roi || 0) >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {formatPercent(item.portfolio?.roi)}
                        </td>
                        <td>{item.enrollmentCount || 0}</td>
                        <td>{item.competitionCount || 0}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setSelectedUserId(userId)}
                          >
                            {selected ? "Selected" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Selected user</p>
          <h3>
            {selectedDetail?.user?.displayName ||
              selectedDetail?.user?.name ||
              getUserDisplayName(selectedUserSummary) ||
              "User detail"}
          </h3>

          {!selectedDetail ? (
            <p className="muted-text">
              Select a user from the dropdown or the table to inspect details.
            </p>
          ) : (
            <div className="admin-detail-grid">
              <section className="admin-detail-panel">
                <h3>Portfolio</h3>
                <div className="compact-list">
                  <div className="compact-row">
                    <div>
                      <strong>Cash</strong>
                      <span>Available balance</span>
                    </div>
                    <em>{formatCurrency(selectedDetail.portfolio?.cashBalance)}</em>
                  </div>
                  <div className="compact-row">
                    <div>
                      <strong>Asset value</strong>
                      <span>Current holdings value</span>
                    </div>
                    <em>{formatCurrency(selectedDetail.portfolio?.totalAssetValue)}</em>
                  </div>
                  <div className="compact-row">
                    <div>
                      <strong>Total equity</strong>
                      <span>Cash plus assets</span>
                    </div>
                    <em>{formatCurrency(selectedDetail.portfolio?.totalEquity)}</em>
                  </div>
                  <div className="compact-row">
                    <div>
                      <strong>ROI</strong>
                      <span>Based on starting cash</span>
                    </div>
                    <em
                      className={
                        Number(selectedDetail.portfolio?.roi || 0) >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {formatPercent(selectedDetail.portfolio?.roi)}
                    </em>
                  </div>
                </div>
              </section>

              <section className="admin-detail-panel">
                <h3>Holdings</h3>
                {!selectedDetail.holdings || selectedDetail.holdings.length === 0 ? (
                  <p className="muted-text">No holdings.</p>
                ) : (
                  <div className="compact-list">
                    {selectedDetail.holdings.map((holding) => (
                      <div className="compact-row" key={holding.id}>
                        <div>
                          <strong>{holding.asset?.symbol || "Asset"}</strong>
                          <span>
                            {holding.quantity} units · {formatCurrency(holding.currentPrice)} each
                          </span>
                        </div>
                        <em>{formatCurrency(holding.marketValue)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-detail-panel">
                <h3>Enrolled courses</h3>
                {!selectedDetail.enrollments || selectedDetail.enrollments.length === 0 ? (
                  <p className="muted-text">No enrollments.</p>
                ) : (
                  <div className="compact-list">
                    {selectedDetail.enrollments.map((enrollment) => (
                      <div className="compact-row" key={enrollment.id}>
                        <div>
                          <strong>{enrollment.course?.title || "Course"}</strong>
                          <span>
                            {enrollment.status} · {enrollment.progressPercent}%
                          </span>
                        </div>
                        <em>{formatDate(enrollment.enrolledAt)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-detail-panel">
                <h3>Competitions</h3>
                {!selectedDetail.competitions || selectedDetail.competitions.length === 0 ? (
                  <p className="muted-text">No competitions.</p>
                ) : (
                  <div className="compact-list">
                    {selectedDetail.competitions.map((item) => (
                      <div
                        className="compact-row"
                        key={item.participation?.id || item.competition?.id}
                      >
                        <div>
                          <strong>{item.competition?.title || "Competition"}</strong>
                          <span>
                            Rank {item.participation?.rank || "-"} · {formatPercent(item.participation?.roi)}
                          </span>
                        </div>
                        <em>{formatCurrency(item.participation?.profit)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </article>
      </section>

      <BottomNav user={currentUser} />
    </main>
  );
}
