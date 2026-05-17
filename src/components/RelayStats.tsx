import { useRelayStats, type RelayStatus } from "@/hooks/useRelayStats";

// One-row strip of relay status pills. Mirrors the visual language used by
// blst's GraspBadge + pls's RelayBadge: status dot, mono domain, READ/WRITE
// role tags, event count, optional GRASP marker.

type Props = {
  urls: readonly string[];
  filter: Record<string, unknown>;
  // Whether this site reads events from these relays (controls READ tag +
  // event count). Default true.
  readable?: boolean;
  // Whether the user can publish from this site (controls the WRITE tag).
  // Default true.
  writable?: boolean;
  className?: string;
};

function statusColor(s: RelayStatus): string {
  switch (s) {
    case "live":
      return "bg-emerald-400";
    case "eose":
      return "bg-emerald-400/50";
    case "connecting":
      return "bg-yellow-400 animate-pulse";
    case "error":
      return "bg-red-400";
    default:
      return "bg-muted-foreground/20";
  }
}

function statusLabel(s: RelayStatus): string {
  switch (s) {
    case "live":
      return "live";
    case "eose":
      return "ready";
    case "connecting":
      return "connecting…";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export default function RelayStats({
  urls,
  filter,
  readable = true,
  writable = true,
  className = "",
}: Props) {
  const stats = useRelayStats(urls, filter);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {urls.map((url) => {
        const s = stats.get(url);
        const status = s?.status ?? "idle";
        const count = s?.eventCount ?? 0;
        const info = s?.info;
        const domain = url.replace(/^wss?:\/\//, "").split("/")[0];
        const grasp = info?.supported_nips?.includes(34);
        return (
          <div
            key={url}
            title={`${url} — ${statusLabel(status)}${info?.software ? ` · ${info.software.split("/").pop()}${info.version ? ` v${info.version}` : ""}` : ""}`}
            className="flex items-center gap-1.5 px-2 py-0.5 border border-border/60 rounded bg-card/40"
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${statusColor(status)}`}
              aria-label={statusLabel(status)}
            />
            <span className="font-mono text-[10px] text-foreground/85">{domain}</span>
            {readable && (
              <span className="font-mono text-[9px] px-1 border border-primary/50 text-primary/80">
                READ
              </span>
            )}
            {writable && (
              <span className="font-mono text-[9px] px-1 border border-accent/50 text-accent/80">
                WRITE
              </span>
            )}
            {grasp && (
              <span
                title="GRASP — relay accepts NIP-34 git events"
                className="font-mono text-[9px] px-1 border border-accent text-accent tracking-widest font-bold"
              >
                GRASP
              </span>
            )}
            {readable && (
              <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                {count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
