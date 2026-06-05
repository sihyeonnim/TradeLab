import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

const allocationColors = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
  "#84cc16",
  "#60a5fa",
  "#e879f9",
];

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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  return formatDateTime(value);
}

function formatParticipantPercent(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "Pending";
  }

  return formatPercent(entry?.roi || 0);
}

function formatParticipantProfit(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "Pending";
  }

  return formatCurrency(entry?.profit || 0);
}

function formatParticipantRank(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "-";
  }

  return entry?.rank || "-";
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getPortfolioSummary(portfolio) {
  if (!portfolio) {
    return {
      cashBalance: 0,
      totalAssetValue: 0,
      totalEquity: 0,
      roi: 0,
      startingCash: 100000,
      holdings: [],
    };
  }

  return {
    cashBalance: toNumber(portfolio.cashBalance, 0),
    totalAssetValue: toNumber(
      portfolio.totalAssetValue ?? portfolio.summary?.holdingsValue,
      0
    ),
    totalEquity: toNumber(
      portfolio.totalEquity ?? portfolio.summary?.totalValue ?? portfolio.cashBalance,
      0
    ),
    roi: toNumber(portfolio.roi ?? portfolio.summary?.roi, 0),
    startingCash: toNumber(
      portfolio.startingCash ??
        portfolio.initialCash ??
        portfolio.initialBalance ??
        portfolio.startingBalance,
      100000
    ),
    holdings: portfolio.holdings || [],
  };
}

function getAssetId(asset) {
  if (!asset) {
    return "";
  }

  if (typeof asset === "string") {
    return asset;
  }

  return String(asset.id || asset._id || "");
}

function getAssetPrice(asset) {
  if (!asset || typeof asset === "string") {
    return 0;
  }

  return toNumber(asset.lastPrice ?? asset.lastFetchedPrice, 0);
}

function getHoldingAsset(holding) {
  if (!holding) {
    return null;
  }

  return holding.asset || holding.assetInfo || null;
}

function resolveHoldingAsset(holding, assets) {
  const rawAsset = getHoldingAsset(holding);

  if (!rawAsset) {
    return null;
  }

  if (typeof rawAsset === "object") {
    const rawAssetId = getAssetId(rawAsset);
    const latestAsset = assets.find(
      (asset) => String(getAssetId(asset)) === String(rawAssetId)
    );

    return latestAsset || rawAsset;
  }

  return (
    assets.find((asset) => String(getAssetId(asset)) === String(rawAsset)) || null
  );
}

function getHoldingQuantity(holding) {
  if (!holding) {
    return 0;
  }

  return toNumber(holding.quantity, 0);
}

function getHoldingAveragePrice(holding) {
  if (!holding) {
    return 0;
  }

  return toNumber(
    holding.averagePrice ?? holding.averageBuyPrice ?? holding.avgPrice,
    0
  );
}

function getHoldingMarketValue(holding, assets) {
  const asset = resolveHoldingAsset(holding, assets);
  const quantity = getHoldingQuantity(holding);
  const price = getAssetPrice(asset);

  if (price > 0) {
    return quantity * price;
  }

  return toNumber(holding?.marketValue, 0);
}

function getHoldingReturnPercent(holding, assets) {
  const asset = resolveHoldingAsset(holding, assets);
  const currentPrice = getAssetPrice(asset);
  const averagePrice = getHoldingAveragePrice(holding);

  if (averagePrice <= 0) {
    return 0;
  }

  return ((currentPrice - averagePrice) / averagePrice) * 100;
}

function getCourseTitle(enrollment) {
  if (!enrollment) {
    return "Course";
  }

  if (enrollment.course && typeof enrollment.course === "object") {
    return enrollment.course.title || "Course";
  }

  return "Course";
}


function isEnrollmentCourseVisible(enrollment) {
  const course = enrollment?.course;

  if (!course || typeof course !== "object") {
    return false;
  }

  const approvalStatus = String(
    course.approvalStatus || course.status || ""
  ).toUpperCase();

  if (approvalStatus && approvalStatus !== "APPROVED") {
    return false;
  }

  if (typeof course.isPublished === "boolean" && !course.isPublished) {
    return false;
  }

  if (course.rejectionReason) {
    return false;
  }

  return true;
}

