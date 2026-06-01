function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

// Allocation shares are always non-negative portions of the whole, so no +/-
// sign — just the magnitude.
function formatShare(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

// A small fixed palette for allocation slices. "Cash" always renders grey.
const SLICE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
];

export function colorForSlice(label, index) {
  if (label === "Cash") {
    return "#94a3b8";
  }
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

/**
 * Donut chart of allocation, drawn as pure SVG arcs (no charting dependency).
 * `allocation` is an array of { label, value, percent }.
 * `size` controls the SVG dimension; `compact` hides the value column.
 */
export default function AllocationChart({ allocation, size = 180, compact = false }) {
  const total = (allocation || []).reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return <p>No allocation to display yet.</p>;
  }

  const stroke = size <= 140 ? 18 : 22;
  const radius = size / 2 - stroke / 2 - 1;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={`allocation-chart${compact ? " compact" : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {allocation.map((slice, index) => {
          const fraction = slice.value / total;
          const dash = fraction * circumference;
          const segment = (
            <circle
              key={slice.label}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={colorForSlice(slice.label, index)}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>

      <ul className="allocation-legend">
        {allocation.map((slice, index) => (
          <li key={slice.label}>
            <span
              className="legend-dot"
              style={{ background: colorForSlice(slice.label, index) }}
            />
            <span className="legend-label">{slice.label}</span>
            <span className="legend-value">
              {formatShare(slice.percent)}
              {compact ? "" : ` · ${formatCurrency(slice.value)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
