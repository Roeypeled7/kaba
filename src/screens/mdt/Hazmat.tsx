import { useState } from 'react';
import { INCIDENT_TYPE } from '../../engine/config';
import type { Ctx } from './shared';

interface Mat {
  un: string;
  name: string;
  en: string;
  /** סיווג ראשי + משני */
  cls: string;
  sub?: string;
  /** קוד סיכון (לוח כתום, שורה עליונה) */
  kemler: string;
  /** מדריך ERG */
  guide: string;
  /** בידוד ראשוני במטרים */
  iso: number;
  hz: string;
  ext: string;
}

/** מאגר מקוצר לתרגול — לא תחליף לספר החומ״ס / ERG */
const MATS: Mat[] = [
  { un: '1005', name: 'אמוניה נטולת מים', en: 'Ammonia, anhydrous', cls: '2.3', sub: '8', kemler: '268', guide: '125', iso: 100, hz: 'גז רעיל ומאכל, קל מהאוויר. נוזל גורם לכוויות קור.', ext: 'ריסוס מים לדיכוי הענן ממרחק. לא להתיז מים על נוזל דולף.' },
  { un: '1017', name: 'כלור', en: 'Chlorine', cls: '2.3', sub: '5.1 · 8', kemler: '265', guide: '124', iso: 100, hz: 'גז רעיל מאוד ומחמצן, כבד מהאוויר — מצטבר בשקעים ובמרתפים.', ext: 'לא להתיז מים על מקור הדליפה. ריסוס מים להורדת ענן בלבד.' },
  { un: '1075', name: 'גפ״מ (גז בישול)', en: 'Petroleum gases, liquefied', cls: '2.1', kemler: '23', guide: '115', iso: 100, hz: 'גז דליק מאוד, כבד מהאוויר. סכנת BLEVE במיכל חשוף לאש.', ext: 'לא לכבות להבה של דליפה אם אי אפשר לעצור אותה. קירור מיכלים בכמויות מים גדולות.' },
  { un: '1978', name: 'פרופאן', en: 'Propane', cls: '2.1', kemler: '23', guide: '115', iso: 100, hz: 'גז דליק, כבד מהאוויר.', ext: 'עצירת הדליפה; קירור מיכלים ממחסה.' },
  { un: '1971', name: 'גז טבעי דחוס', en: 'Natural gas, compressed', cls: '2.1', kemler: '23', guide: '115', iso: 100, hz: 'גז דליק, קל מהאוויר.', ext: 'עצירת הדליפה; קירור מיכלים.' },
  { un: '1001', name: 'אצטילן מומס', en: 'Acetylene, dissolved', cls: '2.1', kemler: '239', guide: '116', iso: 100, hz: 'דליק מאוד ועלול להתפרק בפיצוץ. בלון שחומם נשאר מסוכן שעות.', ext: 'קירור הבלון במים ממחסה לאורך זמן.' },
  { un: '1049', name: 'מימן דחוס', en: 'Hydrogen, compressed', cls: '2.1', kemler: '23', guide: '115', iso: 100, hz: 'דליק מאוד; להבה כמעט בלתי נראית ביום.', ext: 'עצירת הדליפה; קירור מיכלים.' },
  { un: '1072', name: 'חמצן דחוס', en: 'Oxygen, compressed', cls: '2.2', sub: '5.1', kemler: '25', guide: '122', iso: 100, hz: 'מחמצן — מגביר מאוד בעירה של חומרים אחרים.', ext: 'מים בכמות גדולה; הרחקת חומרים דליקים ושמנים.' },
  { un: '1073', name: 'חמצן נוזלי בקירור', en: 'Oxygen, refrigerated liquid', cls: '2.2', sub: '5.1', kemler: '225', guide: '122', iso: 100, hz: 'מחמצן חזק וקריוגני — כוויות קור.', ext: 'לא להתיז מים על הנוזל.' },
  { un: '1066', name: 'חנקן דחוס', en: 'Nitrogen, compressed', cls: '2.2', kemler: '20', guide: '121', iso: 100, hz: 'גז חונק — דוחק חמצן בחללים סגורים.', ext: 'אוורור. ניטור חמצן לפני כניסה.' },
  { un: '1977', name: 'חנקן נוזלי בקירור', en: 'Nitrogen, refrigerated liquid', cls: '2.2', kemler: '22', guide: '120', iso: 100, hz: 'קריוגני וחונק.', ext: 'לא להתיז מים על הנוזל.' },
  { un: '1013', name: 'פחמן דו-חמצני', en: 'Carbon dioxide', cls: '2.2', kemler: '20', guide: '120', iso: 100, hz: 'חונק, כבד מהאוויר — מצטבר בבורות ובמרתפים.', ext: 'אוורור; ניטור חמצן לפני כניסה.' },
  { un: '1203', name: 'בנזין', en: 'Gasoline', cls: '3', kemler: '33', guide: '128', iso: 50, hz: 'נוזל דליק מאוד; אדים כבדים מהאוויר נעים למרחק ונדלקים.', ext: 'קצף AFFF / אבקה / CO₂. מים — לקירור בלבד.' },
  { un: '1202', name: 'סולר', en: 'Diesel fuel', cls: '3', kemler: '30', guide: '128', iso: 50, hz: 'נוזל דליק.', ext: 'קצף / אבקה / ריסוס מים.' },
  { un: '1090', name: 'אצטון', en: 'Acetone', cls: '3', kemler: '33', guide: '127', iso: 50, hz: 'נוזל דליק מאוד, מתערבב במים.', ext: 'קצף עמיד לאלכוהול (AR) / אבקה / CO₂.' },
  { un: '1230', name: 'מתנול', en: 'Methanol', cls: '3', sub: '6.1', kemler: '336', guide: '131', iso: 50, hz: 'דליק ורעיל; להבה כמעט שקופה ביום.', ext: 'קצף AR / אבקה / CO₂.' },
  { un: '1170', name: 'אתנול', en: 'Ethanol', cls: '3', kemler: '33', guide: '127', iso: 50, hz: 'נוזל דליק, מתערבב במים.', ext: 'קצף AR / אבקה / CO₂.' },
  { un: '1830', name: 'חומצה גופרתית', en: 'Sulphuric acid', cls: '8', kemler: '80', guide: '137', iso: 50, hz: 'מאכלת חזקה; מגיבה באלימות עם מים ומשחררת חום.', ext: 'לא להתיז מים ישירות על החומר. ספיחה בחול/אדמה.' },
  { un: '1789', name: 'חומצה מלחית', en: 'Hydrochloric acid', cls: '8', kemler: '80', guide: '157', iso: 50, hz: 'מאכלת; משחררת אדים מגרים.', ext: 'ריסוס מים להורדת אדים; סכירה.' },
  { un: '1824', name: 'נתרן הידרוקסידי, תמיסה', en: 'Sodium hydroxide solution', cls: '8', kemler: '80', guide: '154', iso: 50, hz: 'מאכל — כוויות כימיות בעור ובעיניים.', ext: 'לפי הסביבה; ספיחה בחומר אינרטי.' },
  { un: '1052', name: 'מימן פלואורי נטול מים', en: 'Hydrogen fluoride, anhydrous', cls: '8', sub: '6.1', kemler: '886', guide: '125', iso: 100, hz: 'מאכל ורעיל ביותר; חודר עור ופוגע בעצמות.', ext: 'ריסוס מים לדיכוי אדים בלבד.' },
  { un: '2014', name: 'מי חמצן 20%–60%', en: 'Hydrogen peroxide, aqueous solution', cls: '5.1', sub: '8', kemler: '58', guide: '140', iso: 50, hz: 'מחמצן ומאכל; מגביר בעירה, מתפרק בחום.', ext: 'מים בלבד, בכמויות גדולות.' },
  { un: '3082', name: 'חומר מסוכן לסביבה, נוזל', en: 'Environmentally hazardous substance, liquid, n.o.s.', cls: '9', kemler: '90', guide: '171', iso: 50, hz: 'מזהם — למנוע חדירה לביוב ולמקורות מים.', ext: 'לפי החומר; סכירה ואיסוף.' },
];

