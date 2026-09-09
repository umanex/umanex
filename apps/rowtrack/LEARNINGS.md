# LEARNINGS.md — waargenomen fouten (staging)

Dit bestand is de **rauwe vangst** van momenten waarop een skill of werkprincipe faalde. Het staat los van CLAUDE.md: CLAUDE.md blijft schone instructie, LEARNINGS.md is de staging-area waaruit bewezen regels later naar de juiste CLAUDE.md **promoveren**.

Entries worden toegevoegd via de `vastleggen` skill — niet handmatig bewerken tenzij je een status bijwerkt.

## Waarom dit bestaat

Lessen verdampen anders. Door de fout én de **letterlijke input die hem uitlokte** te bewaren, wordt elke entry later herbruikbaar als verificatie-test: speel de input opnieuw af in een fresh sessie en kijk of de fout weg is.

## Statussen

Een entry doorloopt drie statussen:

- `open` — vastgelegd, nog niet gefixt.
- `verified` — gefixt én de input opnieuw getest in een fresh sessie; de fout is weg.
- `promoted` — de regel is gehard naar de juiste CLAUDE.md-laag (globaal / klant / project).

Geen score, geen severity, geen categorie. Bewust minimaal — capture moet wrijvingsloos zijn.

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

```
## YYYY-MM-DD — {skill of principe dat faalde}
- **Input:** {letterlijke prompt of bestandspad dat de fout uitlokte}
- **Fout:** {wat er misging, 1-2 zinnen}
- **Status:** open
```

<!-- De vastleggen skill voegt hieronder de juiste laag-header toe bij de eerste capture. -->

# Project — rowtrack

## 2026-09-09 — figma-build-spec (walker) — vijf DOM-eigenschappen buiten bereik, en niets kon ze missen
- **Input:** `node scripts/walker-blindvlekken.mjs --verbose` (op `storybook-static` van 2026-09-09, 42 schermstories): rand 110 · placeholder 4 · gescrold 11 · overloop 15 · inline 3. Zichtbaar in `figma/beeld-diff/IdlePhase__Playground.3luik.png` (wheel vanaf item 1, lijst onder de knop door; segment-rij als volledige doos), `LoginScreen__Playground.3luik.png` (leeg e-mailveld; "Registreer" over "Nog geen account?") en `ActivePhase__Playground.3luik.png` ("RESTERENDE TIJD" smaller: style `segmentActive` met −0,24 px tracking waar de meting 3,2 px zegt — 24 van 324 tekstnodes met style).
- **Fout:** De walker leest per node alleen `borderTopWidth`, geen `scrollTop`, geen `<input placeholder>`, alleen eigen tekstnodes (een geneste `<Text>` wordt frame + los label zonder inline-stroom) en kiest de text style op familie+grootte zonder tracking. Elk van die vijf is een eigenschap die niet in de spec komt, dus de builder kan hem niet bouwen én parity — die op dezelfde meting rust — kan hem niet missen; een lege meting was hier niet te onderscheiden van "geen probleem". Alleen het beeld vond ze.
- **Status:** open
