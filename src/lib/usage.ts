const SESSION_STORAGE_KEY = "confera.usage.session_id";
const PAGE_VIEW_STORAGE_KEY = "confera.usage.page_view_sent";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = `session_${Date.now()}_${randomId()}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export function makeClientEventId(prefix: string, sessionId: string) {
  return `${prefix}:${sessionId}:${Date.now()}:${randomId()}`;
}

export function shouldTrackPageView(pathname: string) {
  const existing = window.sessionStorage.getItem(PAGE_VIEW_STORAGE_KEY);
  if (existing === pathname) {
    return false;
  }

  window.sessionStorage.setItem(PAGE_VIEW_STORAGE_KEY, pathname);
  return true;
}

export function getBrowserContext() {
  return {
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent || undefined,
  };
}
