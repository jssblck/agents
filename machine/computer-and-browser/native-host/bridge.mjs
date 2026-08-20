// Chrome's native messaging host: the hub between one extension port and many agents.
//
// Chrome starts this process when the extension connects and kills it when the
// port closes, so exactly one runs per browser profile and its lifetime is the
// extension's lifetime. It listens on a socket named after its own pid, and
// every agent-browser MCP process finds live hosts by listing the directory
// and connecting out, so there is no lock or pointer file to manage.
//
// Framing: Chrome frames are a 4-byte little-endian length then UTF-8 JSON;
// the socket side is newline-delimited JSON. Each client gets a numeric id.
// Requests go to Chrome stamped with that id, the extension echoes it on the
// response, and this process routes the response back. When a client drops,
// the extension hears `client.gone` so it can release that agent's tabs.
import { chmodSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const hostsDir = process.argv[2];
if (!hostsDir) {
  process.stderr.write("agent-browser-host: missing hosts directory argument\n");
  process.exit(2);
}

const SOCKET_PATTERN = /^host-(\d+)\.sock$/;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

mkdirSync(hostsDir, { recursive: true, mode: 0o700 });
chmodSync(hostsDir, 0o700);
// A host that crashed or was killed leaves its socket file behind.
for (const entry of readdirSync(hostsDir)) {
  const match = SOCKET_PATTERN.exec(entry);
  if (match && !alive(Number(match[1]))) rmSync(join(hostsDir, entry), { force: true });
}

const socketPath = join(hostsDir, `host-${process.pid}.sock`);

// ---- Chrome side ----------------------------------------------------------

function toChrome(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

let inbox = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  inbox = Buffer.concat([inbox, chunk]);
  while (inbox.length >= 4) {
    const length = inbox.readUInt32LE(0);
    if (inbox.length < 4 + length) return;
    const body = inbox.subarray(4, 4 + length);
    inbox = inbox.subarray(4 + length);
    let message;
    try {
      message = JSON.parse(body.toString("utf8"));
    } catch {
      continue;
    }
    fromChrome(message);
  }
});
process.stdin.on("end", shutdown);
process.stdin.on("error", shutdown);

// ---- Client side ----------------------------------------------------------

const clients = new Map();
let nextClient = 1;
/** The extension's greeting, replayed to every client that connects later. */
let hello = null;

function toClient(socket, message) {
  socket.write(`${JSON.stringify(message)}\n`);
}

function fromChrome(message) {
  if (message?.type === "hello") {
    hello = message;
    for (const socket of clients.values()) toClient(socket, message);
    return;
  }
  const socket = clients.get(Number(message?.client));
  if (socket) toClient(socket, message);
}

const server = createServer((socket) => {
  const client = nextClient++;
  clients.set(client, socket);
  if (hello) toClient(socket, hello);

  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message?.type !== "request") continue;
      toChrome({ ...message, client });
    }
  });

  const drop = () => {
    if (!clients.delete(client)) return;
    toChrome({ type: "client.gone", client });
  };
  socket.on("close", drop);
  socket.on("error", drop);
});

server.on("error", (error) => {
  process.stderr.write(`agent-browser-host: ${error.message}\n`);
  process.exit(1);
});
server.listen(socketPath, () => {
  chmodSync(socketPath, 0o600);
});

function shutdown() {
  for (const socket of clients.values()) socket.destroy();
  clients.clear();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
