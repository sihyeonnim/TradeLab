import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

const initialData = {
  user: null,
  portfolio: null,
  assets: [],
  orders: [],
};

const initialOrderForm = {
  assetId: "",
  side: "BUY",
  quantity: 1,
};

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

function formatDate(value, range = "1M") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (range === "1D") {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SimpleLineChart({ data }) {
  if (!data.length) {
    return null;
  }

  const width = 720;
  const height = 260;
  const padding = 36;

  const prices = data.map((point) => Number(point.price || 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const points = data.map((point, index) => {
    const x =
      padding +
      (index / Math.max(data.length - 1, 1)) * (width - padding * 2);

    const y =
      height -
      padding -
      ((Number(point.price || 0) - minPrice) / priceRange) *
        (height - padding * 2);

    return {
      x,
      y,
      price: Number(point.price || 0),
      date: point.date,
    };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="simple-chart-wrap">
      <svg
        className="simple-line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Asset price chart"
      >
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          className="chart-axis"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="chart-axis"
        />

        <text x={padding} y={padding - 10} className="chart-label">
          ${maxPrice.toFixed(2)}
        </text>
        <text x={padding} y={height - padding + 24} className="chart-label">
          ${minPrice.toFixed(2)}
        </text>

        <path d={pathData} className="chart-line" fill="none" />

        {points.map((point, index) => (
          <circle
            key={`${point.date}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            className="chart-dot"
          >
            <title>
              {point.date}: ${point.price.toFixed(2)}
            </title>
          </circle>
        ))}
      </svg>

      <div className="simple-chart-meta">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function getPortfolioSummary(portfolio) {
  if (!portfolio) {
    return {
      cashBalance: 0,
      totalAssetValue: 0,
      totalEquity: 0,
      roi: 0,
      holdings: [],
    };
  }

  return {
    cashBalance: Number(portfolio.cashBalance ?? 0),
    totalAssetValue: Number(
      portfolio.totalAssetValue ?? portfolio.summary?.holdingsValue ?? 0
    ),
    totalEquity: Number(
      portfolio.totalEquity ??
        portfolio.summary?.totalValue ??
        portfolio.cashBalance ??
        0
    ),
    roi: Number(portfolio.roi ?? portfolio.summary?.roi ?? 0),
    holdings: portfolio.holdings || [],
  };
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getAssetPrice(asset) {
  if (!asset || typeof asset === "string") {
    return 0;
  }

  return toNumber(asset.lastPrice ?? asset.lastFetchedPrice, 0);
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
    holding.averageBuyPrice ?? holding.averagePrice ?? holding.avgPrice,
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

function findHoldingForAsset(holdings, assetId, assets) {
  if (!Array.isArray(holdings)) {
    return null;
  }

  return (
    holdings.find((holding) => {
      const holdingAsset = resolveHoldingAsset(holding, assets);
      return String(getAssetId(holdingAsset)) === String(assetId);
    }) || null
  );
}

export default function MarketPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(initialData);
  const [orderForm, setOrderForm] = useState(initialOrderForm);
  const [selectedChartAssetId, setSelectedChartAssetId] = useState("");
  const [chartRange, setChartRange] = useState("1M");
  const [priceHistory, setPriceHistory] = useState([]);
  const [liveMarket, setLiveMarket] = useState(true);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submitting: false,
    refreshing: false,
  });

  async function loadPriceHistory(assetId, range = chartRange) {
    if (!assetId) {
      setPriceHistory([]);
      return;
    }

    const response = await api.get(
      `/market/assets/${assetId}/prices?range=${range}`
    );

    setPriceHistory(response.data.prices || []);
  }

  async function loadMarketData(assetIdForChart) {
    const [meResponse, assetsResponse, portfolioResponse, ordersResponse] =
      await Promise.all([
        api.get("/auth/me"),
        api.get("/market/assets").catch(() => api.get("/assets")),
        api.get("/portfolio/me"),
        api.get("/orders/me"),
      ]);

    const assets = assetsResponse.data.assets || [];
    const rawPortfolio =
      portfolioResponse.data.portfolio || portfolioResponse.data || null;
    const portfolio = rawPortfolio
      ? {
          ...rawPortfolio,
          holdings: rawPortfolio.holdings || portfolioResponse.data.holdings || [],
        }
      : null;
    const orders = ordersResponse.data.orders || [];

    const nextSelectedAssetId =
      assetIdForChart || selectedChartAssetId || assets[0]?.id || "";

    setData({
      user: meResponse.data.user,
      assets,
      portfolio,
      orders,
    });

    setOrderForm((prev) => ({
      ...prev,
      assetId: prev.assetId || assets[0]?.id || "",
    }));

    setSelectedChartAssetId(nextSelectedAssetId);

    if (nextSelectedAssetId) {
      await loadPriceHistory(nextSelectedAssetId, chartRange);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadMarketData();

        setStatus({
          loading: false,
          error: "",
          message: "",
          submitting: false,
          refreshing: false,
        });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error:
            error.response?.data?.message || "Failed to load market data.",
          message: "",
          submitting: false,
          refreshing: false,
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    async function updateChart() {
      try {
        await loadPriceHistory(selectedChartAssetId, chartRange);
      } catch {
        setPriceHistory([]);
      }
    }

    if (selectedChartAssetId) {
      updateChart();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChartAssetId, chartRange]);

  useEffect(() => {
    if (!liveMarket) {
      return;
    }

    if (!selectedChartAssetId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        await api.post("/market/assets/tick");
        await loadMarketData(selectedChartAssetId);
        await loadPriceHistory(selectedChartAssetId, chartRange);
      } catch (error) {
        console.warn("Live market tick failed:", error.response?.data || error);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMarket, selectedChartAssetId, chartRange]);

  const portfolioSummary = getPortfolioSummary(data.portfolio);

  const selectedOrderAsset = useMemo(() => {
    return data.assets.find((asset) => asset.id === orderForm.assetId) || null;
  }, [data.assets, orderForm.assetId]);

  const selectedChartAsset = useMemo(() => {
    return data.assets.find((asset) => asset.id === selectedChartAssetId) || null;
  }, [data.assets, selectedChartAssetId]);

  const selectedHolding = useMemo(() => {
    return findHoldingForAsset(
      portfolioSummary.holdings,
      orderForm.assetId,
      data.assets
    );
  }, [portfolioSummary.holdings, orderForm.assetId, data.assets]);

  const selectedAssetPrice = getAssetPrice(selectedOrderAsset);
  const selectedHoldingQuantity = getHoldingQuantity(selectedHolding);

  const estimatedAmount = useMemo(() => {
    return Number(orderForm.quantity || 0) * selectedAssetPrice;
  }, [orderForm.quantity, selectedAssetPrice]);

  const maxBuyQuantity = useMemo(() => {
    if (!selectedAssetPrice || selectedAssetPrice <= 0) {
      return 0;
    }

    return Math.floor(portfolioSummary.cashBalance / selectedAssetPrice);
  }, [portfolioSummary.cashBalance, selectedAssetPrice]);

  const maxSellQuantity = useMemo(() => {
    return Math.floor(selectedHoldingQuantity);
  }, [selectedHoldingQuantity]);

  const maxOrderQuantity =
    orderForm.side === "BUY" ? maxBuyQuantity : maxSellQuantity;

  const chartData = useMemo(() => {
    return priceHistory.map((point) => ({
      date: formatDate(point.timestamp, chartRange),
      price: Number(point.price || point.close || 0),
      rawDate: point.timestamp,
    }));
  }, [priceHistory, chartRange]);

  function updateOrderForm(event) {
    const { name, value } = event.target;

    setOrderForm((prev) => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value,
    }));
  }

  function setMaximumQuantity() {
    setOrderForm((prev) => ({
      ...prev,
      quantity: Math.max(0, maxOrderQuantity),
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.post("/orders/market", {
        assetId: orderForm.assetId,
        side: orderForm.side,
        quantity: Number(orderForm.quantity),
      });

      await loadMarketData(selectedChartAssetId);
      await loadPriceHistory(selectedChartAssetId, chartRange);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Order executed.",
        submitting: false,
        refreshing: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Order failed.",
        message: "",
        submitting: false,
        refreshing: false,
      });
    }
  }

  async function tickMarketNow() {
    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      refreshing: true,
    }));

    try {
      const response = await api.post("/market/assets/tick");

      await loadMarketData(selectedChartAssetId);
      await loadPriceHistory(selectedChartAssetId, chartRange);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Live market tick completed.",
        submitting: false,
        refreshing: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to run live market tick.",
        message: "",
        submitting: false,
        refreshing: false,
      });
    }
  }

  async function simulateSelectedAsset() {
    if (!selectedChartAssetId) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      refreshing: true,
    }));

    try {
      const response = await api.post(
        `/market/assets/${selectedChartAssetId}/simulate`
      );

      await loadMarketData(selectedChartAssetId);
      await loadPriceHistory(selectedChartAssetId, chartRange);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Market price simulated.",
        submitting: false,
        refreshing: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message || "Failed to simulate selected asset.",
        message: "",
        submitting: false,
        refreshing: false,
      });
    }
  }

  async function simulateAllAssets() {
    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      refreshing: true,
    }));

    try {
      const response = await api.post("/market/assets/simulate");

      await loadMarketData(selectedChartAssetId);
      await loadPriceHistory(selectedChartAssetId, chartRange);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Market prices simulated.",
        submitting: false,
        refreshing: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to simulate market.",
        message: "",
        submitting: false,
        refreshing: false,
      });
    }
  }

  async function refreshSelectedAssetFromApi() {
    if (!selectedChartAssetId) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      refreshing: true,
    }));

    try {
      const response = await api.post(
        `/market/assets/${selectedChartAssetId}/refresh`
      );

      await loadMarketData(selectedChartAssetId);
      await loadPriceHistory(selectedChartAssetId, chartRange);

      setStatus({
        loading: false,
        error: "",
        message:
          response.data.message ||
          "Real price refreshed from Alpha Vantage.",
        submitting: false,
        refreshing: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message ||
          "Failed to refresh real price. The free API may be rate-limited.",
        message: "",
        submitting: false,
        refreshing: false,
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading market...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Market</h1>
          <p className="dashboard-subtitle">
            Buy and sell assets using your virtual portfolio.
          </p>
        </div>

        <div className="user-pill">
          {data.user?.displayName || data.user?.name || "User"}
        </div>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Cash Balance</span>
          <strong>{formatCurrency(portfolioSummary.cashBalance)}</strong>
        </article>

        <article className="stat-card">
          <span>Total Asset Value</span>
          <strong>{formatCurrency(portfolioSummary.totalAssetValue)}</strong>
        </article>

        <article className="stat-card">
          <span>Total Portfolio Value</span>
          <strong>{formatCurrency(portfolioSummary.totalEquity)}</strong>
        </article>

        <article className="stat-card">
          <span>ROI</span>
          <strong>{formatPercent(portfolioSummary.roi)}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <p className="eyebrow">Trade</p>
          <h3>Market Order</h3>

          <form className="order-form" onSubmit={submitOrder}>
            <label>
              Asset
              <select
                name="assetId"
                value={orderForm.assetId}
                onChange={updateOrderForm}
              >
                {data.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.symbol} · {asset.name} ·{" "}
                    {formatCurrency(getAssetPrice(asset))}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Side
              <select
                name="side"
                value={orderForm.side}
                onChange={updateOrderForm}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>

            <label>
              Quantity
              <div className="quantity-row">
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={updateOrderForm}
                />
                <button
                  type="button"
                  className="secondary-button max-button"
                  onClick={setMaximumQuantity}
                  disabled={maxOrderQuantity <= 0}
                >
                  100%
                </button>
              </div>
            </label>

            <div className="estimate-box">
              <span>Unit Price</span>
              <strong>{formatCurrency(selectedAssetPrice)}</strong>
            </div>

            <div className="estimate-box">
              <span>
                {orderForm.side === "BUY"
                  ? "Estimated cost"
                  : "Estimated proceeds"}
              </span>
              <strong>{formatCurrency(estimatedAmount)}</strong>
            </div>

            <div className="estimate-box">
              <span>
                {orderForm.side === "BUY"
                  ? "Maximum buy quantity"
                  : "Maximum sell quantity"}
              </span>
              <strong>{maxOrderQuantity}</strong>
            </div>

            {orderForm.side === "SELL" && (
              <p className="muted-text">
                You currently hold {selectedHoldingQuantity} shares/units of{" "}
                {selectedOrderAsset?.symbol || "this asset"}.
              </p>
            )}

            <button disabled={status.submitting}>
              {status.submitting ? "Submitting..." : "Submit Order"}
            </button>
          </form>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Chart</p>
          <h3>Asset Price Chart</h3>

          <label>
            Chart Asset
            <select
              value={selectedChartAssetId}
              onChange={(event) => setSelectedChartAssetId(event.target.value)}
            >
              {data.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} · {asset.name}
                </option>
              ))}
            </select>
          </label>

          <div className="range-tabs">
            {["1D", "1W", "1M", "3M", "1Y"].map((range) => (
              <button
                key={range}
                type="button"
                className={chartRange === range ? "active" : ""}
                onClick={() => setChartRange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="chart-actions">
            <button onClick={tickMarketNow} disabled={status.refreshing}>
              {status.refreshing ? "Updating..." : "Update Market Now"}
            </button>

            <button onClick={simulateSelectedAsset} disabled={status.refreshing}>
              {status.refreshing ? "Simulating..." : "Simulate Selected"}
            </button>

            <button
              className="secondary-button"
              onClick={simulateAllAssets}
              disabled={status.refreshing}
            >
              Simulate All
            </button>

            <button
              className="secondary-button"
              onClick={refreshSelectedAssetFromApi}
              disabled={status.refreshing}
            >
              Refresh Real Price
            </button>
          </div>

          <label className="live-market-toggle">
            <input
              type="checkbox"
              checked={liveMarket}
              onChange={(event) => setLiveMarket(event.target.checked)}
            />
            Live local market simulation
          </label>

          <p className="muted-text">
            Live simulation updates local prices every 10 seconds without using
            the external API. Alpha Vantage remains available only as a limited
            real-data baseline source.
          </p>

          {chartData.length === 0 ? (
            <div className="chart-placeholder">
              <strong>{selectedChartAsset?.symbol || "Asset"} chart</strong>
              <p>
                No price history yet. Click Update Market Now or Simulate
                Selected to generate local market data.
              </p>
            </div>
          ) : (
            <div className="price-chart">
              <SimpleLineChart data={chartData} />
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Holdings</p>
          <h3>Current Holdings</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Quantity</th>
                  <th>Average Price</th>
                  <th>Current Price</th>
                  <th>Market Value</th>
                  <th>Return</th>
                </tr>
              </thead>

              <tbody>
                {portfolioSummary.holdings.length === 0 ? (
                  <tr>
                    <td colSpan="6">No holdings yet.</td>
                  </tr>
                ) : (
                  portfolioSummary.holdings.map((holding) => {
                    const asset = resolveHoldingAsset(holding, data.assets);
                    const quantity = getHoldingQuantity(holding);
                    const averagePrice = getHoldingAveragePrice(holding);
                    const currentPrice = getAssetPrice(asset);
                    const marketValue = getHoldingMarketValue(holding, data.assets);
                    const returnPercent =
                      averagePrice > 0
                        ? ((currentPrice - averagePrice) / averagePrice) * 100
                        : 0;

                    return (
                      <tr key={holding.id || getAssetId(asset)}>
                        <td>
                          <strong>{asset?.symbol || "-"}</strong>
                          <span>{asset?.name || ""}</span>
                        </td>
                        <td>{quantity}</td>
                        <td>{formatCurrency(averagePrice)}</td>
                        <td>{formatCurrency(currentPrice)}</td>
                        <td>{formatCurrency(marketValue)}</td>
                        <td>{formatPercent(returnPercent)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Assets</p>
          <h3>Available Assets</h3>

          <div className="asset-grid">
            {data.assets.map((asset) => (
              <div className="asset-card" key={asset.id}>
                <strong>{asset.symbol}</strong>
                <span>{asset.name}</span>
                <em>{formatCurrency(getAssetPrice(asset))}</em>
                {asset.lastFetchedAt && (
                  <small>Updated {formatDate(asset.lastFetchedAt)}</small>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Orders</p>
          <h3>Recent Orders</h3>

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
                </tr>
              </thead>

              <tbody>
                {data.orders.length === 0 ? (
                  <tr>
                    <td colSpan="6">No orders yet.</td>
                  </tr>
                ) : (
                  data.orders.slice(0, 8).map((order) => (
                    <tr key={order.id}>
                      <td>{order.asset?.symbol || "-"}</td>
                      <td>{order.side}</td>
                      <td>{order.orderType || order.type || "MARKET"}</td>
                      <td>{order.quantity}</td>
                      <td>
                        {formatCurrency(
                          order.executedPrice ||
                            order.price ||
                            order.requestedPrice
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