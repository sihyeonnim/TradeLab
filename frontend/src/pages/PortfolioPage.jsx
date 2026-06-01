import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import AllocationChart from "../components/AllocationChart.jsx";

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

function pnlClass(value) {
  return Number(value || 0) >= 0 ? "positive" : "negative";
}

/**
 * Line chart of total portfolio value over time (REQ-PORT-07/08), drawn as a
 * pure SVG polyline scaled to the data range.
 */
function PerformanceChart({ points }) {
  if (!points || points.length < 2) {
    return <p>Not enough history yet. Place a trade to start tracking performance.</p>;
  }

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };

  const values = points.map((point) => point.totalEquity);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xFor = (index) =>
    padding.left + (index / (points.length - 1)) * innerWidth;
  const yFor = (value) =>
    padding.top + (1 - (value - minValue) / valueRange) * innerHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.totalEquity)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${xFor(points.length - 1)} ${padding.top + innerHeight}` +
    ` L ${xFor(0)} ${padding.top + innerHeight} Z`;

  const lastValue = values[values.length - 1];
  const firstValue = values[0];
  const trendUp = lastValue >= firstValue;
  const strokeColor = trendUp ? "#22c55e" : "#ef4444";

  return (
    <svg
      className="performance-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Horizontal gridlines + y-axis labels */}
      {[0, 0.5, 1].map((ratio) => {
        const value = minValue + ratio * valueRange;
        const y = yFor(value);
        return (
          <g key={ratio}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
              {formatCurrency(value)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill={trendUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"} />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" />

      {/* Start and end date labels */}
      <text x={padding.left} y={height - 8} textAnchor="start" className="chart-axis-label">
        {formatDate(points[0].timestamp)}
      </text>
      <text x={width - padding.right} y={height - 8} textAnchor="end" className="chart-axis-label">
        {formatDate(points[points.length - 1].timestamp)}
      </text>
    </svg>
  );
}

export default function PortfolioPage() {
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState({ points: [] });
  const [trades, setTrades] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });

  useEffect(() => {
    async function loadPortfolio() {
      try {
        const [overviewResponse, historyResponse, tradesResponse] =
          await Promise.all([
            api.get("/portfolio/me/overview"),
            api.get("/portfolio/me/history"),
            api.get("/portfolio/me/trades"),
          ]);

        setOverview(overviewResponse.data);
        setHistory(historyResponse.data);
        setTrades(tradesResponse.data.trades || []);
        setStatus({ loading: false, error: "" });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error:
            error.response?.data?.message || "Failed to load portfolio data.",
        });
      }
    }

    loadPortfolio();
  }, [navigate]);

  // Holdings-only allocation (each position's share of total holdings value),
  // so the donut shows the asset mix at a glance — independent of cash.
  const holdingsAllocation = useMemo(() => {
    const holdings = overview?.holdings || [];
    const totalHoldingsValue = holdings.reduce(
      (sum, holding) => sum + Number(holding.marketValue || 0),
      0
    );

    if (totalHoldingsValue <= 0) {
      return [];
    }

    return holdings.map((holding) => ({
      label: holding.asset?.symbol || "—",
      value: Number(holding.marketValue || 0),
      percent:
        Math.round((Number(holding.marketValue || 0) / totalHoldingsValue) * 10000) /
        100,
    }));
  }, [overview]);

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading portfolio...</p>
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

  const summary = overview?.summary || {};
  const holdings = overview?.holdings || [];

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Portfolio</h1>
          <p className="dashboard-subtitle">
            Holdings, performance, and full trade history.
          </p>
        </div>

        <button className="secondary-button" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </nav>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <p className="eyebrow">Total value</p>
          <h3>{formatCurrency(summary.totalValue)}</h3>
          <p>Cash plus market value of holdings.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Cash balance</p>
          <h3>{formatCurrency(summary.cashBalance)}</h3>
          <p>Available virtual cash.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Holdings value</p>
          <h3>{formatCurrency(summary.holdingsValue)}</h3>
          <p>Current market value of positions.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">ROI</p>
          <h3 className={pnlClass(summary.roi)}>{formatPercent(summary.roi)}</h3>
          <p>Return on starting capital.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Realized P/L</p>
          <h3 className={pnlClass(summary.realizedPnl)}>
            {formatCurrency(summary.realizedPnl)}
          </h3>
          <p>Locked in from closed positions.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Unrealized P/L</p>
          <h3 className={pnlClass(summary.unrealizedPnl)}>
            {formatCurrency(summary.unrealizedPnl)}
          </h3>
          <p>Open positions at current prices.</p>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Performance</p>
          <h3>Portfolio value over time</h3>
          <PerformanceChart points={history.points} />
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Holdings</p>
          <h3>Current positions</h3>
          <p className="dashboard-subtitle">
            Click a position to view details and trade.
          </p>

          {holdings.length === 0 ? (
            <p>No holdings yet.</p>
          ) : (
            <div className="holdings-layout">
              <div className="holdings-chart">
                <AllocationChart allocation={holdingsAllocation} />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Qty</th>
                      <th>Avg. Price</th>
                      <th>Last Price</th>
                      <th>Market Value</th>
                      <th>Allocation</th>
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
                        <td>{formatPercent(holding.allocationPercent)}</td>
                        <td className={pnlClass(holding.unrealizedPnl)}>
                          {formatCurrency(holding.unrealizedPnl)} (
                          {formatPercent(holding.unrealizedPnlPercent)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Trade history</p>
          <h3>All transactions</h3>

          {trades.length === 0 ? (
            <p>No trades yet.</p>
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
                  {trades.map((trade) => (
                    <tr key={trade.id}>
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
                      <td>{formatDate(trade.executedAt || trade.createdAt)}</td>
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
