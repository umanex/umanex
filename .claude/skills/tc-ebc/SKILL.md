---
name: tc-ebc
description: Schrijft een TC-EBC briefing (Task / Context / Elements / Behaviour / Constraints) voor een design- of prototype-taak, inclusief het stappenplan, de vier kritische items met hun vraag-formuleringen, en het bestandsformaat met acceptatie-checklist. Gebruik deze skill altijd wanneer je op het punt staat een TC-EBC te schrijven of bij te werken — dus bij elke design-, component-, scherm-, flow- of prototype-briefing, wanneer de TC-EBC-hook een design-taak signaleert, of wanneer de gebruiker zegt "maak een TC-EBC", "briefing", "schrijf de briefing uit".
---

## Wat deze skill is

De uitvoerings-helft van het TC-EBC werkprincipe. Het *principe* — wat TC-EBC is, wanneer het van toepassing is, de sanity check, en de main-agent-only rail — staat altijd geladen in `CLAUDE.md`. Deze skill bevat de procedure: hoe je er effectief één schrijft.

Harde rail uit `CLAUDE.md`, hier herhaald omdat hij het makkelijkst sneuvelt: de TC-EBC wordt geschreven in de **main agent context**, nooit uitbesteed aan een sub-agent. Deze skill lezen mag; hem laten uitvoeren door een sub-agent niet.

---

## Stappenplan

1. **Detecteer of de Task duidelijk is**
   - Task duidelijk → ga naar stap 2
   - Task onduidelijk (bv. "doe iets met die sidebar") → vraag eerst om verheldering. Maak nog geen bestand.

2. **Detecteer scope: één of meerdere taken?**
   - Eén coherent geheel → ga naar stap 3
   - Meerdere componenten of features → vraag: *"Wil je hier één TC-EBC voor het geheel, of aparte TC-EBC's per component?"*

3. **Bepaal type** (vaste set):
   - `component` — één UI primitive of compositie
   - `flow` — opeenvolging van schermen of stappen
   - `screen` — volledige pagina of view
   - `feature` — capability die meerdere componenten of schermen kruist
   - Bij twijfel: kies `component`

4. **Detecteer iteratie**
   - Als er al een TC-EBC bestand bestaat met dezelfde basis-naam (zelfde datum + naam), vraag: *"Update bestaand bestand of nieuw bestand?"*
   - Bij "nieuw": voeg `HHMM` suffix toe aan bestandsnaam

5. **Valideer kritische items**
   - Vier items die altijd opgevraagd moeten worden tenzij beantwoord in klant- of projectcontext
   - Voor elk niet-beantwoord item: zet op Open vragen lijst

6. **Schrijf het bestand** (zie locatie en naamgeving hieronder)

7. **Toon TC-EBC inline in chat** als codeblock met expliciete labels. Vermeld het bestandspad en eventuele open vragen. **Niet stilzwijgend overslaan** — gebruiker moet zien wat er is opgeslagen.

---

## Kritische items (altijd vragen tenzij beantwoord in klant/project context)

1. **Component-typologie** — sheet / dropdown / modal / aparte pagina / inline
2. **States** — loading / empty / error / success / default
3. **Interactie-modaliteit** — klik / swipe / drag / keyboard / hover
4. **Edge cases** — max waardes, min waardes, validatie regels

Andere items (mogen aanname zijn met `[ASSUMPTION: ...]` marker):
- Doelgroep / persona
- Device / form factor
- Data shape / structuur
- Branding / design system context

Let op de omkering bij states: loading, empty en error zijn per `CLAUDE.md` ("States zijn default, geen optie") *aanwezig tenzij* het component puur presentationeel is. Vraag dus welke states afvallen, niet welke erbij moeten.

## Vragen-formulering per kritisch item

Wanneer een kritisch item ontbreekt, gebruik deze formuleringen. Bied altijd de meest plausibele optie eerst aan op basis van wat in project-context zichtbaar is.

- *Component-typologie:* "Wordt dit een [meest plausibele optie uit project context], of iets anders zoals [twee andere opties]?"
- *States:* "Welke states zijn van toepassing? Loading is meestal nodig bij data-fetch, empty bij lege resultaten, error bij failure. Welke gelden hier?"
- *Interactie-modaliteit:* "Welke interactie verwacht je: klik, swipe, drag, keyboard? Voor [type component] is [meest plausibele] gebruikelijk."
- *Edge cases:* "Edge cases om te overwegen: minimum aantal items, maximum aantal items, lege staat, validatie. Welke zijn relevant?"

---

## Het skeleton — wat elke regel draagt

```
T  — Task:        One line describing what the prototype or screen should do
C  — Context:     Where this fits in the product or flow
E  — Elements:    Literal UI components present — keep this a short list
B  — Behaviour:   How users interact with those components
Co — Constraints: Device, layout rules, visual constraints — concise
```

## Inline formaat in chat

