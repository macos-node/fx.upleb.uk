
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RelayStats from '@/components/RelayStats';
import { publishToAll, type SignedEvent } from '@/hooks/useNostrPublish';
import { toBlob } from 'html-to-image';
import axios from 'axios';

// nostr.build's NIP-98-authed upload endpoint. Anonymous uploads are no
// longer accepted — the signed kind:27235 event in Authorization: Nostr
// proves the uploader is a real Nostr identity.
const NB_UPLOAD_URL = 'https://nostr.build/api/v2/nip96/upload';

// Site-wide reference relays. fx is a client-only Bitcoin converter — these
// are shown purely for cross-suite status visibility, not for reads/writes.
const REFERENCE_RELAYS = ['wss://relay.fizx.uk', 'wss://git.upleb.uk'] as const;

// Broad-reach kind:1 publish targets for the "Share to Nostr" button. fizx
// is the upleb-suite primary; nos.lol + primal + damus give general reach.
// git.upleb.uk is excluded because it's GRASP-only (kind 30617/1617/etc.).
const SHARE_RELAYS = [
  'wss://relay.fizx.uk',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
] as const;

// ── Animated title ──────────────────────────────────────────────
const TITLE_ANIM_CSS = `@keyframes titleLetterIn{from{transform:translateX(-80px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes titleSuffixIn{from{opacity:0}to{opacity:1}}`;
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function AnimatedTitle({ accent, rest = '', from: f, to: t, suffixRgba, fontSize = 'clamp(36px, 7.5vw, 51px)' }: { accent: string; rest?: string; from: string; to: string; suffixRgba: string; fontSize?: string }) {
  const ac = accent.split(''), rc = rest.split('');
  const total = ac.length + rc.length;
  const dur = 350, stagger = total > 1 ? (1200 - dur) / (total - 1) : 0;
  const fromRgb = hexToRgb(f);
  const toRgb = hexToRgb(t);
  const aLen = ac.length;
  return (
    <>
      <style>{TITLE_ANIM_CSS}</style>
      <h1 className="font-bold tracking-tight" style={{ fontSize }}>
        {ac.map((ch, i) => {
          const start = lerpRgb(fromRgb, toRgb, aLen > 0 ? i / aLen : 0);
          const end   = lerpRgb(fromRgb, toRgb, aLen > 0 ? (i + 1) / aLen : 1);
          return (
            <span key={i} className="inline-block"
              style={{ background: `linear-gradient(to right,${start},${end})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: `titleLetterIn ${dur}ms cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${Math.round(i * stagger)}ms` }}
            >{ch === ' ' ? ' ' : ch}</span>
          );
        })}
        {rc.map((ch, i) => (
          <span key={i + ac.length} className="inline-block"
            style={{ color: suffixRgba, animation: `titleSuffixIn 600ms cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${Math.round((ac.length + i) * stagger)}ms` }}
          >{ch === ' ' ? ' ' : ch}</span>
        ))}
      </h1>
    </>
  );
}

const NstartHand = () => (
  <a href="https://nstart.me/en" target="_blank" rel="noopener noreferrer" className="hover:opacity-75 transition-opacity shrink-0">
    <svg className="h-8 w-auto" fill="#fbbf24" viewBox="0 0 210 282">
      <path fillRule="evenodd" clipRule="evenodd" d="M57.143 98.9848C58.6367 95.1177 62.1322 93.1733 65.8719 92.1713C74.9767 89.7317 81.3757 95.1838 85.1202 100.138C87.0353 102.672 88.5381 105.402 89.6797 107.666C90.3271 108.95 90.784 109.916 91.1512 110.693C91.5296 111.493 91.8127 112.092 92.1107 112.628L92.3791 113.112L92.5365 113.642C92.9678 115.095 93.7096 117.176 94.4929 118.735C94.6234 118.994 94.7454 119.22 94.8568 119.411C96.2962 119.978 97.4576 121.196 97.8887 122.805C98.6106 125.499 97.0117 128.268 94.3176 128.99C90.8191 129.928 88.423 127.512 87.7439 126.76C86.7757 125.688 86.0213 124.371 85.4685 123.271C84.4243 121.194 83.5514 118.773 83.0054 117.015C82.6598 116.345 82.2327 115.455 81.797 114.546C81.4081 113.735 81.0122 112.91 80.6612 112.214C79.6317 110.173 78.4453 108.058 77.0622 106.228C74.2102 102.455 71.5767 101.099 68.4861 101.928C67.2891 102.248 66.763 102.551 66.5602 102.706C66.5455 102.953 66.5618 103.751 67.1654 105.569C67.7276 107.262 68.5363 109.136 69.5419 111.467C69.899 112.294 70.281 113.18 70.6855 114.135C72.1619 117.62 73.7875 121.713 75.0216 126.318C75.7971 129.213 76.5206 132.737 77.2684 136.379C77.6581 138.278 78.0544 140.208 78.468 142.098C79.7244 147.838 81.2286 153.692 83.4154 159.022C87.7563 169.603 94.3593 177.289 106.433 178.342L106.529 178.351L106.625 178.363C109.419 178.714 112.697 177.918 115.701 177.112C118.395 176.391 121.165 177.989 121.887 180.684C122.608 183.378 121.01 186.147 118.316 186.869L118.166 186.909C115.421 187.645 110.401 188.991 105.464 188.396C88.154 186.849 79.1418 175.217 74.0708 162.856C71.5471 156.704 69.8952 150.17 68.6012 144.257C68.1109 142.017 67.6816 139.921 67.2802 137.961C66.5822 134.553 65.9686 131.557 65.2653 128.932C64.212 125.001 62.7989 121.412 61.3851 118.074C61.0692 117.329 60.7434 116.574 60.4177 115.82C59.3548 113.359 58.2928 110.9 57.5795 108.751C56.6874 106.064 55.8077 102.442 57.143 98.9848ZM66.4502 102.814C66.4467 102.813 66.46 102.792 66.5009 102.755C66.4742 102.797 66.4537 102.815 66.4502 102.814Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M110.765 100.588C105.447 106.291 101.312 115.759 99.3897 122.479C98.6226 125.16 95.8269 126.712 93.1453 125.945C90.4637 125.178 88.9117 122.383 89.6788 119.701C91.8059 112.265 96.5106 101.065 103.377 93.7002C106.832 89.9939 111.303 86.7601 116.731 86.0659C122.387 85.3426 127.938 87.5088 133.082 92.3049L133.115 92.3362L133.148 92.3681C137.351 96.4319 138.339 102.566 138.148 108.032C137.949 113.717 136.446 119.945 134.287 125.595C132.132 131.235 129.187 136.66 125.845 140.636C124.178 142.619 122.255 144.43 120.101 145.672C117.93 146.924 115.206 147.765 112.252 147.16C109.337 146.564 106.744 145.387 104.783 143.392C102.786 141.361 101.852 138.897 101.552 136.487C101 132.048 102.548 127.175 103.955 123.382C106.452 116.654 109.786 109.569 110.805 107.805C112.2 105.389 115.288 104.562 117.704 105.956C120.119 107.351 120.947 110.439 119.552 112.855C118.921 113.948 115.814 120.46 113.425 126.896C111.989 130.765 111.361 133.516 111.576 135.241C111.659 135.914 111.844 136.167 111.986 136.311C112.162 136.491 112.72 136.941 114.239 137.257C114.319 137.249 114.575 137.199 115.057 136.921C115.849 136.465 116.9 135.58 118.113 134.136C120.532 131.258 122.973 126.908 124.852 121.99C126.726 117.084 127.904 111.973 128.054 107.679C128.21 103.204 127.233 100.723 126.154 99.6553C122.606 96.3623 119.932 95.8391 118.012 96.0847C115.858 96.3602 113.401 97.7603 110.765 100.588Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M148.576 99.5765C147.378 97.8131 145.202 95.6384 142.159 94.4817C138.745 93.1841 134.64 93.342 130.601 96.0088C128.274 97.5456 127.633 100.678 129.17 103.006C130.706 105.333 133.839 105.975 136.167 104.438C136.898 103.955 137.405 103.832 137.696 103.801C137.992 103.769 138.272 103.81 138.57 103.923C139.285 104.195 139.945 104.834 140.233 105.27L140.315 105.394L140.404 105.513C141.425 106.878 142.178 109.533 142.032 113.653C141.891 117.623 140.936 122.239 139.41 126.752C137.884 131.261 135.869 135.427 133.77 138.525C132.722 140.073 131.721 141.252 130.838 142.06C129.92 142.9 129.36 143.128 129.206 143.17C128.698 143.306 128.451 143.278 128.388 143.266C128.367 143.248 128.329 143.21 128.274 143.135C127.88 142.603 127.203 140.925 127.411 137.461C127.578 134.677 125.456 132.285 122.672 132.118C119.888 131.951 117.495 134.072 117.329 136.857C117.058 141.364 117.724 145.861 120.157 149.146C121.436 150.873 123.188 152.225 125.367 152.905C127.514 153.575 129.73 153.486 131.82 152.926C134.105 152.314 136.064 150.968 137.656 149.512C139.282 148.024 140.782 146.184 142.133 144.189C144.835 140.2 147.221 135.181 148.977 129.989C150.733 124.799 151.942 119.195 152.126 114.011C152.302 109.023 151.557 103.642 148.576 99.5765Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M186.841 91.1686C185.772 91.5973 185.168 92.2069 184.973 92.544C183.264 95.5056 179.325 100.324 175.48 104.794C171.507 109.414 167.22 114.13 164.478 117.072C162.576 119.112 159.38 119.224 157.34 117.322C155.3 115.42 155.188 112.224 157.09 110.184C159.763 107.317 163.956 102.703 167.822 98.2078C171.818 93.5623 175.079 89.4804 176.226 87.4938C177.817 84.7382 180.464 82.8432 183.083 81.7933C185.71 80.7403 188.941 80.2834 192.028 81.1664C195.357 82.1186 198.189 84.5703 199.383 88.482C200.486 92.0952 200.034 96.4116 198.408 101.218C192.231 119.477 179.621 133.86 174.895 138.051C173.698 139.112 172.27 141.273 170.323 145.956C168.418 150.541 166.292 156.814 163.351 165.509C160.041 175.292 152.771 183.982 144.169 188.607C135.418 193.311 124.606 194.032 115.772 186.268C113.677 184.427 113.471 181.236 115.312 179.141C117.153 177.046 120.344 176.84 122.439 178.681C127.282 182.937 133.283 182.991 139.386 179.71C145.636 176.35 151.258 169.738 153.783 162.273L153.849 162.079C156.711 153.619 158.943 147.019 160.996 142.08C163.023 137.203 165.165 133.179 168.193 130.494C171.917 127.192 183.347 114.22 188.84 97.9817C190.131 94.1642 189.957 92.1976 189.722 91.4309C189.582 90.972 189.465 90.9385 189.263 90.8808L189.25 90.8772C188.798 90.7479 187.902 90.7432 186.841 91.1686Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M87.4391 172.66C90.1332 171.938 92.9024 173.537 93.6243 176.231C94.4031 179.138 94.2478 183.011 93.9724 186.046C93.6772 189.298 93.1456 192.495 92.737 194.492C92.1778 197.225 89.5094 198.987 86.7768 198.427C84.0443 197.868 82.2825 195.2 82.8416 192.467C83.1876 190.777 83.6573 187.954 83.9133 185.133C84.1891 182.095 84.1349 179.841 83.868 178.845C83.1462 176.151 84.745 173.382 87.4391 172.66Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M137.693 185.612C139.544 187.699 139.352 190.891 137.266 192.742C133.64 195.957 128.811 202.842 126.912 207.176C125.793 209.731 122.814 210.895 120.26 209.775C117.705 208.656 116.541 205.678 117.661 203.123C120.087 197.584 125.741 189.462 130.564 185.184C132.651 183.334 135.843 183.525 137.693 185.612Z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M143.142 106.629C143.189 103.84 145.487 101.617 148.275 101.663C152.563 101.733 158.532 103.631 162.187 109.36C165.863 115.122 166.352 123.427 162.604 134.507C160.305 141.303 157.71 146.407 154.909 150.066C152.117 153.714 148.909 156.189 145.365 157.139C137.608 159.218 131.981 153.53 130.512 148.048C129.79 145.354 131.389 142.585 134.083 141.863C136.777 141.141 139.546 142.74 140.268 145.434C140.76 147.269 141.972 147.592 142.751 147.383C143.476 147.189 144.96 146.446 146.888 143.927C148.807 141.42 150.959 137.41 153.036 131.27C156.29 121.652 155.029 116.919 153.672 114.793C152.294 112.633 149.948 111.792 148.109 111.762C145.32 111.716 143.096 109.418 143.142 106.629Z"/>
    </svg>
  </a>
);

// ── NIP-07 Nostr login ────────────────────────────────────────────────────────
declare global { interface Window { nostr?: { getPublicKey(): Promise<string>; signEvent(e: object): Promise<object> } } }
// Module-level pubkey store with subscribers so every useNostrLogin() call
// shares one source of truth. Without this, two components in the same page
// each get an independent useState — login in one wouldn't re-render the other
// until a page refresh re-read localStorage.
let _nostrPubkey: string | null = null;
let _nostrInitialized = false;
const _nostrSubs = new Set<(p: string | null) => void>();
function _readInitialPubkey(): string | null {
  try {
    const p = new URLSearchParams(window.location.search).get('nostr_pk');
    if (p) { localStorage.setItem('nostr_pubkey', p); return p; }
    return localStorage.getItem('nostr_pubkey');
  } catch { return null; }
}
function _setNostrPubkey(p: string | null) {
  _nostrPubkey = p;
  _nostrSubs.forEach(fn => fn(p));
}

function useNostrLogin() {
  const [pubkey, setLocal] = useState<string | null>(() => {
    if (!_nostrInitialized) { _nostrPubkey = _readInitialPubkey(); _nostrInitialized = true; }
    return _nostrPubkey;
  });
  useEffect(() => {
    _nostrSubs.add(setLocal);
    return () => { _nostrSubs.delete(setLocal); };
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nostr_pk')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  const login = async () => {
    if (typeof window !== 'undefined' && window.nostr) {
      try {
        const pk = await window.nostr.getPublicKey();
        if (pk) { localStorage.setItem('nostr_pubkey', pk); _setNostrPubkey(pk); }
      } catch {}
      return;
    }
    const cb = `${window.location.origin}${window.location.pathname}?nostr_pk={signature}`;
    window.location.href = `nostrsigner:getpubkey?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=${encodeURIComponent(cb)}`;
  };
  const logout = () => {
    try { localStorage.removeItem('nostr_pubkey'); } catch {} /* */
    _setNostrPubkey(null);
  };
  return { pubkey, login, logout };
}
// Light-weight kind:0 lookup so the nav login button can show the user's
// avatar + display name. Lazy: only opens a socket once `pubkey` is set.
function useUserProfile(pubkey: string | null) {
  const [profile, setProfile] = useState<{ nip05?: string; name?: string; display_name?: string; picture?: string } | null>(null);
  useEffect(() => {
    if (!pubkey) { setProfile(null); return; }
    setProfile(null);
    const relays = ['wss://relay.fizx.uk', 'wss://nos.lol'];
    const sockets: WebSocket[] = [];
    let latestTs = 0;
    relays.forEach(url => {
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { return; }
      sockets.push(ws);
      const subId = `prof-${Math.random().toString(36).slice(2, 8)}`;
      ws.onopen = () => { try { ws.send(JSON.stringify(['REQ', subId, { kinds: [0], authors: [pubkey], limit: 1 }])); } catch { /* ignore */ } };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data as string);
          if (!Array.isArray(m)) return;
          if (m[0] === 'EVENT' && m[1] === subId) {
            const ev = m[2];
            if (ev?.created_at > latestTs) {
              latestTs = ev.created_at;
              try {
                const p = JSON.parse(ev.content);
                if (p && typeof p === 'object') setProfile(p);
              } catch { /* malformed metadata */ }
            }
          } else if (m[0] === 'EOSE') {
            try { ws.close(); } catch { /* ignore */ }
          }
        } catch { /* malformed frame */ }
      };
    });
    return () => { sockets.forEach(s => { try { s.close(); } catch { /* ignore */ } }); };
  }, [pubkey]);
  return profile;
}

function NostrLogin() {
  const { pubkey, login, logout } = useNostrLogin();
  const profile = useUserProfile(pubkey);
  if (pubkey) {
    const label = profile?.nip05 || profile?.display_name || profile?.name || `${pubkey.slice(0, 8)}…`;
    return (
      <button onClick={logout} title={`Signed in as ${label} — click to log out`} className="font-mono text-[11px] px-1.5 py-1 border border-primary/30 text-primary/70 hover:text-primary hover:border-primary/60 transition-colors flex items-center gap-1.5 w-full justify-center whitespace-nowrap">
        {profile?.picture ? (
          <span className="w-4 h-4 rounded-full shrink-0 bg-muted bg-cover bg-center ring-1 ring-primary/30" style={{ backgroundImage: `url(${JSON.stringify(profile.picture)})` }} aria-hidden />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        )}
        <span className="hidden sm:inline max-w-[11rem] truncate">{label}</span>
        <span className="text-muted-foreground/50 ml-0.5">×</span>
      </button>
    );
  }
  return (
    <button onClick={login} className="font-mono text-[11px] px-2 py-1 border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors flex items-center gap-1.5 w-full justify-center whitespace-nowrap">
      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span className="hidden sm:inline">Log in with Nostr</span>
    </button>
  );
}

// ── Share-to-Nostr ────────────────────────────────────────────────────────────
// One card → one kind:1 note. Minimal payload: the single rate the card is
// showing, source, UTC timestamp, and a permalink. No event tags — the goal
// is a tiny, plain-text broadcast, not a discoverability-optimized post.
function buildShareText(rate: CurrencyRate, source: 'coingecko' | 'bitview', imageUrl?: string): string {
  const sats = new Intl.NumberFormat('en-US').format(rate.satoshisPerUnit);
  const ts = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const lines = [
    `1 ${rate.symbol} = ${sats} sats`,
    '',
    `via ${source} · ${ts}`,
    'https://fx.upleb.uk',
  ];
  // Image URL on its own line at the end — most clients auto-embed.
  if (imageUrl) lines.push('', imageUrl);
  return lines.join('\n');
}

// NIP-98: sign a kind:27235 event proving the bearer is authorized to call
// the target URL with the given HTTP method. nostr.build accepts this in
// the Authorization header as `Nostr <base64(JSON.stringify(event))>`.
async function buildNip98Auth(url: string, method: string, pubkey: string): Promise<string | null> {
  if (!window.nostr) return null;
  const template = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [['u', url], ['method', method.toUpperCase()]],
    pubkey,
  };
  try {
    const signed = await window.nostr.signEvent(template);
    return 'Nostr ' + btoa(JSON.stringify(signed));
  } catch {
    return null;
  }
}

type ShareState =
  | { kind: 'idle' }
  | { kind: 'snapshot' }
  | { kind: 'uploading' }
  | { kind: 'signing' }
  | { kind: 'publishing' }
  | { kind: 'done'; ok: number; total: number }
  | { kind: 'error'; reason: string };

function ShareToNostr({ rate, source, getSnapshotNode }: {
  rate: CurrencyRate;
  source: 'coingecko' | 'bitview';
  getSnapshotNode: () => HTMLElement | null;
}) {
  const { pubkey, login } = useNostrLogin();
  const [state, setState] = useState<ShareState>({ kind: 'idle' });

  const onClick = async () => {
    if (!pubkey) { void login(); return; }
    if (!window.nostr) { setState({ kind: 'error', reason: 'no signer' }); return; }
    if (rate.rate <= 0) { setState({ kind: 'error', reason: 'no rate' }); return; }

    // 1. Render the card to PNG, skipping elements marked data-no-snapshot.
    setState({ kind: 'snapshot' });
    const node = getSnapshotNode();
    if (!node) { setState({ kind: 'error', reason: 'no card' }); return; }
    let blob: Blob | null = null;
    try {
      blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: '#0d1117',
        filter: (n) => !(n instanceof HTMLElement && n.dataset.noSnapshot === 'true'),
      });
    } catch (e) {
      setState({ kind: 'error', reason: `snapshot: ${(e as Error).message ?? 'failed'}` });
      return;
    }
    if (!blob) { setState({ kind: 'error', reason: 'snapshot empty' }); return; }

    // 2. Upload to nostr.build with NIP-98 auth.
    setState({ kind: 'uploading' });
    const auth = await buildNip98Auth(NB_UPLOAD_URL, 'POST', pubkey);
    if (!auth) { setState({ kind: 'error', reason: 'auth signing rejected' }); return; }
    const form = new FormData();
    form.append('file', blob, `${rate.symbol}-sats-${Date.now()}.png`);
    let imageUrl: string | undefined;
    try {
      const res = await fetch(NB_UPLOAD_URL, { method: 'POST', headers: { Authorization: auth }, body: form });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        setState({ kind: 'error', reason: `upload ${res.status}: ${txt.slice(0, 80)}` });
        return;
      }
      const json = await res.json();
      // NIP-96 response shape: { status, nip94_event: { tags: [["url", "..."], ...] } }
      const urlTag = json?.nip94_event?.tags?.find?.((t: string[]) => t[0] === 'url');
      imageUrl = urlTag?.[1];
      if (!imageUrl) {
        setState({ kind: 'error', reason: 'no url in response' });
        return;
      }
    } catch (e) {
      setState({ kind: 'error', reason: `upload: ${(e as Error).message ?? 'failed'}` });
      return;
    }

    // 3. Sign the kind:1 note that references the image.
    setState({ kind: 'signing' });
    const template = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      content: buildShareText(rate, source, imageUrl),
      tags: [],
      pubkey,
    };
    let signed: SignedEvent;
    try {
      signed = (await window.nostr.signEvent(template)) as SignedEvent;
    } catch (e) {
      setState({ kind: 'error', reason: (e as Error)?.message ?? 'rejected' });
      return;
    }

    // 4. Publish.
    setState({ kind: 'publishing' });
    const results = await publishToAll(SHARE_RELAYS, signed);
    const ok = results.filter(r => r.ok).length;
    setState({ kind: 'done', ok, total: results.length });
    setTimeout(() => setState((s) => (s.kind === 'done' ? { kind: 'idle' } : s)), 3500);
  };

  const label =
    state.kind === 'snapshot'   ? 'snapshot…' :
    state.kind === 'uploading'  ? 'uploading…' :
    state.kind === 'signing'    ? 'signing…' :
    state.kind === 'publishing' ? 'publishing…' :
    state.kind === 'done'       ? `${state.ok}/${state.total} ✓` :
    state.kind === 'error'      ? `× ${state.reason}` :
    pubkey                       ? 'share' : 'log in';
  const disabled = state.kind !== 'idle' && state.kind !== 'done' && state.kind !== 'error';
  const tone =
    state.kind === 'done'  ? 'text-primary' :
    state.kind === 'error' ? 'text-amber-500/80' :
                              'text-muted-foreground/50 hover:text-primary';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-[10px] transition-colors flex items-center gap-1 disabled:opacity-60 ${tone}`}
      title={pubkey ? `Publish 1 ${rate.symbol} snapshot to ${SHARE_RELAYS.length} relays` : 'Log in with Nostr to share'}
    >
      <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span>{label}</span>
    </button>
  );
}

interface CurrencyRate {
  symbol: string;
  name: string;
  rate: number;
  satoshisPerUnit: number;
  flag: string;
}

type Direction = 'up' | 'down' | null;

const FizxLogo = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 4 4" fill="none" xmlns="http://www.w3.org/2000/svg" className={className ?? 'shrink-0'} style={{ imageRendering: 'pixelated' }}>
    <rect x="0" y="0" width="1" height="1" fill="#FF7849"/>
    <rect x="1" y="0" width="1" height="1" fill="#FFB347"/>
    <rect x="2" y="0" width="1" height="1" fill="#FF7849"/>
    <rect x="3" y="0" width="1" height="1" fill="#FFB347"/>
    <rect x="0" y="1" width="1" height="1" fill="#FFB347"/>
    <rect x="1" y="1" width="1" height="1" fill="#FF7849"/>
    <rect x="2" y="1" width="1" height="1" fill="#FFB347"/>
    <rect x="3" y="1" width="1" height="1" fill="#FF7849"/>
    <rect x="0" y="2" width="1" height="1" fill="#FF7849"/>
    <rect x="1" y="2" width="1" height="1" fill="#FFB347"/>
    <rect x="2" y="2" width="1" height="1" fill="#FF7849"/>
    <rect x="3" y="2" width="1" height="1" fill="#FFB347"/>
    <rect x="0" y="3" width="1" height="1" fill="#FFB347"/>
    <rect x="1" y="3" width="1" height="1" fill="#FF7849"/>
    <rect x="2" y="3" width="1" height="1" fill="#FFB347"/>
    <rect x="3" y="3" width="1" height="1" fill="#FF7849"/>
  </svg>
);

const REFRESH_MS = 21000;
const SQUARE_COUNT = 21;

function lerpHex(a: [number,number,number], b: [number,number,number], t: number): string {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

const CORAL:   [number,number,number] = [255,120, 73];
const AMBER:   [number,number,number] = [255,179, 71];
const SQUARE_COLORS = Array.from({ length: SQUARE_COUNT }, (_, i) => {
  const t = i < 10 ? i / 10 : (SQUARE_COUNT - 1 - i) / 10;
  return lerpHex(CORAL, AMBER, t);
});
const SQUARE_DIM = '#161e2e';

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

// ── Comparative sidebar ───────────────────────────────────────────────────────
function ComparePanel({
  rates, bitviewSats, bitviewRefreshed,
}: {
  rates: CurrencyRate[];
  bitviewSats: number | null;
  bitviewRefreshed: boolean;
}) {
  const sorted = [...rates]
    .filter(r => r.satoshisPerUnit > 0)
    .sort((a, b) => b.satoshisPerUnit - a.satoshisPerUnit);
  const max = sorted[0]?.satoshisPerUnit ?? 1;
  const usd = rates.find(r => r.symbol === 'USD');

  return (
    <div className="bg-card border border-border rounded-none p-4 flex flex-col gap-5">

      <div className="flex items-center gap-2">
        <span className="h-[2px] bg-primary/50 w-3 shrink-0" />
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">compare</h2>
      </div>

      {/* Sats/unit ranking — currencies + bitview USD */}
      {sorted.length > 0 && (
        <div className="space-y-2 flex-1">
          <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">sats per unit</p>
          <div className="space-y-2.5">
            {[
              ...sorted.map(r => ({
                key: r.symbol,
                label: r.symbol,
                sats: r.satoshisPerUnit,
                isUsd: r.symbol === 'USD',
                isBitview: false,
              })),
              ...(bitviewSats !== null ? [{
                key: 'bitview',
                label: 'bitview',
                sats: bitviewSats,
                isUsd: false,
                isBitview: true,
              }] : []),
            ]
              .sort((a, b) => b.sats - a.sats)
              .map((entry, idx) => (
                <div key={entry.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-mono text-muted-foreground/25 w-3 shrink-0">{idx + 1}</span>
                      <span className={`text-xs font-mono truncate ${
                        entry.isBitview ? (bitviewRefreshed ? 'text-accent' : 'text-accent/70')
                        : entry.isUsd   ? 'text-primary'
                        : 'text-muted-foreground'
                      }`}>{entry.label}</span>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${
                      entry.isBitview ? (bitviewRefreshed ? 'text-accent' : 'text-accent/70')
                      : entry.isUsd   ? 'text-primary'
                      : 'text-muted-foreground/80'
                    }`}>{fmt(entry.sats)}</span>
                  </div>
                  <div className="h-[2px] bg-border/20">
                    <div
                      className={`h-full transition-all duration-700 ${entry.isBitview ? 'bg-accent/40' : entry.isUsd ? 'bg-primary/40' : 'bg-primary/20'}`}
                      style={{ width: `${(entry.sats / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-[10px] font-mono text-muted-foreground/30 animate-pulse">loading…</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const BitcoinConverter = () => {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [changed, setChanged] = useState<Record<string, Direction>>({});
  const [tick, setTick] = useState(0);
  const prevRates = useRef<Record<string, number>>({});
  // Per-card DOM refs so the share button can snapshot its own card.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [bitviewSats, setBitviewSats] = useState<number | null>(null);
  const [bitviewFetchedAt, setBitviewFetchedAt] = useState<Date | null>(null);
  const [bitviewError, setBitviewError] = useState<string | null>(null);
  const [bitviewRefreshed, setBitviewRefreshed] = useState(false);

  const currencies = [
    { symbol: 'USD', name: 'US Dollar',       flag: '🇺🇸' },
    { symbol: 'EUR', name: 'Euro',             flag: '🇪🇺' },
    { symbol: 'GBP', name: 'British Pound',    flag: '🇬🇧' },
    { symbol: 'JPY', name: 'Japanese Yen',     flag: '🇯🇵' },
    { symbol: 'CAD', name: 'Canadian Dollar',  flag: '🇨🇦' },
    { symbol: 'AUD', name: 'Australian Dollar',flag: '🇦🇺' },
    { symbol: 'CHF', name: 'Swiss Franc',      flag: '🇨🇭' },
    { symbol: 'CNY', name: 'Chinese Yuan',     flag: '🇨🇳' },
  ];

  const fetchCoinGecko = async () => {
    try {
      setError(null);
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur,gbp,jpy,cad,aud,chf,cny'
      );
      const bitcoinPrices = response.data.bitcoin;
      const SATS = 100_000_000;
      const newRates: CurrencyRate[] = currencies.map(c => {
        const price = bitcoinPrices[c.symbol.toLowerCase()];
        return { ...c, rate: price || 0, satoshisPerUnit: price ? Math.round(SATS / price) : 0 };
      });

      const directions: Record<string, Direction> = {};
      newRates.forEach(r => {
        const prev = prevRates.current[r.symbol];
        if (prev !== undefined && r.satoshisPerUnit !== prev)
          directions[r.symbol] = r.satoshisPerUnit > prev ? 'up' : 'down';
        prevRates.current[r.symbol] = r.satoshisPerUnit;
      });

      setRates(newRates);
      setLastUpdated(new Date());
      setJustRefreshed(true);
      setTick(0);
      setTimeout(() => setJustRefreshed(false), 2000);
      if (Object.keys(directions).length > 0) {
        setChanged(directions);
        setTimeout(() => setChanged({}), 1800);
      }
    } catch {
      setError('CoinGecko unavailable');
    }
  };

  const fetchBitview = async () => {
    try {
      setBitviewError(null);
      const response = await axios.get('https://bitview.space/api/v1/prices');
      const usdPrice = response.data?.USD;
      if (typeof usdPrice === 'number' && usdPrice > 0) {
        setBitviewSats(Math.round(100_000_000 / usdPrice));
        setBitviewFetchedAt(new Date());
        setBitviewRefreshed(true);
        setTimeout(() => setBitviewRefreshed(false), 2000);
      }
    } catch {
      setBitviewError('bitview unavailable');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.allSettled([fetchCoinGecko(), fetchBitview()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const fetchInterval = setInterval(fetchAll, REFRESH_MS);
    const tickInterval  = setInterval(() => setTick(t => t < SQUARE_COUNT ? t + 1 : 0), 1000);
    return () => { clearInterval(fetchInterval); clearInterval(tickInterval); };
  }, []);

  const cgTime = lastUpdated?.getTime() ?? 0;
  const bvTime = bitviewFetchedAt?.getTime() ?? 0;
  const activeSource: 'coingecko' | 'bitview' = cgTime >= bvTime ? 'coingecko' : 'bitview';
  const mostRecentAt = cgTime >= bvTime ? lastUpdated : bitviewFetchedAt;

  const formatPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(price);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Nav */}
      <nav className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <a href="https://upleb.uk" className="font-mono text-[11px] sm:text-[12px] text-muted-foreground/50 hover:text-primary transition-colors shrink-0">upleb</a>
          {(() => {
            const SUBS = ['blst','glmps','npub','pls','smpl'] as const;
            const cur = SUBS.find((s) => window.location.hostname === `${s}.upleb.uk`);
            return <>
              {cur && <span className="font-mono text-[11px] sm:text-[12px] text-primary whitespace-nowrap shrink-0 cursor-default">{cur}</span>}
              <div className="flex-1 flex justify-center items-center gap-x-3 overflow-x-auto">
                {SUBS.filter((s) => s !== cur).map((sub) => (
                  <a key={sub} href={`https://${sub}.upleb.uk`} className="text-muted-foreground/60 hover:text-primary transition-colors whitespace-nowrap text-[11px] sm:text-[12px] font-mono">{sub}</a>
                ))}
              </div>
            </>;
          })()}
          <a href="https://github.com/macos-node/fx.upleb.uk" target="_blank" rel="noopener noreferrer" title="Source on GitHub" aria-label="Source on GitHub" className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.77 1.07.77 2.16 0 1.56-.01 2.82-.01 3.21 0 .31.21.68.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/></svg>
          </a>
          <NstartHand />
          <div className="shrink-0 flex justify-end w-[34px] sm:w-[210px]"><NostrLogin /></div>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">

        {/* Header — hero card (title + subtitle + relay indicator + Shaka) */}
        <div className="mb-10">
          <div className="bg-card border border-border px-4 py-3 mb-4 min-h-[110px] flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <AnimatedTitle accent="fx" rest="" from="#FF7849" to="#FFB347" suffixRgba="rgba(255,120,73,0.2)" fontSize="clamp(28px, 5vw, 40px)" />
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground/70 truncate">Live Bitcoin exchange rates · satoshis per currency unit</span>
              </div>
            </div>
          </div>
          {/* 21-bar timer */}

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {mostRecentAt && (
              <span className="text-muted-foreground/50 text-xs font-mono">
                Updated {mostRecentAt.toLocaleTimeString()}
              </span>
            )}
            <button onClick={fetchAll} disabled={loading}
              className="shrink-0 p-1 -my-1 hover:bg-primary/10 disabled:opacity-40 text-primary/70 hover:text-primary transition-colors"
              aria-label="Refresh rates">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {error ? (
              <span className="text-xs font-mono text-amber-500/70">⚠ {error}</span>
            ) : lastUpdated ? (
              <span className={`text-xs font-mono px-1.5 py-0.5 border transition-all duration-500
                ${justRefreshed ? 'text-primary border-primary/50 bg-primary/10'
                  : activeSource === 'coingecko' ? 'text-primary/60 border-primary/20'
                  : 'text-muted-foreground/40 border-border'}`}>
                CoinGecko
              </span>
            ) : null}
            {bitviewError ? (
              <span className="text-xs font-mono text-amber-500/40">⚠ {bitviewError}</span>
            ) : bitviewFetchedAt ? (
              <a href="https://bitview.space/" target="_blank" rel="noopener noreferrer"
                className={`text-xs font-mono px-1.5 py-0.5 border transition-all duration-500 hover:opacity-80
                  ${bitviewRefreshed ? 'text-accent border-accent/50 bg-accent/10'
                    : activeSource === 'bitview' ? 'text-accent/60 border-accent/20'
                    : 'text-accent/40 border-accent/20'}`}>
                bitview
              </a>
            ) : null}
          </div>

          {/* Site-wide relay reference (status-only; fx is client-only) */}
          <RelayStats
            className="mt-3"
            urls={REFERENCE_RELAYS}
            filter={{ kinds: [1], limit: 0 }}
            readable={false}
            writable={false}
          />
        </div>

        {/* 4-col grid + compare sidebar */}
        <div className="flex flex-col xl:flex-row gap-4">

          {/* Currency cards — 2-col mobile, 4-col desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-w-0">
            {rates.map((rate) => {
              const dir = changed[rate.symbol] ?? null;
              return (
                <Card key={rate.symbol}
                  ref={(el) => { cardRefs.current[rate.symbol] = el; }}
                  className={`bg-card border transition-all duration-500 rounded-none
                    ${dir === 'up'   ? 'border-primary shadow-lg shadow-primary/20' :
                      dir === 'down' ? 'border-accent/70 shadow-lg shadow-accent/20' :
                      'border-border hover:border-primary/40'}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-white leading-tight">
                        Bitcoin / {rate.name}
                      </span>
                      <span data-no-snapshot="true">
                        {dir === 'up'   ? <TrendingUp   className="h-3.5 w-3.5 text-primary shrink-0" /> :
                         dir === 'down' ? <TrendingDown  className="h-3.5 w-3.5 text-accent shrink-0" /> :
                                          <TrendingUp   className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* BTC price — secondary */}
                    <p className="text-[11px] font-mono text-muted-foreground/50">
                      {rate.rate > 0 ? formatPrice(rate.rate, rate.symbol) : '—'}
                    </p>

                    {/* Sats — hero */}
                    <div className="border-t border-border pt-3">
                      <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
                        sats per 1 {rate.symbol}
                      </p>
                      <p className={`text-2xl font-bold font-mono leading-none transition-colors duration-500
                        ${dir === 'up' ? 'text-primary' : dir === 'down' ? 'text-accent' : 'text-primary'}`}>
                        {rate.satoshisPerUnit > 0 ? fmt(rate.satoshisPerUnit) : '—'}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">sats</p>
                    </div>

                    {/* Share this card as a kind:1 broadcast */}
                    <div className="flex justify-end" data-no-snapshot="true">
                      <ShareToNostr
                        rate={rate}
                        source={activeSource}
                        getSnapshotNode={() => cardRefs.current[rate.symbol]}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Fallback USD card when CoinGecko is down */}
            {error && bitviewSats !== null && rates.length === 0 && (
              <Card className="bg-card border border-border rounded-none hover:border-primary/40 transition-all duration-500">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white leading-tight">
                      Bitcoin / US Dollar
                    </span>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <p className="text-[11px] font-mono text-muted-foreground/30">CoinGecko unavailable</p>
                  <div className="border-t border-border pt-3">
                    <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">sats per 1 USD</p>
                    <p className="text-2xl font-bold font-mono text-accent leading-none">{fmt(bitviewSats)}</p>
                    <p className="text-[10px] font-mono text-accent/50 mt-0.5">via bitview</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Comparative sidebar */}
          <div className="xl:w-52 shrink-0">
            <ComparePanel rates={rates} bitviewSats={bitviewSats} bitviewRefreshed={bitviewRefreshed} />
          </div>

        </div>
      </div>

      {/* Footer — cross-site chips */}
      <footer className="border-t border-border px-6 py-4 space-y-2">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs font-mono">
          <div className="flex items-center gap-4">
            <a href="https://ln.fizx.uk" className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-primary transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFB347" aria-hidden="true">
                <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2z"/>
              </svg>
              <span>ln<span className="text-muted-foreground/40">.fizx.uk</span></span>
            </a>
            <a href="https://git.upleb.uk" className="flex items-center gap-1.5 text-muted-foreground/60 hover:text-primary transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF7849" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
              </svg>
              <span>git<span className="text-muted-foreground/40">.upleb.uk</span></span>
            </a>
          </div>
          <span className="text-primary/60">✦ built with claude</span>
        </div>
        <p className="max-w-5xl mx-auto text-xs font-mono text-muted-foreground/40 text-center sm:text-right">
          data sources:{' '}
          <a href="https://github.com/bitcoinresearchkit/brk" target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground/60 hover:text-primary transition-colors">bitcoinresearch.kit</a>
          {' · '}
          <a href="https://coingecko.com" target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground/60 hover:text-primary transition-colors">coingecko</a>
        </p>
      </footer>

    </div>
  );
};

export default BitcoinConverter;
