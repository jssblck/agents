import type { HostPool } from "./hosts.ts";
import type { TabSummary } from "./mcp-tools.ts";
import {
  formatPickLabel,
  newPickId,
  parsePickedElement,
  PICK_TIMEOUT_MS,
  type PickedElement,
} from "./pick.ts";
import type { PickStore } from "./picks.ts";

export interface PickSessionDeps {
  hosts: HostPool;
  picks: PickStore;
}

interface ExtensionPickResult {
  pageUrl?: unknown;
  pageTitle?: unknown;
  tagName?: unknown;
  selector?: unknown;
  text?: unknown;
  htmlPreview?: unknown;
  styles?: unknown;
  componentName?: unknown;
  source?: unknown;
  rect?: unknown;
  screenshot?: unknown;
}

export interface CompletedPick {
  pick: PickedElement;
  label: string;
  screenshotDataUrl: string | null;
}

/** Pick from the session's tab; with none, claim the tab the user is looking at. */
async function ensurePickTab(hosts: HostPool, session: string) {
  const connection = await hosts.primary();
  const { tab } = await connection.request<{ tab: TabSummary | null }>("session.status", { session });
  if (tab) return connection;

  const { tabs } = await connection.request<{ tabs: TabSummary[] }>("tabs.list");
  const free = tabs.filter((candidate) => candidate.session === null);
  const target = free.find((candidate) => candidate.active) ?? free[0];
  if (!target) {
    throw new Error(
      "No tab to pick from. Open a URL with the open tool, or focus a tab in Chrome.",
    );
  }
  await connection.request("session.attach", { session, tabId: target.tabId });
  return connection;
}

/** Bring the tab forward and wait for the user to click an element. */
export async function pickFromSession(
  deps: PickSessionDeps,
  session: string,
  timeoutMs = PICK_TIMEOUT_MS,
): Promise<CompletedPick> {
  const connection = await ensurePickTab(deps.hosts, session);
  await connection.request("session.show", { session });
  const raw = await connection.request<ExtensionPickResult>(
    "page.pick",
    { session },
    timeoutMs + 5_000,
  );
  const pick = parsePickedElement(raw, {
    id: newPickId(),
    sessionKey: session,
    createdAt: new Date().toISOString(),
  });
  if (!pick) throw new Error("The page did not return a usable element.");
  await deps.picks.save(pick);
  const screenshot =
    typeof raw.screenshot === "string" && raw.screenshot.length > 0
      ? `data:image/png;base64,${raw.screenshot}`
      : null;
  return { pick, label: formatPickLabel(pick), screenshotDataUrl: screenshot };
}

export async function cancelPickInSession(
  deps: PickSessionDeps,
  session: string,
): Promise<void> {
  const connection = await deps.hosts.primary().catch(() => undefined);
  await connection?.request("page.pickCancel", { session }).catch(() => undefined);
}