function getCompetitionTitle(item) {
  if (!item) {
    return "Competition";
  }

  if (item.competition && typeof item.competition === "object") {
    return item.competition.title || item.competition.name || "Competition";
  }

  return "Competition";
}

function getCompetitionStatus(item) {
  if (!item) {
    return "-";
  }

  if (item.competition && typeof item.competition === "object") {
    return item.competition.status || "-";
  }

  return "-";
}

function isCompetitionPending(item) {
  return (
    item?.participation?.scorePending ||
    item?.participation?.competitionStatus === "UPCOMING" ||
    getCompetitionStatus(item) === "UPCOMING"
  );
}

function getCompetitionRoi(item) {
  if (isCompetitionPending(item)) {
    return null;
  }

  return toNumber(item?.participation?.roi ?? item?.roi, 0);
}

function getCompetitionRank(item) {
  if (isCompetitionPending(item)) {
    return null;
  }

  return item?.participation?.rank ?? item?.rank ?? null;
}

function formatCompetitionRoi(item) {
  if (isCompetitionPending(item)) {
    return "Pending";
  }

  return formatPercent(getCompetitionRoi(item));
}

function buildAllocationData(portfolioSummary, holdingsValue, assets) {
  const rows = [];

  if (portfolioSummary.cashBalance > 0) {
    rows.push({
      label: "Cash",
      value: portfolioSummary.cashBalance,
    });
  }

  const assetMap = new Map();

  portfolioSummary.holdings.forEach((holding) => {
    const asset = resolveHoldingAsset(holding, assets);
    const symbol = asset?.symbol || "Unknown Asset";
    const value = getHoldingMarketValue(holding, assets);

    if (value <= 0) {
      return;
    }

    assetMap.set(symbol, (assetMap.get(symbol) || 0) + value);
  });

  assetMap.forEach((value, label) => {
    rows.push({ label, value });
  });

  if (rows.length === 1 && rows[0].label === "Cash" && holdingsValue > 0) {
    rows.push({
      label: "Assets",
      value: holdingsValue,
    });
  }

  return rows
    .filter((row) => row.value > 0)
    .map((row, index) => ({
      ...row,
      color: allocationColors[index % allocationColors.length],
    }));
}

