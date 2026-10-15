/* אייקונים של הטאבלט — סט כבאות: שני גוונים על currentColor (הגוון השני ב-opacity) */

type P = { size?: number };
const svg = (size = 56, children: React.ReactNode, vb = '0 0 64 64') => (
  <svg width={size} height={size} viewBox={vb} fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);

/** להבה — האירועים שלי: צללית אחת ברורה עם להבה פנימית */
export const IcFlame = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M33 3c3 9 15 15 15 32a16 16 0 0 1-32 0c0-8 5-12 7-19 3 4 6 6 7 10 4-6 5-14 3-23Z" />
      <path d="M32 29c3 5 8 8 8 15a8 8 0 0 1-16 0c0-4 2-6 3-9 1 2 3 3 4 5 2-3 2-7 1-11Z" fill="#000" opacity=".45" />
    </>,
  );

/** קסדת כבאי — צוות ברכב */
export const IcHelmet = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M8 40c0-15 11-27 24-27s24 12 24 27v2H8Z" />
      <path d="M4 42h56a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3Z" opacity=".55" />
      <path d="M26 8h12a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3Z" opacity=".55" />
      <path d="M24 24h16l-2 12H26Z" fill="#000" opacity=".35" />
      <path d="M27 26h10l-1.3 8h-7.4Z" opacity=".9" />
    </>,
  );

/** רשימת בדיקה — בדיקות רכב: לוח עם שלוש שורות מסומנות */
export const IcWrenchCheck = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M14 10h6V7a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v3h6a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Zm10-1v5h16V9Z" />
      {[26, 38, 50].map((y) => (
        <g key={y}>
          <path d={`M17 ${y - 1}l3 3 6-6`} fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="30" y={y - 3} width="17" height="4" rx="2" fill="#000" opacity=".45" />
        </g>
      ))}
    </>,
  );

/** מכשיר קשר — צימוד מכשירי קשר */
export const IcWalkie = ({ size }: P) =>
  svg(
    size,
    <>
      <rect x="31" y="2" width="5" height="16" rx="2.5" opacity=".55" />
      <path d="M18 16h20a5 5 0 0 1 5 5v36a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5Zm3 7v10h14V23Z" />
      <path d="M21 38h14v3H21Zm0 6h14v3H21Zm0 6h8v3h-8Z" fill="#000" opacity=".4" />
      <path d="M48 22a9 9 0 0 1 0 14l-2.6-2.6a5.3 5.3 0 0 0 0-8.8Zm5.4-5.4A16.5 16.5 0 0 1 53.4 42l-2.6-2.6a12.8 12.8 0 0 0 0-20.2Z" opacity=".55" />
    </>,
  );

/** לוח סיכון — חומ״ס */
export const IcHazard = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M32 3 61 32 32 61 3 32Z" opacity=".55" />
      <path d="M32 11 53 32 32 53 11 32Z" />
      <path d="M32 20a3.5 3.5 0 0 1 3.5 3.5l-1.2 12a2.3 2.3 0 0 1-4.6 0l-1.2-12A3.5 3.5 0 0 1 32 20Zm0 20a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" fill="#000" opacity=".55" />
    </>,
  );

/** מד מהירות — דאשבורד */
export const IcGauge = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M32 10a26 26 0 0 1 26 26c0 7-3 13-7 18H13c-4-5-7-11-7-18a26 26 0 0 1 26-26Zm0 8a18 18 0 0 0-18 18c0 4 1 8 4 11h28c3-3 4-7 4-11a18 18 0 0 0-18-18Z" opacity=".55" />
      <path d="M32 22a3 3 0 0 1 3 3v2a3 3 0 0 1-6 0v-2a3 3 0 0 1 3-3Zm-13 11a3 3 0 1 1 4-4l1.5 1.5a3 3 0 1 1-4 4Zm26 0-1.5 1.5a3 3 0 1 1-4-4l1.5-1.5a3 3 0 1 1 4 4Z" />
      <path d="M44 24 35 43a4.5 4.5 0 1 1-5-2Z" />
    </>,
  );

/** מחסום — פתיחת שערים */
export const IcBarrier = ({ size }: P) =>
  svg(
    size,
    <>
      <rect x="6" y="36" width="12" height="24" rx="2" opacity=".55" />
      <circle cx="12" cy="36" r="7" />
      <path d="M14 31 52 8l5 7-38 23Z" />
      <path d="M22 26l4 6 6-3.6-4-6Zm13-8 4 6 6-3.6-4-6Z" fill="#000" opacity=".45" />
    </>,
  );

