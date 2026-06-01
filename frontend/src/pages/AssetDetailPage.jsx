import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

function pnlClass(value) {
  return Number(value || 0) >= 0 ? "positive" : "negative";
}

export default function AssetDetailPage() {
  const navigate = useNavigate();
  const { assetId } = useParams();

  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [sliderPercent, setSliderPercent] = useState(0);
  const [orderStatus, setOrderStatus] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const [priceStatus, setPriceStatus] = useState({ loading: false, error: "" });

  async function loadDetail() {
    const response = await api.get(`/portfolio/me/holdings/${assetId}`);
    setDetail(response.data);
    setStatus({ loading: false, error: "" });
  }

  useEffect(() => {
    async function init() {
      try {
        await loadDetail();
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error:
            error.response?.data?.message || "Failed to load asset detail.",
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, navigate]);

  const asset = detail?.asset || null;
  const position = detail?.position || null;
  const cashBalance = Number(detail?.cashBalance || 0);
  const trades = detail?.trades || [];

  const lastPrice = Number(asset?.lastPrice || 0);
  const heldQuantity = Number(position?.quantity || 0);

  const estimatedAmount = useMemo(
    () => Number(quantity || 0) * lastPrice,
    [quantity, lastPrice]
  );

  const maxBuyQuantity = lastPrice > 0 ? cashBalance / lastPrice : 0;

  // Truncate to 6 decimals so a slider-derived buy never rounds *up* past the
  // available cash (which the backend would reject).
  function floor6(value) {
    return Math.floor(Number(value || 0) * 1e6) / 1e6;
  }

  // BUY: percent of cash to spend. SELL: percent of held quantity to sell.
  function applyPercent(percent) {
    setSliderPercent(percent);

    if (side === "BUY") {
      const spend = (cashBalance * percent) / 100;
      const qty = lastPrice > 0 ? floor6(spend / lastPrice) : 0;
      setQuantity(String(qty));
    } else {
      // At 100% sell the exact held quantity; otherwise floor to avoid
      // exceeding the position by a rounding hair.
      const qty =
        percent >= 100 ? heldQuantity : floor6((heldQuantity * percent) / 100);
      setQuantity(String(qty));
    }
  }

  function switchSide(nextSide) {
    setSide(nextSide);
    setSliderPercent(0);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setOrderStatus({ loading: true, message: "", error: "" });

    try {
      const response = await api.post("/orders/market", {
        assetId,
        side,
        quantity: Number(quantity),
      });

      setOrderStatus({
        loading: false,
        message: response.data.message,
        error: "",
      });

      setSliderPercent(0);
      await loadDetail();
    } catch (error) {
      setOrderStatus({
        loading: false,
        message: "",
        error: error.response?.data?.message || "Failed to submit order.",
      });
    }
  }

  async function handleRefreshPrice() {
    setPriceStatus({ loading: true, error: "" });

    try {
      await api.post("/assets/refresh");
      await loadDetail();
      setPriceStatus({ loading: false, error: "" });
    } catch (error) {
      setPriceStatus({
        loading: false,
        error:
          error.response?.data?.message || "Failed to refresh market prices.",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading asset...</p>
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
          <h1>
            {asset?.symbol} <span className="dashboard-subtitle">{asset?.name}</span>
          </h1>
          <p className="dashboard-subtitle">
            {asset?.type} · {asset?.exchange || "—"} · {asset?.currency}
          </p>
        </div>

        <button className="secondary-button" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </nav>

      <section className="dashboard-grid">
        <article className="dashboard-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Last price</p>
              <h3>{formatCurrency(lastPrice)}</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRefreshPrice}
              disabled={priceStatus.loading}
            >
              {priceStatus.loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <p>As of {formatDate(asset?.lastFetchedAt)}.</p>
          {priceStatus.error && <p className="error">{priceStatus.error}</p>}
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Cash balance</p>
          <h3>{formatCurrency(cashBalance)}</h3>
          <p>Available buying power.</p>
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Your position</p>
          {position ? (
            <>
              <h3>
                {heldQuantity} @ {formatCurrency(position.averagePrice)}
              </h3>
              <p className={pnlClass(position.unrealizedPnl)}>
                {formatCurrency(position.marketValue)} ·{" "}
                {formatCurrency(position.unrealizedPnl)} (
                {formatPercent(position.unrealizedPnlPercent)})
              </p>
            </>
          ) : (
            <>
              <h3>No position</h3>
              <p>You don't hold this asset yet.</p>
            </>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Trade</p>
          <h3>Buy or sell {asset?.symbol}</h3>

          <form className="trade-form" onSubmit={handleSubmit}>
            <label>
              Side
              <div className="side-toggle" role="group" aria-label="Order side">
                {["BUY", "SELL"].map((sideOption) => (
                  <button
                    type="button"
                    key={sideOption}
                    className={`side-toggle-btn ${sideOption.toLowerCase()}${
                      side === sideOption ? " active" : ""
                    }`}
                    aria-pressed={side === sideOption}
                    onClick={() => switchSide(sideOption)}
                  >
                    {sideOption}
                  </button>
                ))}
              </div>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setSliderPercent(0);
                }}
                required
              />
            </label>

            <label className="slider-label">
              <span className="slider-caption">
                {side === "BUY"
                  ? `Use ${sliderPercent}% of cash`
                  : `Sell ${sliderPercent}% of holdings`}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={sliderPercent}
                onChange={(event) => applyPercent(Number(event.target.value))}
                disabled={
                  side === "BUY" ? lastPrice <= 0 : heldQuantity <= 0
                }
              />
              <div className="slider-ticks">
                {[0, 25, 50, 75, 100].map((mark) => (
                  <button
                    type="button"
                    key={mark}
                    className="slider-tick"
                    onClick={() => applyPercent(mark)}
                    disabled={
                      side === "BUY" ? lastPrice <= 0 : heldQuantity <= 0
                    }
                  >
                    {mark === 100 ? "Max" : `${mark}%`}
                  </button>
                ))}
              </div>
            </label>

            <div className="estimate-box">
              <span>Estimated {side === "BUY" ? "cost" : "proceeds"}</span>
              <strong>{formatCurrency(estimatedAmount)}</strong>
            </div>

            <div className="trade-hints">
              {side === "BUY" ? (
                <span>Max buy ≈ {maxBuyQuantity.toFixed(6)} units</span>
              ) : (
                <span>Held: {heldQuantity} units</span>
              )}
            </div>

            <button disabled={orderStatus.loading || lastPrice <= 0}>
              {orderStatus.loading
                ? "Submitting..."
                : `Submit ${side.toLowerCase()} order`}
            </button>
          </form>

          {orderStatus.message && <p className="success">{orderStatus.message}</p>}
          {orderStatus.error && <p className="error">{orderStatus.error}</p>}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">History</p>
          <h3>Trades for {asset?.symbol}</h3>

          {trades.length === 0 ? (
            <p>No trades for this asset yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
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
