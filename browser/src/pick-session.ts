import {
  formatPickLabel,
  newPickId,
  parsePickedElement,
  PICK_TIMEOUT_MS,
  type PickedElement,
} from "./pick.ts";
import type { PickStore } from "./picks.ts";
import type { TabRegistry, TabSummary } from "./tabs.ts";

export interface PickSessionDeps {
  tabs: TabRegistry;
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

async function resolvePickTab(tabs: TabRegistry, sessionKey: string) {
  const bound = await tabs.resolve(sessionKey);
  if (bound) return bound;

  const connection = tabs.connection();
  const { tabs: open } = await connection.request<{ tabs: TabSummary[] }>("tabs.list");
  const active = open.find((tab) => tab.active) ?? open[0];
  if (!active) {
    throw new Error(
      "No tab to pick from. Open a URL with the open tool, or focus a tab in Chrome.",
    );
  }
  await tabs.attach(sessionKey, active.tabId);
  return { connection, tabId: active.tabId };
}

/** Bring the tab forward and wait for the user to click an element. */
export async function pickFromSession(
  deps: PickSessionDeps,
  sessionKey: string,
  timeoutMs = PICK_TIMEOUT_MS,
): Promise<CompletedPick> {
  const { connection, tabId } = await resolvePickTab(deps.tabs, sessionKey);
  await connection.request("tabs.select", { tabId });
  const raw = await connection.request<ExtensionPickResult>(
    "page.pick",
    { tabId },
    timeoutMs + 5_000,
  );
  const pick = parsePickedElement(raw, {
    id: newPickId(),
    sessionKey,
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
  sessionKey: string,
): Promise<void> {
  const resolved = await deps.tabs.resolve(sessionKey);
  if (!resolved) return;
  await resolved.connection
    .request("page.pickCancel", { tabId: resolved.tabId })
    .catch(() => undefined);
}
