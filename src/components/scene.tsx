/* "תמונות וסרטונים מהזירה" — איורים סינתטיים שנוצרים לפי סוג האירוע ו-seed. אין בהדמיה מדיה אמיתית. */
import type { IncidentMedia } from '../engine/model';

function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** פוף עשן — אליפסות אפורות שנעות ב-CSS כשהסרטון "מתנגן" */
function Smoke({ x, y, r, n, seed }: { x: number; y: number; r: number; n: number; seed: number }) {
  const rnd = rng(seed);
  return (
    <g className="scene-smoke">
      {Array.from({ length: n }, (_, i) => {
        const dx = (rnd() - 0.5) * r * 2.2;
        const dy = -i * r * 0.55 - rnd() * r * 0.4;
        const rr = r * (0.7 + rnd() * 0.6 + i * 0.12);
        return <ellipse key={i} cx={x + dx} cy={y + dy} rx={rr} ry={rr * 0.72} fill="#3a3b40" opacity={0.75 - i * 0.07} style={{ animationDelay: `${i * 0.35}s` }} />;
      })}
    </g>
  );
}

function Flames({ x, y, w, h, seed }: { x: number; y: number; w: number; h: number; seed: number }) {
  const rnd = rng(seed + 1);
  return (
    <g className="scene-fire">
      {Array.from({ length: 5 }, (_, i) => {
        const fx = x + (i / 4) * w;
        const fh = h * (0.6 + rnd() * 0.6);
        return (
          <path
            key={i}
            d={`M${fx - w * 0.12} ${y} Q${fx - w * 0.06} ${y - fh * 0.5} ${fx} ${y - fh} Q${fx + w * 0.07} ${y - fh * 0.5} ${fx + w * 0.12} ${y} Z`}
            fill={i % 2 ? '#ff7a1a' : '#ffb020'}
            opacity=".95"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        );
      })}
    </g>
  );
}

const SKY: Record<string, [string, string]> = {
  structure: ['#5b6675', '#c9c3b8'],
  vehicle: ['#7a8898', '#d9d5cc'],
  brush: ['#c98a4a', '#f0d7b0'],
  mva: ['#6b7684', '#cfd3d8'],
  hazmat: ['#7c8a7a', '#d4dccc'],
  rescue: ['#6a7a90', '#dce2ea'],
};

