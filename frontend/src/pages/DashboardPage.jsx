import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import AllocationChart from "../components/AllocationChart.jsx";
import Sparkline from "../components/Sparkline.jsx";

// How often the dashboard pulls fresh market prices from the backend.
const PRICE_REFRESH_INTERVAL_MS = 15000;

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

  const [sliderPercent, setSliderPercent] = useState(0);

  const [orderStatus, setOrderStatus] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const [status, setStatus] = useState({
    loading: true,
    error: "",
  });

  const [priceHistory, setPriceHistory] = useState({});
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(null);

  async function loadDashboard() {
    const [
      meResponse,
      assetsResponse,
      portfolioResponse,
      ordersResponse,
      coursesResponse,
      competitionResponse,
      historyResponse,
    ] = await Promise.all([
      api.get("/auth/me"),
      api.get("/assets"),
      api.get("/portfolio/me"),
      api.get("/orders/me"),
      api.get("/courses"),
      api.get("/competitions/current"),
      api.get("/assets/prices/history"),
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

    setPriceHistory(historyResponse.data.history || {});

    setOrderForm((prev) => ({
      ...prev,
      assetId: prev.assetId || assets[0]?.id || "",
    }));

    setStatus({
      loading: false,
      error: "",
    });
  }

  // Pull fresh prices from the market data provider, then re-fetch the lighter
  // price-sensitive slices (assets, portfolio, price history). Used by the
  // background auto-refresh so the whole dashboard isn't reloaded each tick.
  async function refreshMarketPrices() {
    try {
      await api.post("/assets/refresh");
    } catch {
      // Ignore refresh failures (rate limit / provider hiccup); we still pull
      // whatever the backend currently has below.
    }

    const [assetsResponse, portfolioResponse, historyResponse] =
      await Promise.all([
        api.get("/assets"),
        api.get("/portfolio/me"),
        api.get("/assets/prices/history"),
      ]);

    setData((prev) => ({
      ...prev,
      assets: assetsResponse.data.assets || [],
      portfolio: portfolioResponse.data.portfolio,
      summary: portfolioResponse.data.summary,
      holdings: portfolioResponse.data.holdings || [],
    }));
    setPriceHistory(historyResponse.data.history || {});
    setPricesUpdatedAt(new Date());
  }

  useEffect(() => {
    async function initDashboard() {
      try {
        await loadDashboard();
        setPricesUpdatedAt(new Date());
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

  // Auto-refresh market prices on an interval (replaces the manual button).
  useEffect(() => {
    const timer = setInterval(() => {
      refreshMarketPrices().catch(() => {
        /* swallow; next tick will retry */
      });
    }, PRICE_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const selectedAsset = useMemo(() => {
    return data.assets.find((asset) => asset.id === orderForm.assetId) || null;
  }, [data.assets, orderForm.assetId]);

  const estimatedAmount = useMemo(() => {
    return (
      Number(orderForm.quantity || 0) * Number(selectedAsset?.lastPrice || 0)
    );
  }, [orderForm.quantity, selectedAsset]);

  // Holdings-only allocation (each position's share of total holdings value) for
  // the dashboard's at-a-glance donut chart.
  const holdingsAllocation = useMemo(() => {
    const totalHoldingsValue = data.holdings.reduce(
      (sum, holding) => sum + Number(holding.marketValue || 0),
      0
    );

    if (totalHoldingsValue <= 0) {
      return [];
    }

    return data.holdings.map((holding) => ({
      label: holding.asset?.symbol || "—",
      value: Number(holding.marketValue || 0),
      percent:
        Math.round(
          (Number(holding.marketValue || 0) / totalHoldingsValue) * 10000
        ) / 100,
    }));
  }, [data.holdings]);

  // Quantity of the currently selected asset the user holds (for SELL sizing).
  const heldQuantityForSelected = useMemo(() => {
    const holding = data.holdings.find(
      (item) => item.asset?.id === orderForm.assetId
    );
    return Number(holding?.quantity || 0);
  }, [data.holdings, orderForm.assetId]);

  const cashBalance = Number(data.summary?.cashBalance || 0);

  function floor6(value) {
    return Math.floor(Number(value || 0) * 1e6) / 1e6;
  }

  // BUY: percent of cash to spend. SELL: percent of held quantity to sell.
  function applyOrderPercent(percent) {
    setSliderPercent(percent);

    const lastPrice = Number(selectedAsset?.lastPrice || 0);
    let quantity = 0;

    if (orderForm.side === "BUY") {
      quantity = lastPrice > 0 ? floor6((cashBalance * percent) / 100 / lastPrice) : 0;
    } else {
      quantity =
        percent >= 100
          ? heldQuantityForSelected
          : floor6((heldQuantityForSelected * percent) / 100);
    }

    setOrderForm((prev) => ({ ...prev, quantity: String(quantity) }));
  }

  function updateOrderField(event) {
    const { name, value } = event.target;

    // Changing asset or side invalidates the slider-derived quantity.
    if (name === "assetId" || name === "side") {
      setSliderPercent(0);
    }
    if (name === "quantity") {
      setSliderPercent(0);
    }

    setOrderForm((prev) => ({
      ...prev,
      [name]: value,
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

      setSliderPercent(0);
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

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Holdings</p>
              <h3>Current positions</h3>
            </div>
          </div>

          <div className="summary-strip">
            <div className="summary-item">
              <p className="eyebrow">Cash balance</p>
              <h3>{formatCurrency(summary?.cashBalance)}</h3>
            </div>
            <div className="summary-item">
              <p className="eyebrow">Portfolio value</p>
              <h3>{formatCurrency(summary?.totalValue)}</h3>
            </div>
            <div className="summary-item">
              <p className="eyebrow">ROI</p>
              <h3 className={Number(summary?.roi || 0) >= 0 ? "positive" : "negative"}>
                {formatPercent(summary?.roi)}
              </h3>
            </div>
          </div>

          {holdings.length === 0 ? (
            <p>No holdings yet.</p>
          ) : (
            <>
              <p className="dashboard-subtitle">
                Click a position to view details and trade.
              </p>
              <div className="holdings-layout">
                <div className="holdings-chart">
                  <AllocationChart
                    allocation={holdingsAllocation}
                    size={140}
                    compact
                  />
                </div>

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
                        <tr
                          key={holding.id}
                          className="clickable-row"
                          onClick={() =>
                            navigate(`/portfolio/holdings/${holding.asset?.id}`)
                          }
                        >
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
              </div>
            </>
          )}
        </article>

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Market order</p>
              <h3>Place an instant trade</h3>
            </div>
            <span className="live-badge" title="Prices auto-refresh">
              ● Live ·{" "}
              {pricesUpdatedAt
                ? `updated ${pricesUpdatedAt.toLocaleTimeString()}`
                : "updating…"}
            </span>
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
              <div className="side-toggle" role="group" aria-label="Order side">
                {["BUY", "SELL"].map((sideOption) => (
                  <button
                    type="button"
                    key={sideOption}
                    className={`side-toggle-btn ${sideOption.toLowerCase()}${
                      orderForm.side === sideOption ? " active" : ""
                    }`}
                    aria-pressed={orderForm.side === sideOption}
                    onClick={() => {
                      setSliderPercent(0);
                      setOrderForm((prev) => ({ ...prev, side: sideOption }));
                    }}
                  >
                    {sideOption}
                  </button>
                ))}
              </div>
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

            <label className="slider-label">
              <span className="slider-caption">
                {orderForm.side === "BUY"
                  ? `Use ${sliderPercent}% of cash`
                  : `Sell ${sliderPercent}% of holdings`}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={sliderPercent}
                onChange={(event) => applyOrderPercent(Number(event.target.value))}
                disabled={
                  orderForm.side === "BUY"
                    ? Number(selectedAsset?.lastPrice || 0) <= 0
                    : heldQuantityForSelected <= 0
                }
              />
              <div className="slider-ticks">
                {[0, 25, 50, 75, 100].map((mark) => (
                  <button
                    type="button"
                    key={mark}
                    className="slider-tick"
                    onClick={() => applyOrderPercent(mark)}
                    disabled={
                      orderForm.side === "BUY"
                        ? Number(selectedAsset?.lastPrice || 0) <= 0
                        : heldQuantityForSelected <= 0
                    }
                  >
                    {mark === 100 ? "Max" : `${mark}%`}
                  </button>
                ))}
              </div>
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
          <p className="eyebrow">Market prices</p>
          <h3>Recent price movement</h3>
          <p className="dashboard-subtitle">
            Auto-updates every {Math.round(PRICE_REFRESH_INTERVAL_MS / 1000)}s.
          </p>

          <div className="price-grid">
            {assets.map((asset) => {
              const points = priceHistory[asset.id] || [];
              const first = points.length ? Number(points[0].price) : null;
              const last = points.length
                ? Number(points[points.length - 1].price)
                : Number(asset.lastPrice || 0);
              const changePercent =
                first && first > 0 ? ((last - first) / first) * 100 : 0;

              return (
                <button
                  type="button"
                  key={asset.id}
                  className="price-tile clickable-row"
                  onClick={() => navigate(`/portfolio/holdings/${asset.id}`)}
                >
                  <div className="price-tile-head">
                    <div>
                      <strong>{asset.symbol}</strong>
                      <span>{asset.name}</span>
                    </div>
                    <div className="price-tile-figures">
                      <strong>{formatCurrency(last)}</strong>
                      <em className={changePercent >= 0 ? "positive" : "negative"}>
                        {formatPercent(changePercent)}
                      </em>
                    </div>
                  </div>
                  <Sparkline points={points} />
                </button>
              );
            })}
          </div>
        </article>

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Recent orders</p>
              <h3>Latest trading activity</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/orders")}
            >
              More
            </button>
          </div>

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
                  {orders.slice(0, 3).map((order) => (
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
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Courses</p>
              <h3>Available lessons</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/courses")}
            >
              Browse all
            </button>
          </div>

          <div className="stack-list">
            {courses.length === 0 ? (
              <p>No approved courses yet.</p>
            ) : (
              courses.slice(0, 4).map((course) => (
                <div
                  className="mini-item clickable-row"
                  key={course.id}
                  onClick={() => navigate(`/courses/${course.id}`)}
                >
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