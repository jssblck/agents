// Every command an agent can run against this browser.
//
// Page and input commands act on the calling session's leased tab, so an
// agent can only touch the tab it opened or was handed. Reads go through
// chrome.scripting, which needs no debugger banner. Input, arbitrary
// JavaScript, and screenshots of background tabs go through CDP.
import * as cdp from "./cdp.js";
import { cancelPickSession, runPickSession } from "./pick.js";
import * as sessions from "./sessions.js";

const LOAD_TIMEOUT_MS = 30_000;
const WAIT_POLL_MS = 200;

const KEYS = {
  Enter: { keyCode: 13, code: "Enter", text: "\r" },
  Tab: { keyCode: 9, code: "Tab" },
  Escape: { keyCode: 27, code: "Escape" },
  Backspace: { keyCode: 8, code: "Backspace" },
  Delete: { keyCode: 46, code: "Delete" },
  ArrowUp: { keyCode: 38, code: "ArrowUp" },
  ArrowDown: { keyCode: 40, code: "ArrowDown" },
  ArrowLeft: { keyCode: 37, code: "ArrowLeft" },
  ArrowRight: { keyCode: 39, code: "ArrowRight" },
  PageUp: { keyCode: 33, code: "PageUp" },
  PageDown: { keyCode: 34, code: "PageDown" },
  Home: { keyCode: 36, code: "Home" },
  End: { keyCode: 35, code: "End" },
};

const summarize = (tab, session = null) => ({
  tabId: tab.id,
  windowId: tab.windowId,
  url: tab.url ?? "",
  title: tab.title ?? "",
  active: tab.active === true,
  loading: tab.status === "loading",
  session,
});

async function requireTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab) throw new Error(`No such tab: ${tabId}`);
  return tab;
}

/** The tab this session leases, checked against the live browser. */
async function sessionTab(session) {
  const lease = await sessions.leaseFor(session);
  if (!lease) {
    throw new Error(
      "This session has no browser tab. Open one with the open tool, or claim an existing tab with the attach tool.",
    );
  }
  const tab = await chrome.tabs.get(lease.tabId).catch(() => undefined);
  if (!tab) {
    await sessions.forgetTab(lease.tabId);
    throw new Error(
      "This session's tab is gone. Open a new one with the open tool, or claim an existing tab with the attach tool.",
    );
  }
  return tab.id;
}

async function runInPage(tabId, func, args = [], world = "ISOLATED") {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world,
    func,
    args,
  });
  if (!injection) throw new Error("Script did not run in the page");
  return injection.result;
}

/** Resolves when the tab finishes loading, or immediately if it already has. */
function waitForLoad(tabId, timeoutMs = LOAD_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === "complete") finish();
    });
  });
}

/** Scrolls the element into view and returns its center in CSS pixels. */
function locate(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;
  element.scrollIntoView({ block: "center", inline: "center" });
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function clickAt(tabId, x, y) {
  const point = { x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 };
  await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "none" });
  await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", ...point });
  await cdp.send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", ...point });
}