/** הזירה עצמה, בתוך viewBox 320×200 */
function Scene({ typeKey, seed }: { typeKey: string; seed: number }) {
  const rnd = rng(seed);
  switch (typeKey) {
    case 'vehicle':
      return (
        <>
          <rect x="0" y="130" width="320" height="70" fill="#4a4d52" />
          <path d="M0 165h320" stroke="#e8e8e8" strokeWidth="3" strokeDasharray="24 18" />
          <path d="M70 150 l18-30 h110 l30 30 Z" fill="#2b3e6b" />
          <rect x="60" y="148" width="190" height="26" rx="6" fill="#34497c" />
          <rect x="100" y="126" width="40" height="18" fill="#9fc4e8" opacity=".8" />
          <rect x="150" y="126" width="40" height="18" fill="#9fc4e8" opacity=".8" />
          <circle cx="95" cy="176" r="12" fill="#111" />
          <circle cx="220" cy="176" r="12" fill="#111" />
          <Flames x={210} y={150} w={40} h={50} seed={seed} />
          <Smoke x={235} y={110} r={16} n={6} seed={seed} />
        </>
      );
    case 'brush':
      return (
        <>
          <path d="M0 150 Q80 110 160 140 T320 130 V200 H0Z" fill="#8a6a2e" />
          <path d="M0 170 Q100 150 200 170 T320 160 V200 H0Z" fill="#6b5222" />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${10 + i * 23} 185 l4-18 l4 18`} stroke="#4f3b14" strokeWidth="2" fill="none" />
          ))}
          <Flames x={40} y={150} w={200} h={38} seed={seed} />
          <Smoke x={120} y={110} r={22} n={7} seed={seed} />
          <Smoke x={220} y={120} r={16} n={5} seed={seed + 3} />
        </>
      );
    case 'mva':
      return (
        <>
          <rect x="0" y="120" width="320" height="80" fill="#4a4d52" />
          <path d="M0 160h320" stroke="#fff" strokeWidth="3" strokeDasharray="22 16" />
          <g transform={`rotate(${170 + rnd() * 20} 160 150)`}>
            <rect x="100" y="135" width="120" height="30" rx="8" fill="#b23a3a" />
            <path d="M115 135 l14-22 h62 l16 22Z" fill="#8f2d2d" />
            <circle cx="120" cy="168" r="11" fill="#111" />
            <circle cx="200" cy="168" r="11" fill="#111" />
          </g>
          <path d="M40 180 l8-22 l8 22Z" fill="#ff7a1a" />
          <path d="M270 180 l8-22 l8 22Z" fill="#ff7a1a" />
          <path d="M150 110 l-12 8 M165 108 l6 12" stroke="#ddd" strokeWidth="2" />
        </>
      );
    case 'hazmat':
      return (
        <>
          <rect x="0" y="140" width="320" height="60" fill="#5b5e63" />
          <rect x="60" y="80" width="200" height="70" rx="35" fill="#c9ccd1" />
          <rect x="60" y="150" width="200" height="8" fill="#8a8d92" />
          <rect x="135" y="98" width="50" height="34" fill="#f57c00" stroke="#111" strokeWidth="3" />
          <path d="M135 115h50" stroke="#111" strokeWidth="3" />
          <text x="160" y="112" textAnchor="middle" fontSize="11" fontWeight="800" fill="#111" fontFamily="monospace">268</text>
          <text x="160" y="129" textAnchor="middle" fontSize="11" fontWeight="800" fill="#111" fontFamily="monospace">1017</text>
          <g className="scene-smoke">
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={i} cx={240 + i * 14} cy={125 - i * 6} rx={22 + i * 5} ry={14 + i * 3} fill="#b9e3a8" opacity={0.55 - i * 0.06} style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </g>
        </>
      );
    case 'rescue':
      return (
        <>
          <rect x="90" y="30" width="140" height="170" fill="#8d94a0" />
          {Array.from({ length: 5 }, (_, r) =>
            Array.from({ length: 3 }, (_, c) => <rect key={`${r}${c}`} x={105 + c * 42} y={45 + r * 30} width="26" height="18" fill="#3e4652" />),
          )}
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M30 ${40 + i * 28} H90`} stroke="#c9922e" strokeWidth="3" />
          ))}
          <path d="M40 30 V200 M80 30 V200" stroke="#c9922e" strokeWidth="4" />
          <circle cx="62" cy="84" r="6" fill="#ffd166" />
          <path d="M62 90 v18 M62 96 l-8 10 M62 96 l8 10 M62 108 l-6 14 M62 108 l6 14" stroke="#ffd166" strokeWidth="3" />
        </>
      );
    default:
      return (
        <>
          <rect x="0" y="150" width="320" height="50" fill="#4a4d52" />
          <rect x="70" y="40" width="180" height="120" fill="#a89f94" />
          <rect x="70" y="40" width="180" height="8" fill="#7d746a" />
          {Array.from({ length: 3 }, (_, r) =>
            Array.from({ length: 4 }, (_, c) => (
              <rect key={`${r}${c}`} x={85 + c * 42} y={55 + r * 34} width="26" height="20" fill={r === 0 && c >= 2 ? '#ff7a1a' : '#2e3744'} />
            )),
          )}
          <rect x="145" y="125" width="30" height="35" fill="#3b3128" />
          <Flames x={172} y={75} w={28} h={34} seed={seed} />
          <Smoke x={200} y={48} r={18} n={7} seed={seed} />
          <Smoke x={160} y={56} r={12} n={4} seed={seed + 5} />
        </>
      );
  }
}

export function SceneMedia({ typeKey, media, t, playing, className }: { typeKey: string; media: IncidentMedia; t?: number; playing?: boolean; className?: string }) {
  const [a, b] = SKY[typeKey] ?? SKY.structure;
  const stamp = t !== undefined ? new Date(t).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return (
    <span className={`scene ${media.kind} ${playing ? 'playing' : ''} ${className ?? ''}`}>
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`sky${media.seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <rect width="320" height="200" fill={`url(#sky${media.seed})`} />
        <Scene typeKey={typeKey} seed={media.seed} />
      </svg>
      <i className="scene-grain" />
      {media.kind === 'video' && !playing && <b className="scene-play">▶</b>}
      {media.kind === 'video' && media.duration !== undefined && <em className="scene-dur mono">{`0:${String(media.duration).padStart(2, '0')}`}</em>}
      {stamp && <em className="scene-stamp mono">{stamp}</em>}
    </span>
  );
}
