/* אייקונים של הטאבלט — מלאים בצבע currentColor, בסגנון האפליקציה ברכב */

type P = { size?: number };
const svg = (size = 56, children: React.ReactNode, vb = '0 0 64 64') => (
  <svg width={size} height={size} viewBox={vb} fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);

export const IcCalendar = ({ size }: P) =>
  svg(
    size,
    <>
      <rect x="18" y="6" width="5" height="12" rx="2.5" />
      <rect x="41" y="6" width="5" height="12" rx="2.5" />
      <path d="M12 13h5v4a4 4 0 0 0 8 0v-4h14v4a4 4 0 0 0 8 0v-4h5a4 4 0 0 1 4 4v38a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V17a4 4 0 0 1 4-4Zm-0 15v26h40V28Z" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={19 + c * 10} y={32 + r * 7} width="5" height="4" rx="1" />))}
    </>,
  );

export const IcCrew = ({ size }: P) =>
  svg(
    size,
    <>
      <circle cx="32" cy="18" r="9" />
      <path d="M17 50c0-10 6.5-17 15-17s15 7 15 17v4H17Z" />
      <circle cx="13" cy="24" r="6.5" />
      <path d="M2 52c0-8 4.5-13 11-13 2.3 0 4.3.6 6 1.8-2.4 3.2-3.8 7.3-4 11.2V54H2Z" />
      <circle cx="51" cy="24" r="6.5" />
      <path d="M62 52c0-8-4.5-13-11-13-2.3 0-4.3.6-6 1.8 2.4 3.2 3.8 7.3 4 11.2V54h13Z" />
    </>,
  );

export const IcTools = ({ size }: P) =>
  svg(
    size,
    <>
      {/* מברג */}
      <path d="M44 6l8 0 6 6-3 9-6 2L24 48l-6-6 25-25 2-6Z" transform="rotate(0)" />
      <path d="M20 44l3 3-9 11a4 4 0 0 1-6-6Z" />
      {/* מפתח */}
      <path d="M10 6c5-2 11 0 13 5 1 2 1 4 .6 6L55 48a4.5 4.5 0 0 1-6.4 6.4L17 22.4c-2 .5-4 .4-6-.6-5-2-7-8-5-13l7 7 5-1 1-5Z" />
    </>,
  );

export const IcRadio = ({ size }: P) =>
  svg(
    size,
    <>
      <rect x="35" y="2" width="5" height="16" rx="2" />
      <path d="M22 14h22a5 5 0 0 1 5 5v36a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5Zm3 7v10h16V21Zm0 16v3h16v-3Zm0 7v3h16v-3Zm0 7v3h16v-3Z" />
    </>,
  );

export const IcSkull = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M32 6c-10 0-17 7-17 16 0 5 2 9 5 11v6h24v-6c3-2 5-6 5-11 0-9-7-16-17-16Zm-7 13a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm14 0a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-7 10 3 5h-6Z" />
      <path d="M8 40l4-4 20 9 20-9 4 4-15 7 15 7-4 4-20-9-20 9-4-4 15-7Z" />
    </>,
  );

export const IcChart = ({ size }: P) =>
  svg(
    size,
    <path d="M10 6h44a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Zm8 22v20h6V28Zm11-10v30h6V18Zm11 16v14h6V34Z" />,
  );

export const IcGate = ({ size }: P) =>
  svg(
    size,
    <>
      <rect x="6" y="40" width="10" height="20" rx="2" />
      <circle cx="11" cy="40" r="6" />
      <path d="M14 36l36-28 5 6-36 28Z" />
      <path d="M22 30l4 5 5-4-4-5ZM34 21l4 5 5-4-4-5Z" fill="#1d1e20" opacity=".55" />
    </>,
  );

export const IcToolbox = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M24 10h16a4 4 0 0 1 4 4v4h-5v-3H25v3h-5v-4a4 4 0 0 1 4-4Z" />
      <path d="M8 20h48a4 4 0 0 1 4 4v8H4v-8a4 4 0 0 1 4-4Z" />
      <path d="M4 35h22v4h12v-4h22v17a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
    </>,
  );

export const IcClipboard = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M24 4h16a3 3 0 0 1 3 3v3H21V7a3 3 0 0 1 3-3Z" />
      <path d="M14 8h4v6h28V8h4a4 4 0 0 1 4 4v46a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Zm5 16v4h26v-4Zm0 10v4h26v-4Zm0 10v4h26v-4Z" />
    </>,
  );

/** בדיקה תקופתית: כלים + לוח שנה קטן */
export const IcToolsCal = ({ size, star }: P & { star?: boolean }) => (
  <span className="mdt-ic-combo">
    <IcTools size={size} />
    <span className="mdt-ic-mini">
      <IcCalendar size={(size ?? 56) * 0.42} />
      {star && <b>★</b>}
    </span>
  </span>
);

export const IcHome = ({ size = 24 }: P) =>
  svg(size, <path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3Z" />, '0 0 24 24');

export const IcMenu = ({ size = 24 }: P) =>
  svg(size, <path d="M3 5h18v3H3Zm0 6h18v3H3Zm0 6h18v3H3Z" />, '0 0 24 24');

export const IcBack = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12h16M13 5l7 7-7 7" />
  </svg>
);

export const IcBattery = ({ size = 16 }: P) =>
  svg(size, <path d="M9 2h6v2h2a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2Zm-1 6v12h8V8Z" />, '0 0 24 24');

/** תג מפקד צוות — מגן עם כנפיים */
export const IcCommander = ({ size = 40 }: P) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 64 48" aria-hidden="true">
    <path d="M32 4 44 9v12c0 10-5 18-12 22-7-4-12-12-12-22V9Z" fill="#2ecc40" />
    <path d="M32 10l7 3v8c0 6-3 11-7 14-4-3-7-8-7-14v-8Z" fill="#1f9a2c" />
    {[0, 1, 2].map((i) => (
      <g key={i} fill="#2ecc40">
        <path d={`M${18 - i * 5} ${12 + i * 7}h-${10 - i * 2}l3 5h${9 - i * 2}Z`} />
        <path d={`M${46 + i * 5} ${12 + i * 7}h${10 - i * 2}l-3 5h-${9 - i * 2}Z`} />
      </g>
    ))}
  </svg>
);

export const IcWheel = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1e88e5" strokeWidth="2.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.4" fill="#1e88e5" />
    <path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21" />
  </svg>
);

/** סימן מים ברקע — מגן עם להבה (גנרי, לא הסמל הרשמי) */
export const Watermark = () => (
  <svg width="560" height="560" viewBox="0 0 200 200" fill="none" stroke="#2a2a2a" strokeWidth="5" aria-hidden="true">
    <path d="M100 28 152 46v44c0 38-22 66-52 80-30-14-52-42-52-80V46Z" />
    <path d="M100 52c10 14 22 24 22 44a22 22 0 0 1-44 0c0-10 4-16 9-22 0 8 4 12 8 12-2-12 0-24 5-34Z" fill="#2a2a2a" stroke="none" />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <ellipse cx={34 - i * 3} cy={70 + i * 22} rx="9" ry="4" transform={`rotate(${-50 + i * 14} ${34 - i * 3} ${70 + i * 22})`} fill="#2a2a2a" stroke="none" />
        <ellipse cx={166 + i * 3} cy={70 + i * 22} rx="9" ry="4" transform={`rotate(${50 - i * 14} ${166 + i * 3} ${70 + i * 22})`} fill="#2a2a2a" stroke="none" />
      </g>
    ))}
  </svg>
);