```
TASK:        ...
CONTEXT:     ...
ELEMENTS:    ...
BEHAVIOUR:   ...
CONSTRAINTS: ...
```

Regels voor de inhoud:
- Elke regel zo kort mogelijk
- Alleen wat het model écht moet weten
- Geen verbose documentatie

---

## Bestandslocatie

Standaard: `/briefings/` aan de root van het actieve project. In monorepos kan dit overschreven worden per klant-CLAUDE.md (zie bv. de umanex-apps regel voor `apps/{app}/briefings/`, en Columba's equivalent).

Als de folder nog niet bestaat: maak hem aan.

## Bestandsnaamgeving

Format: `{YYYY-MM-DD}-{type}-{naam}.tcebc.md`

Voorbeelden:
- `2026-04-29-component-filter-bar.tcebc.md`
- `2026-04-29-flow-onboarding.tcebc.md`
- `2026-04-29-feature-mobile-vergelijking.tcebc.md`

Bij naamconflict (bestand bestaat al en gebruiker koos "nieuw"): voeg `HHMM` suffix toe.
- `2026-04-29-1430-component-filter-bar.tcebc.md`

De `.tcebc.md` extensie is een pilot-marker die verifieerbaar maakt dat de TC-EBC-flow correct is doorlopen. Wordt later vervangen door `.md` zodra de flow stabiel is.

---

## Bestandsinhoud — volledig structuurformaat

Het bestand bevat: titel met naam, metadata blok (Datum / Type / Project / Klant / Status), een horizontale lijn, het inline TC-EBC codeblock met TASK / CONTEXT / ELEMENTS / BEHAVIOUR / CONSTRAINTS labels, een tweede horizontale lijn, dan de secties Open vragen, Aannames, Acceptatie, en Beslissingsgeschiedenis.

**Open vragen-sectie:** lijst van kritische items die nog niet beantwoord zijn. Leeg laten als alles beantwoord is.

**Aannames-sectie:** lijst van items met `[ASSUMPTION]` markers — niet kritisch maar context-afhankelijk.

**Acceptatie-sectie:** de checklist waartegen de Beoordeel-stap valideert (zie het `cyclus-tot-validatie` werkprincipe). Eén `- [ ]` item per toetsbaar criterium, afgeleid uit de vier kritische items (component-typologie, states, interactie, edge cases) plus de toetsbare kern van BEHAVIOUR en CONSTRAINTS. Afvinken gebeurt met het bewijs ín de regel — `- [x] <item> — bewijs: <meting + instrument>` — nooit op de herinnering van de bouwstap; een vinkje zonder `bewijs:` telt als open, en `.githooks/pre-commit` waarschuwt erover (gemeten op Soda+, 2026-08-25: vijf van zeventien vinkjes sprak het bestand tegen). De `Status` in het metadata blok doorloopt `gepland → gebouwd → gevalideerd`; `gevalideerd` mag pas zodra elk item `- [x]` is én er geen P0/P1-bevindingen meer openstaan. **Precies die drie woorden** als eerste woord na `Status:` (hoofdletters en een datum of toelichting erachter mogen; `- **Status:** x`, `| **Status** | x |` en kaal `Status: x` worden alle drie gelezen). `.githooks/pre-commit` waarschuwt bij een aangeraakte briefing met een ander woord of zonder Status, en `scripts/doctor.sh` telt per repo hoeveel briefings elke status dragen. Gemeten 2026-09-07 over 197 briefings in vier repo's: 64 gevalideerd, 59 gebouwd, 10 gepland, 1 zonder Status en 63 met een van veertien eigen woorden ("in uitvoering", "uitgevoerd", "geïmplementeerd", "draft", "ready", "concept", "akkoord", …) — de vraag of de cyclus sluit was daardoor niet te beantwoorden. Bij pure niet-design taken blijft deze sectie leeg — daar leeft het acceptatie-contract los (doel / invariants / done-criteria).

**Beslissingsgeschiedenis-sectie:** alleen kantelpunten, niet elke kleine wijziging.

Een kantelpunt is: component-typologie gewijzigd (sheet → modal), kritisch element toegevoegd of verwijderd, scope significant verschoven.

Een kantelpunt is NIET: typo's of formuleringsverbeteringen, aanvulling van Open vragen sectie.

Format per regel: `- {YYYY-MM-DD}: {wat veranderd is en waarom}`

---

## Voorbeelden

Drie uitgewerkte voorbeelden staan in `umanex-os/docs/tc-ebc-examples/`:
- `01-volledige-briefing-columba.md` — rijke briefing, weinig open vragen
- `02-onvolledige-briefing.md` — minimale briefing, veel kritische items als open vragen
- `03-feature-mobile.md` — niet-component briefing op feature-niveau

## Referentie-schermen

Bestaat er een `reference/`-map in het project (in monorepos `apps/{app}/reference/`), lees dan de relevante schermen vóór je de TC-EBC schrijft. Dat is vastgelegd referentiebeeld — geen token-bron, geen Figma-vervanger.
