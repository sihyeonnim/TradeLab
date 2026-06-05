import { fetchAndStoreAllCurrentQuotePrices } from "./marketData.service";

const DEFAULT_REFRESH_HOURS = [21, 0, 3, 6];

let autoRealRefreshInterval: NodeJS.Timeout | null = null;
let isRealRefreshRunning = false;
let lastRefreshKey: string | null = null;

function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return value !== "false";
}

function parseHourList(value: string | undefined) {
  if (!value) {
    return DEFAULT_REFRESH_HOURS;
  }

  const hours = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);

  return hours.length ? Array.from(new Set(hours)) : DEFAULT_REFRESH_HOURS;
}

function getZonedParts(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${map.get("year")}-${map.get("month")}-${map.get("day")}`,
    hour: Number(map.get("hour") || 0),
    minute: Number(map.get("minute") || 0),
  };
}

function isRefreshHour(hour: number, allowedHours: number[]) {
  return allowedHours.includes(hour);
}

export function startAutoRealMarketRefresh() {
  const enabled = parseBooleanEnv(
    process.env.AUTO_REAL_MARKET_REFRESH_ENABLED,
    true
  );

  if (!enabled) {
    console.log("Auto real market refresh disabled.");
    return;
  }

  if (autoRealRefreshInterval) {
    return;
  }

  const timeZone = process.env.AUTO_REAL_MARKET_REFRESH_TIMEZONE || "Asia/Seoul";
  const refreshHours = parseHourList(process.env.AUTO_REAL_MARKET_REFRESH_HOURS);
  const checkSeconds = Math.max(
    Number(process.env.AUTO_REAL_MARKET_REFRESH_CHECK_SECONDS || 60),
    30
  );

  console.log(
    `Auto real market refresh enabled. Time zone=${timeZone}, hours=${refreshHours.join(",")}, check=${checkSeconds}s`
  );

  autoRealRefreshInterval = setInterval(async () => {
    const now = getZonedParts(timeZone);

    if (!isRefreshHour(now.hour, refreshHours)) {
      return;
    }

    const refreshKey = `${now.dateKey}-${String(now.hour).padStart(2, "0")}`;

    if (lastRefreshKey === refreshKey || isRealRefreshRunning) {
      return;
    }

    isRealRefreshRunning = true;
    lastRefreshKey = refreshKey;

    try {
      const results = await fetchAndStoreAllCurrentQuotePrices();
      const successCount = results.filter((result) => result.success).length;
      const failedCount = results.length - successCount;

      console.log(
        `[real market refresh] ${refreshKey} completed. success=${successCount}, failed=${failedCount}`
      );
    } catch (error) {
      console.error(`[real market refresh] ${refreshKey} failed.`);
      console.error(error);
    } finally {
      isRealRefreshRunning = false;
    }
  }, checkSeconds * 1000);
}