function buildConicGradient(allocationData) {
  const total = allocationData.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0 || allocationData.length === 0) {
    return "conic-gradient(#334155 0 100%)";
  }

  let current = 0;
  const stops = allocationData.map((item) => {
    const start = current;
    const percent = (item.value / total) * 100;
    current += percent;
    return `${item.color} ${start.toFixed(2)}% ${current.toFixed(2)}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [data, setData] = useState({
    user: null,
    portfolio: null,
    assets: [],
    orders: [],
    enrollments: [],
    joinedCompetitions: [],
    currentCompetition: null,
  });

  const [status, setStatus] = useState({
    loading: true,
    error: "",
  });

  async function loadDashboard({ silent = false } = {}) {
    try {
      const [
        meResponse,
        portfolioResponse,
        assetsResponse,
        ordersResponse,
        enrollmentsResponse,
        joinedCompetitionsResponse,
        currentCompetitionResponse,
      ] = await Promise.all([
        api.get("/auth/me"),
        api.get("/portfolio/me"),
        api.get("/market/assets").catch(() => api.get("/assets")),
        api.get("/orders/me"),
        api.get("/enrollments/me").catch(() => ({ data: { enrollments: [] } })),
        api.get("/competitions/me").catch(() => ({ data: { competitions: [] } })),
        api
          .get("/competitions/current")
          .catch(() => ({ data: { competition: null } })),
      ]);

      const rawPortfolio =
        portfolioResponse.data.portfolio || portfolioResponse.data || null;
      const portfolio = rawPortfolio
        ? {
            ...rawPortfolio,
            holdings: rawPortfolio.holdings || portfolioResponse.data.holdings || [],
          }
        : null;

      const visibleEnrollments = (
        enrollmentsResponse.data.enrollments || []
      ).filter(isEnrollmentCourseVisible);

      setData({
        user: meResponse.data.user,
        portfolio,
        assets: assetsResponse.data.assets || [],
        orders: ordersResponse.data.orders || [],
        enrollments: visibleEnrollments,
        joinedCompetitions: joinedCompetitionsResponse.data.competitions || [],
        currentCompetition: currentCompetitionResponse.data.competition || null,
      });

      setStatus({ loading: false, error: "" });
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }

      if (!silent) {
        setStatus({
          loading: false,
          error:
            error.response?.data?.message || "Failed to load dashboard data.",
        });
      }
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portfolioSummary = getPortfolioSummary(data.portfolio);

  const liveHoldingsValue = useMemo(() => {
    return portfolioSummary.holdings.reduce(
      (sum, holding) => sum + getHoldingMarketValue(holding, data.assets),
      0
    );
  }, [portfolioSummary.holdings, data.assets]);

  const liveTotalEquity = portfolioSummary.cashBalance + liveHoldingsValue;

  const liveRoi = useMemo(() => {
    if (portfolioSummary.startingCash <= 0) {
      return portfolioSummary.roi;
    }

    return (
      ((liveTotalEquity - portfolioSummary.startingCash) /
        portfolioSummary.startingCash) *
      100
    );
  }, [liveTotalEquity, portfolioSummary.startingCash, portfolioSummary.roi]);

  const allocationData = useMemo(() => {
    return buildAllocationData(portfolioSummary, liveHoldingsValue, data.assets);
  }, [portfolioSummary, liveHoldingsValue, data.assets]);

  const allocationTotal = allocationData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const allocationGradient = buildConicGradient(allocationData);

  const activeJoinedCompetitions = useMemo(() => {
    return data.joinedCompetitions.filter(
      (item) => getCompetitionStatus(item) !== "ENDED"
    );
  }, [data.joinedCompetitions]);

  const completedJoinedCompetitions = useMemo(() => {
    return data.joinedCompetitions.filter(
      (item) => getCompetitionStatus(item) === "ENDED"
    );
  }, [data.joinedCompetitions]);

  const winCount = useMemo(() => {
    return completedJoinedCompetitions.filter((item) => {
      const rank = getCompetitionRank(item);
      return Number(rank) === 1;
    }).length;
  }, [completedJoinedCompetitions]);

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Overview of your portfolio, courses, and competitions.
          </p>
        </div>

        <div className="nav-actions">
          {(data.user?.role === "INSTRUCTOR" || data.user?.role === "ADMIN") && (
            <Link className="nav-button" to="/instructor/courses">
              Instructor
            </Link>
          )}

          {data.user?.role === "ADMIN" && (
            <Link className="nav-button" to="/admin/courses">
              Admin
            </Link>
          )}

          <div className="user-pill">
            {data.user?.displayName || data.user?.name || "User"}
          </div>
        </div>
      </nav>

      {status.error && <p className="error">{status.error}</p>}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Cash Balance</span>
          <strong>{formatCurrency(portfolioSummary.cashBalance)}</strong>
        </article>

        <article className="stat-card">
          <span>Asset Value</span>
          <strong>{formatCurrency(liveHoldingsValue)}</strong>
        </article>

        <article className="stat-card">
          <span>Total Equity</span>
          <strong>{formatCurrency(liveTotalEquity)}</strong>
        </article>

        <article className="stat-card">
          <span>ROI</span>
          <strong>{formatPercent(liveRoi)}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <p className="eyebrow">Allocation</p>
          <h3>Cash and asset allocation</h3>

          <div
            className="allocation-donut"
            style={{
              background: allocationGradient,
            }}
          >
            <div className="allocation-donut-inner">
              <strong>{formatCurrency(allocationTotal)}</strong>
              <span>Total</span>
            </div>
          </div>

          <div className="allocation-legend allocation-legend-list">
            {allocationData.length === 0 ? (
              <span>No allocation data.</span>
            ) : (
              allocationData.map((item) => {
                const percent = allocationTotal
                  ? (item.value / allocationTotal) * 100
                  : 0;

                return (
                  <span key={item.label}>
                    <i
                      className="legend-dot"
                      style={{ backgroundColor: item.color }}
                    />{" "}
                    {item.label} {percent.toFixed(1)}% ·{" "}
                    {formatCurrency(item.value)}
                  </span>
                );
              })
            )}
          </div>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Holdings</p>
          <h3>Holdings Summary</h3>

          {portfolioSummary.holdings.length === 0 ? (
            <p>No holdings yet.</p>
          ) : (
            <div className="compact-list">
              {portfolioSummary.holdings.slice(0, 5).map((holding) => {
                const asset = resolveHoldingAsset(holding, data.assets);
                const quantity = getHoldingQuantity(holding);
                const price = getAssetPrice(asset);
                const marketValue = getHoldingMarketValue(holding, data.assets);
                const returnPercent = getHoldingReturnPercent(holding, data.assets);

                return (
                  <div className="compact-row" key={holding.id || getAssetId(asset)}>
                    <div>
                      <strong>{asset?.symbol || "-"}</strong>
                      <span>
                        {quantity} × {formatCurrency(price)} ·{" "}
                        {formatPercent(returnPercent)}
                      </span>
                    </div>
                    <em>{formatCurrency(marketValue)}</em>
                  </div>
                );
              })}
            </div>
          )}

          <Link className="secondary-button link-button" to="/market">
            Go to Market
          </Link>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Courses</p>
          <h3>My Courses</h3>

          {data.enrollments.length === 0 ? (
            <p>No enrolled courses yet.</p>
          ) : (
            <div className="compact-list">
              {data.enrollments.slice(0, 4).map((enrollment) => (
                <div className="compact-row" key={enrollment.id}>
                  <div>
                    <strong>{getCourseTitle(enrollment)}</strong>
                    <span>{enrollment.status}</span>
                  </div>
                  <em>{Number(enrollment.progressPercent || 0)}%</em>
                </div>
              ))}
            </div>
          )}

          <Link className="secondary-button link-button" to="/courses">
            Browse Courses
          </Link>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Competition</p>
          <h3>My Competitions</h3>

          {activeJoinedCompetitions.length === 0 ? (
            <p>No active or upcoming joined competitions.</p>
          ) : (
            <div className="compact-list">
              {activeJoinedCompetitions.slice(0, 4).map((item) => (
                <div
                  className="compact-row"
                  key={item.participation?.id || item.competition?.id}
                >
                  <div>
                    <strong>{getCompetitionTitle(item)}</strong>
                    <span>
                      {getCompetitionStatus(item)}
                      {getCompetitionRank(item)
                        ? ` · Rank #${getCompetitionRank(item)}`
                        : ""}
                    </span>
                  </div>
                  <em>{formatCompetitionRoi(item)}</em>
                </div>
              ))}
            </div>
          )}

          <div className="placeholder-metric">
            <span>Competition wins</span>
            <strong>{winCount}</strong>
          </div>

          {data.currentCompetition && (
            <p className="muted-text">
              Current: {data.currentCompetition.title || data.currentCompetition.name}
            </p>
          )}

          <Link className="secondary-button link-button" to="/competition">
            Go to Competition
          </Link>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">History</p>
          <h3>Past Competitions</h3>

          {completedJoinedCompetitions.length === 0 ? (
            <p>No completed competitions yet.</p>
          ) : (
            <div className="compact-list">
              {completedJoinedCompetitions.slice(0, 5).map((item) => (
                <div
                  className="compact-row"
                  key={item.participation?.id || item.competition?.id}
                >
                  <div>
                    <strong>{getCompetitionTitle(item)}</strong>
                    <span>
                      ENDED
                      {getCompetitionRank(item)
                        ? ` · Final rank #${getCompetitionRank(item)}`
                        : ""}
                    </span>
                  </div>
                  <em className={Number(getCompetitionRoi(item)) >= 0 ? "positive" : "negative"}>
                    {formatCompetitionRoi(item)}
                  </em>
                </div>
              ))}
            </div>
          )}

          <Link className="secondary-button link-button" to="/competition">
            View Competition History
          </Link>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Recent Orders</p>
          <h3>Order Summary</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {data.orders.length === 0 ? (
                  <tr>
                    <td colSpan="5">No orders yet.</td>
                  </tr>
                ) : (
                  data.orders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td>{order.asset?.symbol || "-"}</td>
                      <td>{order.side}</td>
                      <td>{order.quantity}</td>
                      <td>
                        {formatCurrency(
                          order.executedPrice || order.price || order.requestedPrice
                        )}
                      </td>
                      <td>{order.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <BottomNav user={data.user} />
    </main>
  );
}
