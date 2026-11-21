/**
 * Same-origin check for state-changing requests. Compares the host of the Origin
 * header (falling back to Referer) against the host of APP_URL. Rejects when
 * neither header is present or when either value cannot be parsed.
 */
export function isSameOriginRequest(headers: Headers, appUrl: string): boolean {
  let expectedHost: string;
  try {
    expectedHost = new URL(appUrl).host;
  } catch {
    return false;
  }

  const candidate = headers.get('origin') ?? headers.get('referer');
  if (!candidate) {
    return false;
  }

  try {
    return new URL(candidate).host === expectedHost;
  } catch {
    return false;
  }
}