const CLS_COLOR: Record<string, string> = { '2.1': '#e53935', '2.2': '#2e7d32', '2.3': '#fafafa', '3': '#e53935', '5.1': '#fdd835', '6.1': '#fafafa', '8': '#212121', '9': '#fafafa' };

function Diamond({ cls }: { cls: string }) {
  const bg = CLS_COLOR[cls] ?? '#eee';
  const dark = bg === '#fafafa' || bg === '#fdd835';
  return (
    <span className={`mdt-diamond ${cls === '8' ? 'corr' : ''}`} style={{ background: bg, color: dark ? '#111' : '#fff' }}>
      <b>{cls}</b>
    </span>
  );
}

export default function Hazmat({ state, v }: Ctx) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Mat>(MATS[0]);
  const s = q.trim().toLowerCase();
  const list = MATS.filter((m) => !s || m.un.includes(s) || m.kemler.includes(s) || m.name.includes(q.trim()) || m.en.toLowerCase().includes(s));
  const inc = state.incidents.find((i) => i.id === v.incidentId);

  return (
    <div className="mdt-page">
      {inc?.typeKey === 'hazmat' && (
        <div className="mdt-banner amber">
          {INCIDENT_TYPE.hazmat.icon} אירוע חומ״ס פעיל — {inc.address}. זהו את החומר לפי הלוח הכתום (מספר UN בשורה התחתונה) והתקרבו עם הרוח בגב.
        </div>
      )}
      <div className="mdt-split">
        <section className="mdt-panel side">
          <input className="mdt-input dark" placeholder="חיפוש: מספר UN, קוד סיכון או שם" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mdt-scroll mdt-hz-list">
            {list.map((m) => (
              <button key={m.un} className={sel.un === m.un ? 'on' : ''} onClick={() => setSel(m)}>
                <span className="mono">UN {m.un}</span>
                <span className="grow">{m.name}</span>
                <span className="mono dim">{m.cls}</span>
              </button>
            ))}
            {!list.length && <div className="mdt-empty">לא נמצא חומר במאגר המקוצר</div>}
          </div>
        </section>
        <section className="mdt-panel grow mdt-hz">
          <div className="mdt-hz-top">
            <div className="mdt-orange mono">
              <span>{sel.kemler}</span>
              <span>{sel.un}</span>
            </div>
            <div className="grow">
              <h2>{sel.name}</h2>
              <div className="dim">{sel.en}</div>
            </div>
            <Diamond cls={sel.cls} />
          </div>
          <div className="mdt-hz-grid">
            <div>
              <span>סיווג</span>
              <b>
                {sel.cls}
                {sel.sub && <small> (משני {sel.sub})</small>}
              </b>
            </div>
            <div>
              <span>קוד סיכון</span>
              <b className="mono">{sel.kemler}</b>
            </div>
            <div>
              <span>מדריך ERG</span>
              <b className="mono">{sel.guide}</b>
            </div>
            <div className="hot">
              <span>בידוד ראשוני</span>
              <b>
                <span className="mono">{sel.iso}</span> מ׳ לכל כיוון
              </b>
            </div>
          </div>
          <div className="mdt-hz-txt">
            <h4>סכנות</h4>
            <p>{sel.hz}</p>
            <h4>כיבוי וטיפול</h4>
            <p>{sel.ext}</p>
            <h4>מיגון</h4>
            <p>{sel.cls === '2.3' || sel.sub?.includes('6.1') || sel.cls === '8' ? 'חליפה כימית מלאה + מכשיר נשימה. כניסה רק בצוות חומ״ס.' : 'ביגוד מגן מלא ומכשיר נשימה. להתקרב עם הרוח בגב ומגובה.'}</p>
          </div>
          <div className="mdt-hz-foot">מאגר מקוצר לתרגול בהדמיה — באירוע אמיתי לאמת מול ספר החומ״ס / ERG ומוקד חומ״ס.</div>
        </section>
      </div>
    </div>
  );
}
