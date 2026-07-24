#!/usr/bin/env python3
"""Generate ENGINEER-UX-UI-GUIDE-HE.pdf — Hebrew RTL UX/UI guide for engineers.

Requires: fpdf2, uharfbuzz
  pip install fpdf2 uharfbuzz

Uses a Windows Hebrew-capable font (Arial by default).
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

ROOT = Path(__file__).resolve().parents[1]  # docs/research
OUT = ROOT / "pdf" / "ENGINEER-UX-UI-GUIDE-HE.pdf"

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\arial.ttf"),
    Path(r"C:\Windows\Fonts\tahoma.ttf"),
    Path(r"C:\Windows\Fonts\david.ttf"),
]
FONT_BOLD_CANDIDATES = [
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    Path(r"C:\Windows\Fonts\tahomabd.ttf"),
    Path(r"C:\Windows\Fonts\davidbd.ttf"),
]


def pick_font(candidates: list[Path]) -> Path:
    for p in candidates:
        if p.is_file():
            return p
    raise FileNotFoundError(
        "No Hebrew-capable TTF found. Install Arial/Tahoma/David or edit FONT_CANDIDATES."
    )


class GuidePDF(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("He", "", 8)
        self.set_text_color(110, 110, 110)
        self.cell(0, 8, f"{self.page_no()}", align="C")


def rtl(pdf: GuidePDF) -> None:
    pdf.set_text_shaping(True, direction="rtl", script="hebr", language="heb")


def h1(pdf: GuidePDF, text: str) -> None:
    pdf.ln(4)
    pdf.set_font("He", "B", 16)
    pdf.set_text_color(20, 20, 20)
    pdf.multi_cell(0, 9, text, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_draw_color(240, 193, 75)  # amber desk accent
    y = pdf.get_y()
    pdf.set_line_width(0.6)
    pdf.line(pdf.l_margin, y + 1, pdf.w - pdf.r_margin, y + 1)
    pdf.ln(4)


def h2(pdf: GuidePDF, text: str) -> None:
    pdf.ln(2)
    pdf.set_font("He", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 7, text, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)


def body(pdf: GuidePDF, text: str) -> None:
    pdf.set_font("He", "", 10.5)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(0, 6.2, text, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def bullet(pdf: GuidePDF, text: str) -> None:
    pdf.set_font("He", "", 10.5)
    pdf.set_text_color(35, 35, 35)
    # Leading bullet sits at the start of the RTL visual line
    pdf.multi_cell(0, 6.2, f"• {text}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def numbered(pdf: GuidePDF, n: int, text: str) -> None:
    pdf.set_font("He", "", 10.5)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(
        0, 6.2, f"{n}. {text}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT
    )


def callout(pdf: GuidePDF, text: str) -> None:
    pdf.ln(1)
    pdf.set_fill_color(248, 246, 240)
    pdf.set_draw_color(200, 200, 200)
    pdf.set_font("He", "B", 10.5)
    pdf.set_text_color(40, 40, 40)
    x = pdf.l_margin
    w = pdf.epw
    # Estimate height with a dry multi_cell in a temp approach: use multi_cell with fill
    pdf.multi_cell(
        w,
        6.5,
        text,
        border=1,
        align="R",
        fill=True,
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.ln(2)


def build() -> Path:
    regular = pick_font(FONT_CANDIDATES)
    bold = pick_font(FONT_BOLD_CANDIDATES)

    pdf = GuidePDF(format="A4")
    pdf.set_margins(16, 16, 16)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font("He", "", str(regular))
    pdf.add_font("He", "B", str(bold))
    pdf.add_page()
    rtl(pdf)

    # —— Cover ——
    pdf.set_font("He", "B", 22)
    pdf.set_text_color(15, 15, 15)
    pdf.multi_cell(
        0,
        11,
        "Catalyst Intel",
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.set_font("He", "B", 18)
    pdf.multi_cell(
        0,
        10,
        "מדריך UX / UI למהנדסי תוכנה",
        align="R",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.ln(2)
    pdf.set_font("He", "", 11)
    pdf.set_text_color(70, 70, 70)
    body(
        pdf,
        "מסמך מעשי לשינוי ממשק האפליקציה. מי המשתמש, מה כל מסך צריך לעשות, "
        "מה לבנות, ומה לא לבנות. שפה פשוטה — מספיק ספציפית ליישום.",
    )
    callout(
        pdf,
        "כלל האמת: מקור → סיפור → ציון → הצעה  |  אף פעם לא להיפך",
    )
    body(
        pdf,
        "סוג מוצר: שולחן קטליסטים (חדשות / דיווחים) לסוחרים — לא מגזין חדשות ולא טרמינל Bloomberg.",
    )
    body(
        pdf,
        "מבוסס על: ENGINEER-UX-UI-GUIDE-SIMPLE.md + ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md "
        "(סינתזה יולי 2026).",
    )

    # —— 1 Who ——
    h1(pdf, "1. מי המשתמש")
    body(
        pdf,
        "בונים לסוחרי אירועים (event traders) — לא לסורקי גרפים, לא לדסק אופציות-פלואו, "
        "ולא לחוקרי לטווח ארוך פסיביים.",
    )

    h2(pdf, "מרקוס — סוחר יום סביב קטליסטים")
    bullet(pdf, "סוחר גאפים, אחרי שעות, ושעה ראשונה")
    bullet(pdf, "צריך טריאז' מהיר במסך אחד")
    bullet(pdf, "צריך Quiet mode אחרי שהפתיחה מתייצבת")

    h2(pdf, "פרייה — מומחית אירועים")
    bullet(pdf, "סוחרת דיווחים, FDA, M&A עם הוכחה")
    bullet(pdf, "צריכה תוויות אירוע ברורות (במיוחד פריטי 8-K)")
    bullet(pdf, "המקור המקורי בלחיצה אחת")

    h2(pdf, "אלנה — סווינג סביב חדשות")
    bullet(pdf, "מחזיקה שעות עד ימים סביב אירועים מהותיים")
    bullet(pdf, "צריכה התראות watchlist חזקות")
    bullet(pdf, "פחות רעש באמצע היום")

    h2(pdf, "העבודה (JTBD)")
    body(pdf, "כשדיווח או אירוע מזיז-שוק נוחת:")
    numbered(pdf, 1, "להבין מה זה")
    numbered(pdf, 2, "להבין למה זה חשוב")
    numbered(pdf, 3, "לדעת אם זה מתאים לפלייבוק שלי")
    numbered(pdf, 4, "ואז Act או Dismiss")

    h2(pdf, "לא המשתמש שלנו (כרגע)")
    bullet(pdf, "מחקר פסיבי לטווח ארוך")
    bullet(pdf, "אופציות-פלואו בלבד")
    bullet(pdf, "סורקי טכני בלבד")
    bullet(pdf, "קוני תחליף Bloomberg")
    bullet(pdf, "משתמשי קריפטו-תחילה / «כל החדשות»")

    # —— 2 Screens ——
    h1(pdf, "2. מסכים")
    body(pdf, "סדר ניווט: Feed → Watchlists → Alerts → Archive (מאוחר יותר) → Admin (רק ops)")

    h2(pdf, "Feed — /dashboard")
    bullet(pdf, "המסך הראשון אחרי התחברות")
    bullet(pdf, "טייפ חי של קטליסטים")
    bullet(pdf, "Soft-poll. להציג Last updated")
    bullet(pdf, "אף פעם לא לזייף מהירות «wire מיידי»")

    h2(pdf, "מאמר — /dashboard/catalyst/[id]")
    bullet(pdf, "קריאה בתוך האפליקציה (Read)")
    bullet(pdf, "להבין את האירוע")
    bullet(pdf, "המקור המקורי משני (טאב חדש)")

    h2(pdf, "Watchlist — /watchlist")
    bullet(pdf, "טיקרים + קטגוריות פלייבוק")
    bullet(pdf, "מזין את Quiet mode בפיד")

    h2(pdf, "Alerts — /alerts")
    bullet(pdf, "כשלא ליד השולחן")
    bullet(pdf, "Webhook / אימייל עכשיו; Push בהמשך")

    h2(pdf, "Admin — /admin")
    bullet(pdf, "רק ops ברשימת allowlist")
    bullet(pdf, "כלי fetch / ingest")
    bullet(pdf, "להשאיר מחוץ למסך הראשון של הסוחר")

    # —— 3 Feed ——
    h1(pdf, "3. הפיד (Feed)")
    h2(pdf, "עמודות בדסקטופ (נוכחי) — לא להמציא סדר חדש בלי מוצר")
    numbered(pdf, 1, "Title — כותרת")
    numbered(pdf, 2, "Time — מתי קרה האירוע (שעון מזרח ET)")
    numbered(pdf, 3, "Event — תווית סוג (פריט 8-K, halt, FDA…)")
    numbered(pdf, 4, "Ticker — סימול")
    numbered(pdf, 5, "Action — Read / Act / Dismiss / Quiet")

    h2(pdf, "Title")
    bullet(pdf, "להעדיף headline; אחרת כותרת דיווח")
    bullet(pdf, "שם המקור יכול לשבת מתחת לכותרת בטקסט קטן")

    h2(pdf, "Time")
    bullet(pdf, "זמן אירוע ב-ET")
    bullet(pdf, "מספרים טבלאיים (tabular-nums)")
    bullet(pdf, "אף פעם לא להציג זמן insert ל-DB כזמן האירוע")

    h2(pdf, "Event")
    bullet(pdf, "התווית הספציפית ביותר שיש")
    bullet(pdf, "העדפה: subcategory → type → category")
    bullet(pdf, "תוויות מ-taxonomy.ts (CATEGORY_LABELS)")
    bullet(
        pdf,
        "דוגמאות חשובות: Earnings, פריטי 8-K, Trading Halt, Regulatory / FDA, Insider (Form 4), Macro",
    )

    h2(pdf, "פילטרים לשמור")
    bullet(pdf, "חיפוש טיקר / חברה")
    bullet(pdf, "חלון זמן: 1h / 4h / 24h / All")
    bullet(pdf, "צ'יפים של קטגוריה")
    bullet(pdf, "מתג Quiet playbook")

    h2(pdf, "מיון וצפיפות")
    bullet(pdf, "ברירת מחדל: האירוע החדש ביותר קודם")
    bullet(pdf, "שורות, לא כרטיסים — blotter צפוף")
    bullet(pdf, "בלי hero שיווקי מעל הטייפ")
    bullet(pdf, "שורות חדשות יכולות להבהב בקצרה")

    h2(pdf, "מובייל")
    bullet(pdf, "מתחת ל-Title לערום: Time → Event → Ticker")
    bullet(pdf, "כפתורי פעולה תמיד גלויים")
    bullet(pdf, "לא להסתמך על hover")

    # —— 4 Actions ——
    h1(pdf, "4. פעולות בשורה")
    body(pdf, "כל שורת פיד צריכה ארבע פעולות אלה:")

    h2(pdf, "Read")
    bullet(pdf, "פותח את המאמר בתוך האפליקציה")
    bullet(pdf, "נתיב הקריאה העמוקה הראשי")

    h2(pdf, "Act")
    bullet(pdf, "פותח מגירת פרטים מהירה (drawer)")
    bullet(pdf, "לא משנה את מסד הנתונים — טריאז' בלבד")

    h2(pdf, "Dismiss")
    bullet(pdf, "מסתיר את השורה בדפדפן הזה")
    bullet(pdf, "זוכר ~200 מזהים אחרונים מקומית (localStorage)")
    bullet(pdf, "לא מוחק את השורה מה-DB")

    h2(pdf, "Quiet")
    bullet(pdf, "מוסיף את הטיקר ל-quiet watchlist")
    bullet(pdf, "להסתיר את הכפתור אם אין טיקר")
    bullet(pdf, "לנטרל אם כבר ברשימה")

    h2(pdf, "Proof / מקור מקורי")
    bullet(pdf, "נפתח בטאב חדש")
    bullet(pdf, "אף פעם לא מחליף את הקורא הפנימי")
    bullet(pdf, "אם אין קישור — מצב מושתק «אין קישור»; לא להסתיר את הבקרה")

    h2(pdf, "Quiet playbook (מתג בכותרת)")
    bullet(pdf, "On + watchlist מלאה → רק הטיקרים האלה בקטגוריות הפלייבוק")
    bullet(pdf, "On + watchlist ריקה → רק קטגוריות הפלייבוק")
    bullet(pdf, "Off → רק הפילטרים הרגילים")

    # —— 5 Article ——
    h1(pdf, "5. עמוד מאמר")
    body(pdf, "לבנות את העמוד בסדר הזה:")
    numbered(pdf, 1, "חזרה ל-Live tape")
    numbered(pdf, 2, "טיקר גדול")
    numbered(pdf, 3, "קטגוריה + מהותיות (materiality)")
    numbered(pdf, 4, "כותרת + חברה")
    numbered(pdf, 5, "WHY IT'S MOVING — שורה אחת (WIIM)")
    numbered(pdf, 6, "מטא: provider · category · type · time")
    numbered(pdf, 7, "Summary כ-3 בולטים קצרים")
    numbered(pdf, 8, "עובדות מפורטות (EPS, הכנסות…) כשיש")
    numbered(pdf, 9, "גוף המאמר")
    numbered(pdf, 10, "פריטי דיווח / תגיות")
    numbered(pdf, 11, "Original source ככפתור משני")

    h2(pdf, "חובה")
    bullet(pdf, "טיקר קודם")
    bullet(pdf, "WIIM מעל הסיכום הארוך")
    bullet(pdf, "בולטים עדיפים על פרוזה ארוכה")
    bullet(pdf, "לטקסט להיות מעוגן בנתוני מקור שמורים")
    bullet(pdf, "enrichment (ציטוט / related) נכשל ברכות — לא לחסום את העמוד")

    h2(pdf, "אסור")
    bullet(pdf, "תמונת hero בסגנון מגזין")
    bullet(pdf, "כרום ירוק/אדום רועש בכל מקום")
    bullet(pdf, "מספרי מחיר היסטוריים מזויפים")
    bullet(pdf, "iframe לאתרי חדשות אקראיים")

    h2(pdf, "תגובה היסטורית")
    bullet(pdf, "כרגע placeholder בלבד — «coming soon»")
    bullet(pdf, "בלי מספרי תנועה קודמת מזויפים")

    # —— 6 Look ——
    h1(pdf, "6. מראה ותחושה")
    h2(pdf, "גופנים")
    bullet(pdf, "Inter — גוף ו-UI")
    bullet(pdf, "Roboto — כותרות")
    bullet(pdf, "מספרים טבלאיים לזמנים, מחירים, טיקרים (font-mono)")
    body(pdf, "קבצים: src/app/layout.tsx, src/app/globals.css")

    h2(pdf, "צבע")
    bullet(pdf, "שולחן שחור-לבן (mono desk)")
    bullet(pdf, "ענבר (amber) רק ל-live / high / פעולות ראשיות")
    bullet(pdf, "ניגודיות גבוהה בכותרות")
    bullet(pdf, "טקסט מעומעם רק למטא (מקור, תגיות)")

    h2(pdf, "לא להשתמש")
    bullet(pdf, "גרדיאנטים סגולים בסגנון SaaS")
    bullet(pdf, "מראה «AI» זוהר")
    bullet(pdf, "צבעי קשת לכל קטגוריה")
    bullet(pdf, "עור טרמינל ירוק/אדום מלא כברירת מחדל")

    h2(pdf, "ריק / טעינה / שגיאה")
    bullet(pdf, "פיד ריק → ריק כנה (אדמינים יכולים fetch)")
    bullet(pdf, "אין התאמות לפילטר → הודעה ברורה + איפוס")
    bullet(pdf, "Quiet ריק → הודעה ייעודית ל-Quiet")
    bullet(pdf, "טעינה → skeletons של שולחן, לא ספינרים צעקניים")
    bullet(pdf, "פיד מיושן → באנר חזק")
    bullet(pdf, "חסר Proof → stub מושתק; הבקרה נשארת")
    bullet(pdf, "AI למטה → נפילה לטקסט שמור; לא להמציא מספרים")

    h2(pdf, "דסקטופ מול מובייל")
    bullet(pdf, "דסקטופ = השולחן הראשי")
    bullet(pdf, "מובייל חייב לפתוח מאמר + proof")
    bullet(pdf, "מובייל חייב לקבל התראות / deep links")
    bullet(pdf, "לעולם לא להסתיר פעולות קריטיות מאחורי hover בטלפון")

    # —— 7 Do not build ——
    h1(pdf, "7. מה לא לבנות")
    body(pdf, "לדלג אלא אם מוצר מבקש במפורש:")
    bullet(pdf, "Charting מלא כליבת המוצר")
    bullet(pdf, "Broker / OMS / autotrader")
    bullet(pdf, "טרמינל אופציות-פלואו כליבה")
    bullet(pdf, "פריסת מגזין חדשות")
    bullet(pdf, "צ'אט קהילה כלולאה הראשית")
    bullet(pdf, "Squawk אודיו כ-v1")
    bullet(pdf, "טרמינל multi-asset בסגנון Bloomberg")
    bullet(pdf, "טענות «wire בזמן אמת» על poll/cron")
    bullet(pdf, "מספרי תגובה היסטורית מזויפים")
    bullet(pdf, "Prop SSO לפני שהשולחן דביק")

    # —— 8 Checklist ——
    h1(pdf, "8. צ'קליסט ליישום")
    body(pdf, "לעבוד בסדר הזה כשמשנים UX.")

    h2(pdf, "התמצאות")
    numbered(pdf, 1, "לנקוב בשם המשתמש (Marcus / Priya / Elena)")
    numbered(pdf, 2, "לנקוב במסך (Feed / Article / Watchlist / Alerts / Admin)")
    numbered(pdf, 3, "לבדוק ACCEPTANCE-JTBD.md לעבודה הרלוונטית")

    h2(pdf, "פיד")
    numbered(pdf, 4, "לשמור Title · Time · Event · Ticker · Action")
    numbered(pdf, 5, "זמן אירוע ב-ET עם tabular nums")
    numbered(pdf, 6, "לשמור פילטרים + מתג Quiet")
    numbered(pdf, 7, "Soft-poll + Last updated + כנות על stale")

    h2(pdf, "פעולות")
    numbered(pdf, 8, "Read → מאמר")
    numbered(pdf, 9, "Act → drawer (בלי כתיבה ל-DB)")
    numbered(pdf, 10, "Dismiss → הסתרה מקומית בלבד")
    numbered(pdf, 11, "Quiet → הוספת טיקר")
    numbered(pdf, 12, "Proof → טאב חדש")

    h2(pdf, "מאמר")
    numbered(pdf, 13, "טיקר קודם")
    numbered(pdf, 14, "WIIM בשורה אחת")
    numbered(pdf, 15, "שלושה בולטי סיכום")
    numbered(pdf, 16, "מקור מקורי משני")
    numbered(pdf, 17, "בלי מספרי היסטוריה מזויפים")

    h2(pdf, "מראה")
    numbered(pdf, 18, "Inter + Roboto + tabular nums")
    numbered(pdf, 19, "שולחן B&W + ענבר בלבד")
    numbered(pdf, 20, "ריק / טעינה / שגיאה מכוסים")
    numbered(pdf, 21, "פעולות מובייל גלויות בלי hover")

    h2(pdf, "שחרור")
    numbered(pdf, 22, "להריץ בדיקות JTBD על Preview של dev")
    numbered(pdf, 23, "ב-PR לציין בבירור מה בנוי מול מה שאפתני")
    numbered(pdf, 24, "אם משנים עמודות או פעולות — לעדכן את שני המדריכים")

    # —— End ——
    h1(pdf, "סיום")
    callout(
        pdf,
        "גרסה קצרה של המוצר: שולחן מסחר להחלטות על קטליסטים — לא צינור חדשות.",
    )
    body(
        pdf,
        "פירוט נוסף באנגלית: ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md · "
        "ENGINEER-UX-FEATURE-ROADMAP.md · ACCEPTANCE-JTBD.md",
    )
    body(
        pdf,
        f"גופן מוטמע במסמך זה: {regular.name} (+ bold). פריסה RTL בעברית.",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path} ({path.stat().st_size} bytes)")
