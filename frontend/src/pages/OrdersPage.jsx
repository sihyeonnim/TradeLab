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

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function orderDate(order) {
  return order.executedAt || order.createdAt;
}

const EMPTY_FILTERS = {
  assetId: "ALL",
  status: "ALL",
  from: "",
  to: "",
  sort: "DATE_DESC",
};

export default function OrdersPage() {
  const navigate = useNavigate();

  const [trades, setTrades] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get("/portfolio/me/trades");
        setTrades(response.data.trades || []);
        setStatus({ loading: false, error: "" });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error:
            error.response?.data?.message || "Failed to load order history.",
        });
      }
    }

    load();
  }, [navigate]);

  // Distinct assets and statuses present in the history, for the dropdowns.
  const assetOptions = useMemo(() => {
    const map = new Map();
    trades.forEach((trade) => {
      if (trade.asset?.id && !map.has(trade.asset.id)) {
        map.set(trade.asset.id, trade.asset.symbol || trade.asset.id);
      }
    });
    return Array.from(map.entries()).map(([id, symbol]) => ({ id, symbol }));
  }, [trades]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(trades.map((trade) => trade.status))).filter(
      Boolean
    );
  }, [trades]);

  const filteredTrades = useMemo(() => {
    const fromTime = filters.from ? new Date(filters.from).getTime() : null;
    // Include the whole "to" day by pushing to end-of-day.
    const toTime = filters.to
      ? new Date(filters.to).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;

    const result = trades.filter((trade) => {
      if (filters.assetId !== "ALL" && trade.asset?.id !== filters.assetId) {
        return false;
      }
      if (filters.status !== "ALL" && trade.status !== filters.status) {
        return false;
      }

      const time = new Date(orderDate(trade)).getTime();
      if (fromTime !== null && time < fromTime) {
        return false;
      }
      if (toTime !== null && time > toTime) {
        return false;
      }

      return true;
    });

    result.sort((a, b) => {
      const ta = new Date(orderDate(a)).getTime();
      const tb = new Date(orderDate(b)).getTime();
      return filters.sort === "DATE_ASC" ? ta - tb : tb - ta;
    });

    return result;
  }, [trades, filters]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading orders...</p>
      </main>
    );
  }

  if (status.error) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-card">
          <p className="error">{status.error}</p>
          <button className="secondary-button" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Order history</h1>
          <p className="dashboard-subtitle">
            Filter your full trading activity by asset, status, and date.
          </p>
        </div>

        <button className="secondary-button" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </nav>

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <div className="filters-row">
            <label>
              Asset
              <select name="assetId" value={filters.assetId} onChange={updateFilter}>
                <option value="ALL">All assets</option>
                {assetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.symbol}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select name="status" value={filters.status} onChange={updateFilter}>
                <option value="ALL">All statuses</option>
                {statusOptions.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {statusValue}
                  </option>
                ))}
              </select>
            </label>

            <label>
              From
              <input
                type="date"
                name="from"
                value={filters.from}
                onChange={updateFilter}
              />
            </label>

            <label>
              To
              <input
                type="date"
                name="to"
                value={filters.to}
                onChange={updateFilter}
              />
            </label>

            <label>
              Sort
              <select name="sort" value={filters.sort} onChange={updateFilter}>
                <option value="DATE_DESC">Newest first</option>
                <option value="DATE_ASC">Oldest first</option>
              </select>
            </label>

            <button type="button" className="secondary-button" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <p className="dashboard-subtitle">
            Showing {filteredTrades.length} of {trades.length} orders.
          </p>

          {filteredTrades.length === 0 ? (
            <p>No orders match these filters.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className={trade.asset?.id ? "clickable-row" : ""}
                      onClick={() =>
                        trade.asset?.id &&
                        navigate(`/portfolio/holdings/${trade.asset.id}`)
                      }
                    >
                      <td>
                        <strong>{trade.asset?.symbol || "-"}</strong>
                        <span>{trade.asset?.name || "Unknown asset"}</span>
                      </td>
                      <td className={trade.side === "BUY" ? "positive" : "negative"}>
                        {trade.side}
                      </td>
                      <td>{trade.orderType}</td>
                      <td>{trade.quantity}</td>
                      <td>{formatCurrency(trade.price)}</td>
                      <td>{formatCurrency(trade.amount)}</td>
                      <td>{trade.status}</td>
                      <td>{formatDate(orderDate(trade))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
