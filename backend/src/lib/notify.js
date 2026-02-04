// backend/src/lib/notify.js
export async function notify(event, payload) {
  // TODO: remplacer par une queue (BullMQ) ou adaptateurs (email, slack, webhook)
  console.log(`[NOTIFY] ${event}`, payload?.id ?? "");
}
