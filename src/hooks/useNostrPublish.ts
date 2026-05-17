// Minimal raw-WebSocket publish — one-shot kind:1 (or any kind) push to a
// list of relays. Avoids pulling in nostr-tools just for SimplePool.publish.

export type PublishResult = {
  url: string;
  ok: boolean;
  reason?: string;
};

export type SignedEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig: string;
};

export async function publishToRelay(
  url: string,
  signed: SignedEvent,
  timeoutMs = 5000,
): Promise<PublishResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: PublishResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(r);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve({ url, ok: false, reason: 'ws construct failed' });
      return;
    }
    const timer = setTimeout(() => done({ url, ok: false, reason: 'timeout' }), timeoutMs);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(['EVENT', signed]));
      } catch {
        done({ url, ok: false, reason: 'send failed' });
      }
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!Array.isArray(msg)) return;
        // ["OK", <event-id>, <bool>, <reason>]
        if (msg[0] === 'OK' && msg[1] === signed.id) {
          done({ url, ok: !!msg[2], reason: typeof msg[3] === 'string' ? msg[3] : undefined });
        }
        // ["NOTICE", <reason>] — surface as soft failure if no OK comes
        if (msg[0] === 'NOTICE' && typeof msg[1] === 'string') {
          done({ url, ok: false, reason: `notice: ${msg[1]}` });
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => done({ url, ok: false, reason: 'ws error' });
    ws.onclose = () => done({ url, ok: false, reason: 'closed before OK' });
  });
}

export async function publishToAll(
  urls: readonly string[],
  signed: SignedEvent,
  timeoutMs = 5000,
): Promise<PublishResult[]> {
  return Promise.all(urls.map((u) => publishToRelay(u, signed, timeoutMs)));
}
