// Small presentational pieces for /research. No hooks → usable from server and client components.

/** Renders text, marking every [PLACEHOLDER] so unfinished content is impossible to miss. */
export function Txt({ s }: { s: string }) {
  const parts = s.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]*\]$/.test(p) ? (
          <mark key={i} className="ph" title="Placeholder — replace in content/research.json">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** An image, or a clearly marked placeholder box when the file has not been supplied yet. */
export function ImgSlot({ src, alt, label, ratio = "4 / 3" }: { src: string | null; alt: string; label: string; ratio?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" decoding="async" className="slot-img" style={{ aspectRatio: ratio }} />;
  }
  return (
    <div className="slot-ph" style={{ aspectRatio: ratio }} role="img" aria-label={`${label}: ${alt}`}>
      <span className="ph">[{label}]</span>
    </div>
  );
}

/** Pixel-style "TSG" sticker: pistachio letters, plum outline, cream comet ending in a hexagon. */
const GLYPHS: Record<string, string[]> = {
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
};
const PX = 8;
function pixels() {
  const out: [number, number][] = [];
  ["T", "S", "G"].forEach((ch, li) =>
    GLYPHS[ch].forEach((row, y) =>
      [...row].forEach((bit, x) => {
        if (bit === "1") out.push([(li * 6 + x) * PX, y * PX]);
      }),
    ),
  );
  return out;
}
const PIXELS = pixels();

export function TsgLogo({ caption, className, title = "TSG" }: { caption?: string; className?: string; title?: string }) {
  const h = caption ? 150 : 124;
  return (
    <svg viewBox={`0 0 220 ${h}`} className={className} role="img" aria-label={caption ? `${title} — ${caption}` : title}>
      <rect x="4" y="4" width="208" height={h - 12} rx="24" fill="#27152B" />
      <rect x="0" y="0" width="208" height={h - 12} rx="24" fill="#BD75F3" stroke="#27152B" strokeWidth="4" />
      {/* comet arc ending in a hexagon */}
      <path d="M22 96 C 40 18, 150 4, 186 34" fill="none" stroke="#FFF4C9" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 9" opacity=".9" />
      <path d="M120 16 C 150 12, 172 20, 186 34" fill="none" stroke="#FFF4C9" strokeWidth="5" strokeLinecap="round" />
      <polygon points="186,22 196.4,28 196.4,40 186,46 175.6,40 175.6,28" fill="#FFF4C9" stroke="#27152B" strokeWidth="3" />
      {/* sparkles */}
      {[
        [30, 26, 6],
        [196, 82, 5],
        [100, 18, 4],
      ].map(([x, y, r]) => (
        <path key={`${x}${y}`} d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`} fill="#FFFFFF" />
      ))}
      <g transform="translate(36 42)">
        <g fill="#27152B" stroke="#27152B" strokeWidth="7" strokeLinejoin="round">
          {PIXELS.map(([x, y]) => (
            <rect key={`o${x}-${y}`} x={x} y={y} width={PX} height={PX} />
          ))}
        </g>
        <g fill="#B7DB8C">
          {PIXELS.map(([x, y]) => (
            <rect key={`f${x}-${y}`} x={x} y={y} width={PX + 0.5} height={PX + 0.5} />
          ))}
        </g>
      </g>
      {caption && (
        <text x="104" y={h - 24} textAnchor="middle" fontSize="15" fontWeight="800" fill="#27152B" fontFamily="inherit">
          {caption}
        </text>
      )}
    </svg>
  );
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  hex: <path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1zM12 7.5v9M7.8 9.9l8.4 4.8M16.2 9.9l-8.4 4.8" />,
  agents: (
    <>
      <circle cx="8" cy="7" r="2.6" />
      <circle cx="16.5" cy="9" r="2.2" />
      <path d="M3.5 19c.6-3.3 2.4-5 4.5-5s3.9 1.7 4.5 5M13 19c.4-2.5 1.8-3.8 3.5-3.8S19.6 16.5 20 19" />
    </>
  ),
  kernel: (
    <>
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="9" strokeDasharray="2 2.5" />
    </>
  ),
  index: <path d="M4 12h16M12 4v16M5 5l14 14" />,
  video: (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
      <path d="M15.5 10.5l5-3v9l-5-3z" />
    </>
  ),
};

export function StepIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[name] ?? ICON_PATHS.hex}
    </svg>
  );
}

/** Tiny neon-lime asterisk accent. */
export function Spark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`spark ${className}`} aria-hidden>
      <path d="M10 0l2.2 7.8L20 10l-7.8 2.2L10 20l-2.2-7.8L0 10l7.8-2.2z" />
    </svg>
  );
}
