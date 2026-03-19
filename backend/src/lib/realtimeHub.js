const HEARTBEAT_MS = 25000;

const userStreams = new Map();
let streamCounter = 0;

function buildUserKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

function writeEvent(res, { event = "message", data = {}, id = null } = {}) {
  if (id) res.write(`id: ${id}\n`);
  if (event) res.write(`event: ${event}\n`);

  const payload = JSON.stringify(data ?? {});
  for (const line of payload.split("\n")) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

function removeClient(userKey, client) {
  const clients = userStreams.get(userKey);
  if (!clients) return;
  clients.delete(client);
  clearInterval(client.heartbeat);
  if (!clients.size) {
    userStreams.delete(userKey);
  }
}

export function subscribeUserStream({ tenantId, userId, res }) {
  const userKey = buildUserKey(tenantId, userId);
  const client = {
    id: `${Date.now()}-${++streamCounter}`,
    res,
    heartbeat: null,
  };

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write("retry: 10000\n\n");

  const clients = userStreams.get(userKey) || new Set();
  clients.add(client);
  userStreams.set(userKey, clients);

  client.heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      removeClient(userKey, client);
      return;
    }
    writeEvent(res, {
      event: "ping",
      data: { serverTime: new Date().toISOString() },
    });
  }, HEARTBEAT_MS);

  writeEvent(res, {
    event: "ready",
    data: {
      streamId: client.id,
      serverTime: new Date().toISOString(),
    },
  });

  return () => removeClient(userKey, client);
}

export function publishUserEvent({ tenantId, userId, event, data = {} }) {
  if (!tenantId || !userId) return 0;
  const clients = userStreams.get(buildUserKey(tenantId, userId));
  if (!clients?.size) return 0;

  let sent = 0;
  for (const client of [...clients]) {
    if (client.res.writableEnded || client.res.destroyed) {
      removeClient(buildUserKey(tenantId, userId), client);
      continue;
    }
    try {
      writeEvent(client.res, {
        id: `${Date.now()}-${++streamCounter}`,
        event,
        data,
      });
      sent += 1;
    } catch (_error) {
      removeClient(buildUserKey(tenantId, userId), client);
    }
  }
  return sent;
}
