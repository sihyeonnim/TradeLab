import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  return `${numberValue >= 0 ? "+" : ""}${numberValue.toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [data, setData] = useState({
    user: null,
    assets: [],
    portfolio: null,
    summary: null,
    holdings: [],
    orders: [],
    courses: [],
    competition: null,
    leaderboard: [],
  });

  const [orderForm, setOrderForm] = useState({
    assetId: "",
    side: "BUY",
    quantity: "1",
  });

  const [orderStatus, setOrderStatus] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const [status, setStatus] = useState({
    loading: true,
    error: "",
  });

  async function loadDashboard() {
    const [
      meResponse,
      assetsResponse,
      portfolioResponse,
      ordersResponse,
      coursesResponse,
      competitionResponse,
    ] = await Promise.all([
      api.get("/auth/me"),
      api.get("/assets"),
      api.get("/portfolio/me"),
      api.get("/orders/me"),
      api.get("/courses"),
      api.get("/competitions/current"),
    ]);

    const assets = assetsResponse.data.assets || [];

    setData({
      user: meResponse.data.user,
      assets,
      portfolio: portfolioResponse.data.portfolio,
      summary: portfolioResponse.data.summary,
      holdings: portfolioResponse.data.holdings || [],
      orders: ordersResponse.data.orders || [],
      courses: coursesResponse.data.courses || [],
      competition: competitionResponse.data.competition,
      leaderboard: competitionResponse.data.leaderboard || [],
    });

    setOrderForm((prev) => ({
      ...prev,
      assetId: prev.assetId || assets[0]?.id || "",
    }));

    setStatus({
      loading: false,
      error: "",
    });
  }

  useEffect(() => {
    async function initDashboard() {
      try {
        await loadDashboard();
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error:
            error.response?.data?.message ||
            "Failed to load dashboard data.",
        });
      }
    }

    initDashboard();
  }, [navigate]);

  const selectedAsset = useMemo(() => {
    return data.assets.find((asset) => asset.id === orderForm.assetId) || null;
  }, [data.assets, orderForm.assetId]);

  const estimatedAmount = useMemo(() => {
    return (
      Number(orderForm.quantity || 0) * Number(selectedAsset?.lastPrice || 0)
    );
  }, [orderForm.quantity, selectedAsset]);

  function updateOrderField(event) {
    setOrderForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmitOrder(event) {
    event.preventDefault();

    setOrderStatus({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const response = await api.post("/orders/market", {
        assetId: orderForm.assetId,
        side: orderForm.side,
        quantity: Number(orderForm.quantity),
      });

      setOrderStatus({
        loading: false,
        message: response.data.message,
        error: "",
      });

      await loadDashboard();
    } catch (error) {
      setOrderStatus({
        loading: false,
        message: "",
        error: error.response?.data?.message || "Failed to submit order.",
      });
    }
  }

  async function handleLogout() {
    await api.post("/auth/logout");
    navigate("/login");
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (status.error) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-card">
          <p className="error">{status.error}</p>
          <button className="secondary-button" onClick={() => navigate("/login")}>
            Back to login
          </button>
        </div>
      </main>
    );
  }

  const {
    user,
    summary,
    holdings,
    orders,
    courses,
    competition,
    leaderboard,
    assets,
  } = data;

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.displayName || "Trader"}.
          </p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Current user</p>
          <div className="user-row">
            <div>
              <h2>{user?.displayName}</h2>
              <p>{user?.email}</p>
            </div>
            <div className="role-pill">{user?.role}</div>
          </div>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Cash balance</p>
          <h3>{formatCurrency(summary?.cashBalance)}</h3>
          <p>Available virtual cash for market orders.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Portfolio value</p>
          <h3>{formatCurrency(summary?.totalValue)}</h3>
          <p>Cash plus current market value of holdings.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">ROI</p>
          <h3 className={Number(summary?.roi || 0) >= 0 ? "positive" : "negative"}>
            {formatPercent(summary?.roi)}
          </h3>
          <p>Ranking metric for competitions.</p>
        </article>

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Market order</p>
              <h3>Place an instant trade</h3>
            </div>
          </div>

          <form className="trade-form" onSubmit={handleSubmitOrder}>
            <label>
              Asset
              <select
                name="assetId"
                value={orderForm.assetId}
                onChange={updateOrderField}
                required
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.symbol} - {asset.name} ({formatCurrency(asset.lastPrice)})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Side
              <select
                name="side"
                value={orderForm.side}
                onChange={updateOrderField}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>

            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min="0.000001"
                step="0.000001"
                value={orderForm.quantity}
                onChange={updateOrderField}
                required
              />
            </label>

            <div className="estimate-box">
              <span>
                Estimated {orderForm.side === "BUY" ? "cost" : "proceeds"}
              </span>
              <strong>{formatCurrency(estimatedAmount)}</strong>
            </div>

            <button disabled={orderStatus.loading || assets.length === 0}>
              {orderStatus.loading ? "Submitting..." : "Submit market order"}
            </button>
          </form>

          {orderStatus.message && <p className="success">{orderStatus.message}</p>}
          {orderStatus.error && <p className="error">{orderStatus.error}</p>}
        </article>

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Holdings</p>
              <h3>Current positions</h3>
            </div>
          </div>

          {holdings.length === 0 ? (
            <p>No holdings yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Quantity</th>
                    <th>Avg. Price</th>
                    <th>Last Price</th>
                    <th>Market Value</th>
                    <th>Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <tr key={holding.id}>
                      <td>
                        <strong>{holding.asset?.symbol || "-"}</strong>
                        <span>{holding.asset?.name || "Unknown asset"}</span>
                      </td>
                      <td>{holding.quantity}</td>
                      <td>{formatCurrency(holding.averagePrice)}</td>
                      <td>{formatCurrency(holding.lastPrice)}</td>
                      <td>{formatCurrency(holding.marketValue)}</td>
                      <td
                        className={
                          Number(holding.unrealizedPnl || 0) >= 0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {formatCurrency(holding.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Recent orders</p>
          <h3>Latest trading activity</h3>

          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.asset?.symbol || "-"}</strong>
                        <span>{order.asset?.name || "Unknown asset"}</span>
                      </td>
                      <td>{order.side}</td>
                      <td>{order.orderType}</td>
                      <td>{order.quantity}</td>
                      <td>{formatCurrency(order.price)}</td>
                      <td>{order.status}</td>
                      <td>{formatDate(order.executedAt || order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Courses</p>
          <h3>Available lessons</h3>

          <div className="stack-list">
            {courses.length === 0 ? (
              <p>No approved courses yet.</p>
            ) : (
              courses.slice(0, 4).map((course) => (
                <div className="mini-item" key={course.id}>
                  <strong>{course.title}</strong>
                  <span>
                    {course.instructor?.name
                      ? `By ${course.instructor.name}`
                      : "Instructor pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Competition</p>
          <h3>{competition?.title || competition?.name || "No competition"}</h3>

          {competition ? (
            <>
              <p>{competition.description || "Seasonal ROI competition."}</p>
              <div className="date-range">
                {formatDate(competition.startDate)} -{" "}
                {formatDate(competition.endDate)}
              </div>
            </>
          ) : (
            <p>No active competition found.</p>
          )}
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Leaderboard</p>
          <h3>Top ROI</h3>

          <div className="stack-list">
            {leaderboard.length === 0 ? (
              <p>No participants yet.</p>
            ) : (
              leaderboard.slice(0, 5).map((entry) => (
                <div className="leader-row" key={entry.id}>
                  <span>#{entry.rank}</span>
                  <strong>{entry.user?.name || "Trader"}</strong>
                  <em>{formatPercent(entry.roi)}</em>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}