/** ברז כיבוי — כלי עזר */
export const IcHydrant = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M26 6h12l4 8H22Z" />
      <path d="M20 14h24v6H20Z" opacity=".55" />
      <path d="M22 20h20v34H22Z" />
      <path d="M12 28h10v8H12a4 4 0 0 1 0-8Zm30 0h10a4 4 0 0 1 0 8H42Z" opacity=".55" />
      <circle cx="32" cy="32" r="4" fill="#000" opacity=".4" />
      <path d="M26 42h12v3H26Z" fill="#000" opacity=".4" />
      <path d="M16 54h32v6H16Z" opacity=".55" />
    </>,
  );

/** שומרים על השמות הישנים כדי שהמסכים הפנימיים ימשיכו לעבוד */
export const IcCalendar = IcFlame;
export const IcCrew = IcHelmet;
export const IcTools = IcWrenchCheck;
export const IcRadio = IcWalkie;
export const IcSkull = IcHazard;
export const IcChart = IcGauge;
export const IcGate = IcBarrier;
export const IcToolbox = IcHydrant;

/** לוח שנה קטן — לבדיקות תקופתיות */
export const IcCalendarSmall = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M12 13h40a4 4 0 0 1 4 4v38a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V17a4 4 0 0 1 4-4Zm0 14v26h40V27Z" />
      <rect x="18" y="6" width="5" height="12" rx="2.5" opacity=".55" />
      <rect x="41" y="6" width="5" height="12" rx="2.5" opacity=".55" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={19 + c * 10} y={32 + r * 7} width="5" height="4" rx="1" />))}
    </>,
  );

/** בדיקה תקופתית: מפתח + לוח שנה קטן */
export const IcToolsCal = ({ size, star }: P & { star?: boolean }) => (
  <span className="mdt-ic-combo">
    <IcWrenchCheck size={size} />
    <span className="mdt-ic-mini">
      <IcCalendarSmall size={(size ?? 56) * 0.42} />
      {star && <b>★</b>}
    </span>
  </span>
);

/** תקלות פתוחות — משולש אזהרה */
export const IcClipboard = ({ size }: P) =>
  svg(
    size,
    <>
      <path d="M32 6 61 56H3Z" />
      <path d="M32 22a3.5 3.5 0 0 1 3.5 3.5l-1.2 13a2.3 2.3 0 0 1-4.6 0l-1.2-13A3.5 3.5 0 0 1 32 22Zm0 21a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" fill="#000" opacity=".55" />
    </>,
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
    <path d="M32 4 44 9v12c0 10-5 18-12 22-7-4-12-12-12-22V9Z" fill="#ffb020" />
    <path d="M32 10l7 3v8c0 6-3 11-7 14-4-3-7-8-7-14v-8Z" fill="#c77800" />
    {[0, 1, 2].map((i) => (
      <g key={i} fill="#ffb020">
        <path d={`M${18 - i * 5} ${12 + i * 7}h-${10 - i * 2}l3 5h${9 - i * 2}Z`} />
        <path d={`M${46 + i * 5} ${12 + i * 7}h${10 - i * 2}l-3 5h-${9 - i * 2}Z`} />
      </g>
    ))}
  </svg>
);

export const IcWheel = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#c9d3de" strokeWidth="2.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.4" fill="#c9d3de" />
    <path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21" />
  </svg>
);

/** סימן מים ברקע — מגן עם להבה (גנרי, לא הסמל הרשמי) */
export const Watermark = () => (
  <svg width="560" height="560" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="5" aria-hidden="true">
    <path d="M100 28 152 46v44c0 38-22 66-52 80-30-14-52-42-52-80V46Z" />
    <path d="M100 52c10 14 22 24 22 44a22 22 0 0 1-44 0c0-10 4-16 9-22 0 8 4 12 8 12-2-12 0-24 5-34Z" fill="currentColor" stroke="none" />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <ellipse cx={34 - i * 3} cy={70 + i * 22} rx="9" ry="4" transform={`rotate(${-50 + i * 14} ${34 - i * 3} ${70 + i * 22})`} fill="currentColor" stroke="none" />
        <ellipse cx={166 + i * 3} cy={70 + i * 22} rx="9" ry="4" transform={`rotate(${50 - i * 14} ${166 + i * 3} ${70 + i * 22})`} fill="currentColor" stroke="none" />
      </g>
    ))}
  </svg>
);
