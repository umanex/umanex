# BACKLOG.md — jobradar

Kleine, afgebakende items die geen eigen briefing verdienen maar wel ergens moeten staan.
Een P3 die alleen in een auditrapport staat, verdwijnt met dat rapport.

Format: `- [ ] {type}: {wat} — {waarom} ({bron})`

## Open

- [ ] `infra`: De KBO-spiegel is **3,6 GB** (`.data/kbo.db`, extract 466) en de schijf stond
      bij het aanmaken op 99% vol (15 GiB vrij). `activity` is met 34.498.093 rijen veruit de
      grootste tabel, en daarvan zijn er 17.384.045 van NACE-versie 2003 (2.233.543) en 2008
      (15.150.502) — versies die de universum-query niet gebruikt. Snoeien halveert die tabel
      ruwweg. **Geen automatische winst:** de 2008→2025-hercodering is niet één-op-één, dus wie
      2008 weggooit kan een oudere referentie niet meer terugvertalen. Beslissing nodig, geen
      opruimactie. Exacte winst vraagt een `VACUUM` om te meten.
      (gemeten bij de eerste bootstrap, 2026-08-29)
- [ ] `refactor`: De **bron-richting** van `upsertLead` heeft geen productie-aanroeper meer.
      Met de externe leadbron weg passeert elke aanroep `{ afgeleid: true }`; de andere tak
      (`mergeBronSignalen` in `lib/signals.ts`) is daarmee onbereikbaar in productie. Niet
      meeverwijderd omdat `scripts/upsert-scenarios.ts` die richting als primitief gebruikt om
      leads met exacte signalen klaar te zetten — negen aanroepen, ook in scenario's die over
      dedupe en opruimen gaan. Weghalen betekent die suite herschrijven, en dat is een eigen
      taak met eigen risico, geen bijproduct van een opruiming.
      (gemeten bij het verwijderen van de KBO-leadbron, 2026-08-29)

## Verworpen

Met reden, want zonder reden komt hetzelfde voorstel over drie maanden terug en begint de
afweging van nul.

- `ux`: Signaalbadges gewicht geven — alle vier `variant="outline"` terwijl
  `dev-vacature zonder design` 30 punten weegt en `recente groei` 20.
  **Verworpen 2026-08-27** (Jeroen): niet doen. De leadscore-pil op dezelfde kaart draagt het
  gewicht al als getal; de badges zijn een opsomming van wat meetelde, geen rangschikking.
  (ux-audit 2026-08-11, P3)
- `ux`: "Min. score" ondubbelzinnig maken — het filtert op de vacaturescore bij Vacatures en op
  de leadscore bij Leads: twee schalen, één label.
  **Verworpen 2026-08-27** (Jeroen): niet doen. De app heeft één gebruiker, die beide assen kent;
  het label per tabblad laten verspringen kost meer dan het oplevert.
  (ux-audit 2026-08-11, P3)
- `test`: Flow-harness op meerdere viewportbreedtes laten renderen.
  **Verworpen 2026-08-27** (Jeroen): mobiel is voor jobradar geen doelwit. De app is een
  desktop-triagescherm; responsive gedrag hoeft niet geverifieerd te worden zolang dat zo blijft.
  Kantelt dat, dan is dit item de plek om te heropenen — Playwright kan de viewport wél zetten,
  dus de limiet uit de audit (het venster verkleinen liet `innerWidth` op 1417 staan) gold de
  browserautomatisering van toen, niet de harness van nu.
  (ux-audit 2026-08-11, limiet)

## Gebouwd

- `refactor`: `lib/sources/kbo.ts` en zijn fixtures waren dode code sinds het
  prospects-tabblad. **Verwijderd 2026-08-29** samen met `LEAD_SOURCES`, de `LeadSource`-
  interface en de externe-leadlus in de sync-route.

De vijf UX-items en de twee verificatie-items uit de ux-audit van 2026-08-11 zijn op
2026-08-27 afgehandeld: drie gebouwd, drie verworpen, één gebouwd als harness-uitbreiding.
Briefing: `briefings/2026-08-27-feature-jobradar-a11y-afronding.tcebc.md` aan de root.

- `ux`: Contrast van de `|`-scheiding in `CoverageBar.tsx` — `text-border` mat 1.24:1.
  **Gebouwd 2026-08-27:** `text-muted-foreground`, gemeten 4.97:1 in light en 7.32:1 in dark op
  de gerenderde DOM.
- `ux`: Kopstructuur sprong van h1 naar h3 — 1× h1, 327× h3, geen h2.
  **Gebouwd 2026-08-27:** een `sr-only` h2 per tabpaneel. Gemeten: `/` heeft 336 koppen,
  h1 → h2 → h3, nul overgeslagen niveaus. De harness bewaakt het nu per run.
- `ux`: Focus was inconsistent — drie vormen naast elkaar, en drie elementen met `outline-none`
  zonder vervanging (status-select, chip-invoer, status-select per kaart) waren zelfs
  focus-loos. **Gebouwd 2026-08-27:** één `focusRing`-constante in `@umanex/ui/lib/focus`,
  overal geconsumeerd. Gemeten: 96 tab-stops over twee routes, elk met zichtbare focus.
- `test`: Toetsenbordvolgorde en focusvolgorde ongemeten.
  **Gebouwd 2026-08-27:** een toetsenbord-pass in de flow-harness die de echte tab-volgorde
  afloopt en per stop differentieel meet of de focus zichtbaar is, met een tegenproef in
  `--selftest`. Dat is de "andere harness" uit dit item — Playwright krijgt `Tab` wél in de
  pagina.

## 2026-09-08 — score-pill: eigen rol `score/mid` bouwen (besluit is gevallen) · [design-system]

- **Wat:** De score-pill hangt aan `bg-warning` (Warning.700, bruin) sinds de contrastfix van
  2026-08-08. Het besluit viel op 2026-08-27: een **eigen rol**, geen bruin. De rol is gebouwd
  en gemeten maar bewust niet gemerged — `Semantic/light|dark → score/mid` (+ `-foreground`),
  Warning.500 met Neutral.900 respectievelijk Neutral.950 erop. Gemeten op een lokale build:
  `#F59F0B` met `#101828` = **8,32:1** in light, met `#0C111D` = **8,84:1** in dark. In dark
  verandert er feitelijk niets — `--warning` stond daar al op Warning.500.
- **Waarom niet nu:** `pnpm --filter @umanex/ui figma:check` eist een Figma-variabele per
  tokenrol en draait in CI, dus de rol vraagt éérst twee variabelen in de collectie `Theme` van
  **Component library** (`ko2OuasYxyY2YRD69MYhWX`) met Light/Dark-modes, plus een verse
  `figma/manifest.json`. Dat kan alleen met de Desktop Bridge op dát bestand.
- **Eerste zet:** Volgorde is dwingend: `score-mid` en `score-mid-foreground` in Figma →
  manifest verversen → `tokens.json` + `ScoreBadge.tsx` in één PR. Verplaatst uit `HANDOFF.md`
  (entry 2026-08-08) bij de sessie-reflectie van 2026-09-08 — 31 dagen open, besluit genomen,
  dus werk in plaats van sessie-context.
- **Check:** `grep -n "'warning'" apps/jobradar/components/ScoreBadge.tsx` — treffer = de pill
  hangt nog aan de generieke warning-rol; leeg = de eigen rol is er.
- **Status:** open
