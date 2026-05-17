import { useEffect, useMemo, useRef, useState } from "react";

// Minimal per-relay live stats: connection state, event count for a given
// filter, and a one-shot NIP-11 info doc. Opens its own passive WebSocket per
// URL so the badge doesn't depend on (or interfere with) the data-fetch pool
// — same pattern as blst.upleb.uk's GraspBadge probe.

export type RelayStatus = "idle" | "connecting" | "live" | "eose" | "error";

export type RelayInfo = {
  name?: string;
  software?: string;
  version?: string;
  supported_nips?: number[];
};

export type RelayStat = {
  status: RelayStatus;
  eventCount: number;
  info?: RelayInfo;
};

type Filter = Record<string, unknown>;

export function useRelayStats(
  urls: readonly string[],
  filter: Filter,
): Map<string, RelayStat> {
  const [stats, setStats] = useState<Map<string, RelayStat>>(() => new Map());
  const filterKey = useMemo(() => JSON.stringify(filter), [filter]);
  const urlsKey = useMemo(() => urls.join("|"), [urls]);
  const statsRef = useRef<Map<string, RelayStat>>(new Map());

  useEffect(() => {
    const next = new Map<string, RelayStat>();
    for (const u of urls) next.set(u, { status: "idle", eventCount: 0 });
    statsRef.current = next;
    setStats(new Map(next));

    const sockets: WebSocket[] = [];
    const abort = new AbortController();
    const parsedFilter = JSON.parse(filterKey) as Filter;

    const patch = (url: string, p: Partial<RelayStat>) => {
      const cur = statsRef.current.get(url) ?? {
        status: "idle" as RelayStatus,
        eventCount: 0,
      };
      const merged = { ...cur, ...p };
      statsRef.current.set(url, merged);
      setStats(new Map(statsRef.current));
    };

    for (const url of urls) {
      // NIP-11 info doc (HTTP). Fire-and-forget; failures are non-fatal.
      const httpUrl = url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
      fetch(httpUrl, {
        headers: { Accept: "application/nostr+json" },
        signal: abort.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: RelayInfo | null) => {
          if (!j) return;
          patch(url, { info: j });
        })
        .catch(() => {});

      // Passive subscription. Counts events but doesn't process them.
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        patch(url, { status: "error" });
        continue;
      }
      sockets.push(ws);
      patch(url, { status: "connecting" });

      const subId = `stats-${Math.random().toString(36).slice(2, 10)}`;

      ws.onopen = () => {
        patch(url, { status: "live" });
        try {
          ws.send(JSON.stringify(["REQ", subId, parsedFilter]));
        } catch {
          patch(url, { status: "error" });
        }
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (!Array.isArray(msg)) return;
          if (msg[0] === "EVENT" && msg[1] === subId) {
            const cur = statsRef.current.get(url);
            if (cur) patch(url, { eventCount: cur.eventCount + 1 });
          } else if (msg[0] === "EOSE" && msg[1] === subId) {
            patch(url, { status: "eose" });
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => patch(url, { status: "error" });
      ws.onclose = () => {
        // GRASP relays (and other short-lived setups) hang up after EOSE.
        // The relay still responded successfully, so don't downgrade past
        // "eose". Only revert to "idle" if we never even opened the socket.
        const cur = statsRef.current.get(url);
        if (!cur || cur.status === "error") return;
        if (cur.status === "live" || cur.status === "eose") {
          patch(url, { status: "eose" });
        } else {
          patch(url, { status: "idle" });
        }
      };
    }

    return () => {
      abort.abort();
      for (const ws of sockets) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [urlsKey, filterKey]);

  return stats;
}
