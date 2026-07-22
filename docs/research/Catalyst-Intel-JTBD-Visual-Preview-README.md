# Catalyst Intel — JTBD Visual Design Preview

Design-only deliverables for review. **Not** shipped to the Next.js app. No PR / no deploy.

## Files

| File                                                               | Purpose                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `C:\Users\user\Downloads\Catalyst-Intel-JTBD-Visual-Preview.png`   | Annotated collage sketch of all five JTBDs (charcoal / steel blue / amber desk aesthetic) |
| `C:\Users\user\Downloads\Catalyst-Intel-JTBD-Tape-Screen.png`      | Optional: Live tape (JTBD 1+3)                                                            |
| `C:\Users\user\Downloads\Catalyst-Intel-JTBD-Watchlist-Screen.png` | Optional: Quiet watchlist (JTBD 2)                                                        |
| `C:\Users\user\Downloads\Catalyst-Intel-JTBD-Alerts-Screen.png`    | Optional: Away alerts (JTBD 4)                                                            |
| `C:\Users\user\Downloads\Catalyst-Intel-JTBD-Drawer-Screen.png`    | Optional: Detail drawer + historical coming soon (JTBD 5)                                 |
| `C:\Users\user\Downloads\catalyst-intel-jtbd-mock\index.html`      | Self-contained browsable HTML mock                                                        |
| This README                                                        | Screen → JTBD map                                                                         |

Open the HTML in any browser (double-click or drag into Chrome/Edge). Use the top JTBD pills or the left nav to switch screens.

---

## Screen → JTBD map

### Live tape (`#tape`) — JTBD 1 + JTBD 3

- **JTBD 1 — Filing hits → Act / Dismiss**  
  Blotter rows show **Ticker | Event | Impact | Title | Proof | Time** with amber/steel materiality badges and **Act** / **Dismiss** actions so a trader can triage in seconds.
- **JTBD 3 — Headline → one-click EDGAR proof**  
  Each row’s **EDGAR ↗** proof link simulates opening the filing accession (toast + drawer snippet). Click a row (or Act) to open the detail drawer with the proof excerpt.

### Quiet watchlist (`#watchlist`) — JTBD 2

- **JTBD 2 — Quiet watchlist → only playbook-matching catalysts**  
  Sparse blotter: only NVDA / TSLA / MRK remain; AMZN officer change and routine JPM 10-Q are called out as suppressed. Playbook category chips and “noise suppressed” stats reinforce the quiet desk.

### Away alerts (`#alerts`) — JTBD 4

- **JTBD 4 — Away → push / email / webhook on rules**  
  Rule cards with channel toggles (Push / Email / Webhook) for high-impact watchlist hits, 13D/13G mega-cap, and after-hours earnings 8-Ks.

### Detail drawer (`#drawer` or click a tape row) — JTBD 5 (+ 1 & 3)

- **JTBD 5 — Historical reaction context (later)**  
  Bottom of the drawer shows a ghosted reaction chart with a **Coming soon** badge. Prior event → price/vol context is designed but not built.
- Drawer also restates JTBD 1 actions and JTBD 3 EDGAR proof for the selected filing.

---

## Visual language

- **Charcoal** desk (`#0b111a` / `#111821`) — trader blotter, not purple SaaS
- **Steel blue** (`#4f8fd9`) — links, nav active, secondary badges
- **Amber** (`#f0c14b`) — live pulse, HIGH impact, primary Act CTA

---

## How to review

1. Open the PNG for a single-glance annotated overview.
2. Open `index.html` and click through **JTBD 1+3 Tape → Quiet → Alerts → Drawer**.
3. Click **EDGAR ↗**, **Act**, and **Dismiss** to feel the triage loop.
