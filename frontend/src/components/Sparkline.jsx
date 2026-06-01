/**
 * Tiny pure-SVG line chart for a single asset's recent price points.
 * `points` is an array of { t, price }. Colours green/red by net change.
 */
export default function Sparkline({ points, width = 240, height = 64 }) {
  if (!points || points.length < 2) {
    return <p className="sparkline-empty">Collecting price data…</p>;
  }

  const prices = points.map((point) => Number(point.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const padding = 4;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const xFor = (index) =>
    padding + (index / (prices.length - 1)) * innerWidth;
  const yFor = (price) =>
    padding + (1 - (price - minPrice) / range) * innerHeight;

  const linePath = prices
    .map((price, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(price)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${xFor(prices.length - 1)} ${height - padding}` +
    ` L ${xFor(0)} ${height - padding} Z`;

  const first = prices[0];
  const last = prices[prices.length - 1];
  const up = last >= first;
  const stroke = up ? "#22c55e" : "#ef4444";
  const fill = up ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)";

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