async function pressKey(tabId, key) {
  const descriptor = KEYS[key];
  if (!descriptor) throw new Error(`Unsupported key: ${key}. Known keys: ${Object.keys(KEYS).join(", ")}`);
  const base = {
    key,
    code: descriptor.code,
    windowsVirtualKeyCode: descriptor.keyCode,
    nativeVirtualKeyCode: descriptor.keyCode,
  };
  await cdp.send(tabId, "Input.dispatchKeyEvent", {
    type: descriptor.text ? "keyDown" : "rawKeyDown",
    ...base,
    ...(descriptor.text ? { text: descriptor.text } : {}),
  });
  await cdp.send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

const commands = {
  async info() {
    const platform = await chrome.runtime.getPlatformInfo();
    return {
      extensionVersion: chrome.runtime.getManifest().version,
      os: platform.os,
      attachedTabs: cdp.attachedTabs(),
    };
  },

  async "tabs.list"() {
    const [tabs, owners] = await Promise.all([chrome.tabs.query({}), sessions.owners()]);
    return { tabs: tabs.map((tab) => summarize(tab, owners.get(tab.id) ?? null)) };
  },

  async "session.status"({ session }) {
    const lease = await sessions.leaseFor(session);
    if (!lease) return { tab: null };
    const tab = await chrome.tabs.get(lease.tabId).catch(() => undefined);
    if (!tab) {
      await sessions.forgetTab(lease.tabId);
      return { tab: null };
    }
    return { tab: summarize(tab, session) };
  },

  /** Navigate the session's tab, or open and claim a new one. */
  async "session.open"({ session, url, active = false, label }) {
    const lease = await sessions.leaseFor(session);
    const existing = lease ? await chrome.tabs.get(lease.tabId).catch(() => undefined) : undefined;
    if (existing) {
      if (label) await sessions.relabel(session, label);
      await chrome.tabs.update(existing.id, { url });
      await waitForLoad(existing.id);
      return summarize(await requireTab(existing.id), session);
    }
    const tab = await chrome.tabs.create({ url, active });
    await sessions.claim(session, tab.id, "agent", label);
    await waitForLoad(tab.id);
    return summarize(await requireTab(tab.id), session);
  },

  async "session.attach"({ session, tabId, label }) {
    await requireTab(tabId);
    await sessions.claim(session, tabId, "user", label);
    return summarize(await requireTab(tabId), session);
  },

  async "session.release"({ session }) {
    const lease = await sessions.release(session);
    return { released: lease?.tabId ?? null };
  },

  async "session.close"({ session }) {
    const lease = await sessions.release(session);
    if (!lease) return { closed: null };
    await chrome.tabs.remove(lease.tabId).catch(() => undefined);
    return { closed: lease.tabId };
  },

  async "session.show"({ session }) {
    const tabId = await sessionTab(session);
    const tab = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return summarize(await requireTab(tabId), session);
  },

  async "session.reload"({ session }) {
    const tabId = await sessionTab(session);
    await chrome.tabs.reload(tabId);
    await waitForLoad(tabId);
    return summarize(await requireTab(tabId), session);
  },

  async "page.text"({ session }) {
    const tabId = await sessionTab(session);
    const text = await runInPage(tabId, () => document.body?.innerText ?? "");
    return { text };
  },

  async "page.html"({ session }) {
    const tabId = await sessionTab(session);
    const html = await runInPage(tabId, () => document.documentElement?.outerHTML ?? "");
    return { html };
  },

  async "page.eval"({ session, expression }) {
    const tabId = await sessionTab(session);
    const response = await cdp.send(tabId, "Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ?? response.exceptionDetails.text,
      );
    }
    return { value: response.result.value ?? response.result.description ?? null };
  },

  async "page.screenshot"({ session, fullPage = false }) {
    const tabId = await sessionTab(session);
    const { data } = await cdp.send(tabId, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: fullPage,
    });
    return { data };
  },

  async "page.pick"({ session }) {
    const tabId = await sessionTab(session);
    let picked;
    try {
      picked = await runInPage(tabId, runPickSession, [], "MAIN");
    } catch (error) {
      throw new Error(
        `Could not start the picker on this page: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!picked) throw new Error("Pick cancelled.");
    const rect = picked.rect ?? {};
    const pad = 8;
    const clip = {
      x: Math.max(0, (Number(rect.x) || 0) - pad),
      y: Math.max(0, (Number(rect.y) || 0) - pad),
      width: Math.max(1, (Number(rect.width) || 1) + pad * 2),
      height: Math.max(1, (Number(rect.height) || 1) + pad * 2),
      scale: 1,
    };
    try {
      const { data } = await cdp.send(tabId, "Page.captureScreenshot", { format: "png", clip });
      return { ...picked, screenshot: data };
    } catch {
      return { ...picked, screenshot: null };
    }
  },

  async "page.pickCancel"({ session }) {
    const tabId = await sessionTab(session);
    await runInPage(tabId, cancelPickSession, [], "MAIN").catch(() => undefined);
    return { cancelled: true };
  },

  async "page.wait"({ session, selector, timeoutMs = 10_000 }) {
    const tabId = await sessionTab(session);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = await runInPage(tabId, (s) => document.querySelector(s) !== null, [selector]);
      if (found) return { found: true };
      await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for ${selector}`);
  },

  async "input.click"({ session, selector, x, y }) {
    const tabId = await sessionTab(session);
    if (selector) {
      const point = await runInPage(tabId, locate, [selector]);
      if (!point) throw new Error(`No visible element matches ${selector}`);
      await clickAt(tabId, point.x, point.y);
      return { clicked: selector };
    }
    if (typeof x !== "number" || typeof y !== "number") {
      throw new Error("Pass a selector, or both x and y");
    }
    await clickAt(tabId, x, y);
    return { clicked: `${x},${y}` };
  },

  async "input.type"({ session, selector, text, submit = false }) {
    const tabId = await sessionTab(session);
    if (selector) {
      const point = await runInPage(tabId, locate, [selector]);
      if (!point) throw new Error(`No visible element matches ${selector}`);
      await clickAt(tabId, point.x, point.y);
    }
    // insertText types into the focused element in one shot, which beats
    // synthesizing a key event per character and is what a paste looks like.
    await cdp.send(tabId, "Input.insertText", { text });
    if (submit) await pressKey(tabId, "Enter");
    return { typed: text.length };
  },

  async "input.press"({ session, key }) {
    const tabId = await sessionTab(session);
    await pressKey(tabId, key);
    return { pressed: key };
  },

  // A CDP wheel event only resolves once the compositor produces a frame, and
  // a background tab never does, so scrolling runs in the page instead.
  async "input.scroll"({ session, deltaY = 600 }) {
    const tabId = await sessionTab(session);
    const scrollY = await runInPage(
      tabId,
      (delta) => {
        window.scrollBy(0, delta);
        return window.scrollY;
      },
      [deltaY],
    );
    return { scrollY };
  },
};

export async function runCommand(method, params) {
  const command = commands[method];
  if (!command) throw new Error(`Unknown command: ${method}`);
  if (method !== "info" && method !== "tabs.list" && typeof params.session !== "string") {
    throw new Error(`${method} needs a session`);
  }
  return (await command(params)) ?? null;
}
