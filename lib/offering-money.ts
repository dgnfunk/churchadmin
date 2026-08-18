const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export function normalizeCurrencyCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    new Intl.NumberFormat("es-MX", { style: "currency", currency: code }).format(0);
    return code;
  } catch {
    return null;
  }
}

export function currencyFractionDigits(currencyCode: string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: currencyCode })
    .resolvedOptions().maximumFractionDigits ?? 2;
}

export function parseMoneyToMinor(value: string, currencyCode: string) {
  const digits = currencyFractionDigits(currencyCode);
  const clean = value.trim().replace(/\s/g, "").replace(",", ".");
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0") || "0");
  return minor <= MAX_MINOR ? minor : null;
}

export function formatMoneyMinor(value: bigint | string, currencyCode: string) {
  const digits = currencyFractionDigits(currencyCode);
  const divisor = 10 ** digits;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(BigInt(value)) / divisor);
}

export function minorToDecimal(value: bigint | string, currencyCode: string) {
  const digits = currencyFractionDigits(currencyCode);
  const minor = BigInt(value);
  if (digits === 0) return minor.toString();
  const divisor = 10n ** BigInt(digits);
  return `${minor / divisor}.${(minor % divisor).toString().padStart(digits, "0")}`;
}

export function roundedAverageMinor(total: bigint, count: number) {
  if (!count) return 0n;
  const divisor = BigInt(count);
  return (total + divisor / 2n) / divisor;
}
