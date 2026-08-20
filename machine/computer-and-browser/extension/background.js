// The extension side of the Agent Browser bridge.
//
// One native messaging port carries every command from every agent and every
// result back. The native host stamps each request with a client id and tells
// us when that client goes away, so an agent that exits (or crashes) has its
// tab released and its debugger detached without asking. Chrome owns the
// port's lifetime: it starts the host on connect and kills it when this
// worker dies, and an open native port keeps the worker alive.
import { runCommand } from "./commands.js";
import { detachAll } from "./cdp.js";
import { release, sweepStaleGroups } from "./sessions.js";

const HOST_NAME = "com.jssblck.agent_browser";
// The only wake-up Chrome guarantees, used to retry the connection if the
// host ever fails to start.
const RECONNECT_MINUTES = 0.5;

let port = null;
/** client id -> sessions it has spoken for, so a dropped client can be cleaned up. */
const clientSessions = new Map();

function connect() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST_NAME);
  } catch (error) {
    console.warn("[agent-browser] connectNative failed", error);
    port = null;
    return;
  }

  port.onMessage.addListener((message) => {
    void handle(message);
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError;
    console.warn("[agent-browser] native host disconnected", error?.message ?? "");
    port = null;
    clientSessions.clear();
    // Debug sessions belong to a connection. Leaving them attached would
    // strand a "being debugged" banner on the user's tabs.
    void detachAll();
  });

  send({ type: "hello", version: chrome.runtime.getManifest().version });
}

function send(message) {
  if (!port) return;
  try {
    port.postMessage(message);
  } catch (error) {
    console.warn("[agent-browser] postMessage failed", error);
    port = null;
  }
}

async function handle(message) {
  if (message?.type === "client.gone") {
    const sessions = clientSessions.get(message.client);
    clientSessions.delete(message.client);
    for (const session of sessions ?? []) await release(session).catch(() => undefined);
    return;
  }
  if (message?.type !== "request") return;

  const { id, client, method, params = {} } = message;
  if (typeof params.session === "string") {
    let sessions = clientSessions.get(client);
    if (!sessions) clientSessions.set(client, (sessions = new Set()));
    sessions.add(params.session);
  }
  try {
    const result = await runCommand(method, params);
    send({ type: "response", id, client, ok: true, result });
  } catch (error) {
    send({
      type: "response",
      id,
      client,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

chrome.alarms.create("agent-browser-reconnect", { periodInMinutes: RECONNECT_MINUTES });
chrome.alarms.onAlarm.addListener(() => connect());
chrome.runtime.onStartup.addListener(() => connect());
chrome.runtime.onInstalled.addListener(() => connect());

void sweepStaleGroups().catch(() => undefined);
connect();
