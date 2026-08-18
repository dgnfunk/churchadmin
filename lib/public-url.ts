export function publicAppUrl() {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  const value = configured || "http://localhost:3000";
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS in production.");
  return url.origin;
}

export function publicCheckInUrl(qrToken: string) {
  return `${publicAppUrl()}/check-in/${encodeURIComponent(qrToken)}`;
}

export function publicManualCheckInUrl() {
  return `${publicAppUrl()}/check-in`;
}
