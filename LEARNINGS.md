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

# Klant — umanex

## 2026-07-15 — Defensieve fallback bij een native module (Expo/RN)
- **Input:** `apps/rowtrack/lib/secureStorage.ts` — de opzet met een static top-level `import * as SecureStore from 'expo-secure-store'` boven een `useSecureStore()`-probe-in-try/catch die zogenaamd terugvalt op AsyncStorage.
- **Fout:** De static import evalueert bij module-load (Metro, eager), dus `requireNativeModule('ExpoSecureStore')` werpt vóór enige try/catch → de app crashte bij opstarten op een dev-client zonder de native module en de "defensieve fallback" schoot nooit in. De fallback werd als werkend gerapporteerd terwijl hij dat niet was; correcte aanpak = lazy `require()` binnen de try/catch (evalueert pas bij aanroep, dus opvangbaar).
- **Fix:** Regel gehard in `apps/rowtrack/CLAUDE.md`, tabel *Veelgemaakte fouten* — bewust op project- in plaats van klant-niveau: `requireNativeModule` bestaat niet in de vier Next.js-apps, dus op de monorepo-laag zou de regel vier van de vijf keer ruis zijn. Verify door inspectie in plaats van replay (de Input is een bestandspad, geen prompt): `apps/rowtrack/lib/secureStorage.ts` laadt de module nu met `require('expo-secure-store')` op regel 102, bínnen de try/catch op regel 98, met de reden in de kop-comment. Het gecapturede defect is weg; wat ontbrak was de regel die de klasse afdekt.
- **Status:** promoted

## 2026-09-09 — Figma-manifest verversen (packages/ui/CLAUDE.md)
- **Input:** Het codeblok onder `### Figma-manifest verversen` in `packages/ui/CLAUDE.md`, uitgevoerd via `figma_execute` om `packages/ui/figma/manifest.json` te verversen na het toevoegen van de `Sheet`-component.
- **Fout:** Het recept roept `platteAssen(c)` aan voor elke `extra`, maar definieert die helper nergens — verbatim uitvoeren werpt `platteAssen is not defined`. En zelfs mét die helper klopt het recept niet: voor `primary` schrijft het `hoofd.variantGroupProperties` rechtstreeks weg, en die geeft `{ as: { values: [...] } }` terwijl het manifest en `figma-sync-check.mjs` de platte vorm `{ as: [...] }` verwachten. Een manifest uit het recept zoals het er staat levert dus voor élk component met varianten een genest `variantProperties`, en de guard meldt daarop verschillen met de melding "fix de code, of werk Figma bij" — precies de verkeerde oorzaak waar het bestand zelf twee alinea's eerder voor waarschuwt. Ik heb de helper zelf gedefinieerd en op beide plekken toegepast; de guard gaf daarna 24 checks groen. Een derde afwijking kwam boven bij het narekenen: het herstelde recept reproduceert het bestaande `manifest.json` nog steeds niet één-op-één — op de `Overzicht`-pagina kiest het de FRAME als `primary` (naam-match op de paginanaam), terwijl het bestand daar `primary: null` heeft met het frame in `extra`. Onschadelijk, want `figma-sync-check.mjs` filtert `Overzicht` weg vóór de pagina-as, maar wie het hele bestand regenereert krijgt een diff die niets betekent. Het manifest op schijf is dus niet door dít recept gemaakt.
- **Status:** open
