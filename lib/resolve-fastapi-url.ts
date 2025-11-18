const DEFAULT_LOCAL_FASTAPI_URL = "http://localhost:8000";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const sanitizeBaseUrl = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, "");
};

export const resolveFastApiBaseUrl = (): string => {
  const explicitUrl = sanitizeBaseUrl(process.env["NEXT_PUBLIC_FASTAPI_URL"]);
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    const { protocol, host, hostname } = window.location;
    if (LOOPBACK_HOSTNAMES.has(hostname.toLowerCase())) {
      return DEFAULT_LOCAL_FASTAPI_URL;
    }
    return `${protocol}//${host}`;
  }

  return DEFAULT_LOCAL_FASTAPI_URL;
};
