const XLM_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const INT_FORMAT = new Intl.NumberFormat("en-US");

export function fmtXLM(value: number): string {
  return XLM_FORMAT.format(value);
}

export function fmtUSD(value: number): string {
  return USD_FORMAT.format(value);
}

export function fmtInt(value: number): string {
  return INT_FORMAT.format(value);
}

export function fmtAmount(value: number, asset: string): string {
  return `${XLM_FORMAT.format(value)} ${asset}`;
}

/** GABC…XYZW — truncate a Stellar address or hash through the middle. */
export function truncMiddle(value: string, head = 4, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function timeAgo(isoTime: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(isoTime).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.floor(months)}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function fmtDate(isoTime: string): string {
  return new Date(isoTime).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(isoTime: string): string {
  return new Date(isoTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
