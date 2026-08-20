// Chrome DevTools Protocol access to the user's own tabs.
//
// Reading a page needs nothing but chrome.scripting, so we attach the debugger
// lazily: only real input, arbitrary JavaScript, and background-tab
// screenshots need it. Every attach paints a banner across the user's tab, so
// a tab stays attached only while commands keep arriving. The banner clears
// itself a few seconds after the last detach.
const IDLE_DETACH_MS = 30_000;

/** tabId -> idle timer */
const attached = new Map();

function touch(tabId) {
  clearTimeout(attached.get(tabId));
  attached.set(
    tabId,
    setTimeout(() => void detach(tabId), IDLE_DETACH_MS),
  );
}

export async function attach(tabId) {
  if (!attached.has(tabId)) await chrome.debugger.attach({ tabId }, "1.3");
  touch(tabId);
}

export async function send(tabId, method, params = {}) {
  await attach(tabId);
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

export async function detach(tabId) {
  const timer = attached.get(tabId);
  if (timer === undefined) return;
  clearTimeout(timer);
  attached.delete(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // The tab or its debug session is already gone.
  }
}

export async function detachAll() {
  await Promise.all([...attached.keys()].map((tabId) => detach(tabId)));
}

export function attachedTabs() {
  return [...attached.keys()];
}

// The user can end a debug session from the banner, and closing a tab ends it
// implicitly. Both leave our map stale unless we follow Chrome's events.
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === undefined) return;
  clearTimeout(attached.get(source.tabId));
  attached.delete(source.tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTimeout(attached.get(tabId));
  attached.delete(tabId);
});
