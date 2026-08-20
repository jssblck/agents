// Which agent session drives which tab.
//
// A session is one agent (one MCP process, or an explicit name it passed).
// Each session holds a lease on at most one tab, and a tab belongs to at most
// one session. Leases live in chrome.storage.session so they survive worker
// restarts but not a browser restart, which reissues tab ids anyway.
//
// Tabs an agent opened sit in a colored tab group titled after the session,
// so the user can see who is driving what and drag a tab out to take it back.
// Tabs the user handed over stay where they are.
import * as cdp from "./cdp.js";

const LEASES_KEY = "leases";
const GROUP_PREFIX = "Agent: ";
const GROUP_COLORS = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

/** @typedef {{ tabId: number, origin: "agent" | "user", groupId: number | null, label: string }} Lease */

let queue = Promise.resolve();

/** Serialize read-modify-write so two commands cannot clobber each other. */
function mutate(fn) {
  const run = queue.then(async () => {
    const leases = await readLeases();
    const result = await fn(leases);
    await chrome.storage.session.set({ [LEASES_KEY]: leases });
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** @returns {Promise<Record<string, Lease>>} */
async function readLeases() {
  const stored = await chrome.storage.session.get(LEASES_KEY);
  return stored[LEASES_KEY] ?? {};
}

export async function leaseFor(session) {
  return (await readLeases())[session];
}

/** Session that holds a tab, if any. */
export async function ownerOf(tabId) {
  for (const [session, lease] of Object.entries(await readLeases())) {
    if (lease.tabId === tabId) return session;
  }
  return undefined;
}

export async function owners() {
  const byTab = new Map();
  for (const [session, lease] of Object.entries(await readLeases())) byTab.set(lease.tabId, session);
  return byTab;
}

function colorFor(session) {
  let hash = 0;
  for (const char of session) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

export function labelFor(session, label) {
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed || session;
}

async function groupTab(tabId, session, label) {
  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups.update(groupId, {
    title: `${GROUP_PREFIX}${label}`,
    color: colorFor(session),
  });
  return groupId;
}

async function ungroupTab(tabId) {
  await chrome.tabs.ungroup([tabId]).catch(() => undefined);
}

/** Claim a tab for a session. Throws when another session holds it. */
export function claim(session, tabId, origin, label) {
  return mutate(async (leases) => {
    for (const [other, lease] of Object.entries(leases)) {
      if (lease.tabId === tabId && other !== session) {
        throw new Error(
          `Tab ${tabId} is driven by another agent session (${lease.label}). Open your own tab with the open tool, or attach to a tab nobody holds.`,
        );
      }
    }
    const previous = leases[session];
    if (previous && previous.tabId !== tabId) await dropTab(previous);
    const name = labelFor(session, label);
    const groupId =
      origin === "agent" ? await groupTab(tabId, session, name).catch(() => null) : null;
    leases[session] = { tabId, origin, groupId, label: name };
    return leases[session];
  });
}

/** Rename the group of a session that already holds a tab. */
export function relabel(session, label) {
  return mutate(async (leases) => {
    const lease = leases[session];
    if (!lease) return null;
    lease.label = labelFor(session, label);
    if (lease.groupId !== null) {
      await chrome.tabGroups
        .update(lease.groupId, { title: `${GROUP_PREFIX}${lease.label}` })
        .catch(() => undefined);
    }
    return lease;
  });
}

async function dropTab(lease) {
  await cdp.detach(lease.tabId);
  if (lease.origin === "agent") await ungroupTab(lease.tabId);
}

/** Give a session's tab back to the user: detach, ungroup, forget. */
export function release(session) {
  return mutate(async (leases) => {
    const lease = leases[session];
    if (!lease) return null;
    delete leases[session];
    await dropTab(lease);
    return lease;
  });
}

/** Forget a tab that no longer exists. */
export function forgetTab(tabId) {
  return mutate(async (leases) => {
    for (const [session, lease] of Object.entries(leases)) {
      if (lease.tabId === tabId) delete leases[session];
    }
  });
}

/** On worker start, leftover agent groups from a dead lease table are noise. */
export async function sweepStaleGroups() {
  const live = new Set(Object.values(await readLeases()).map((lease) => lease.groupId));
  const groups = await chrome.tabGroups.query({});
  for (const group of groups) {
    if (!group.title?.startsWith(GROUP_PREFIX) || live.has(group.id)) continue;
    const tabs = await chrome.tabs.query({ groupId: group.id });
    await chrome.tabs.ungroup(tabs.map((tab) => tab.id)).catch(() => undefined);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void forgetTab(tabId);
});
