---
name: figma-naar-code
description: Vertaalt een Figma component of scherm naar pixel-accurate React Native/Expo (TypeScript, StyleSheet) code voor het RowTrack project. Gebruik deze skill altijd wanneer de gebruiker een Figma URL deelt, vraagt om een component te implementeren vanuit Figma, design-aanpassingen door te voeren, of zegt "sync met Figma", "implementeer dit design", "vertaal naar code".
---

# Skill: Figma to Code

## Trigger
Gebruik deze skill **altijd** wanneer de gebruiker:
- een Figma URL deelt (figma.com/design/...)
- vraagt om een component of scherm te implementeren vanuit Figma
- vraagt om design-aanpassingen door te voeren in de code
- zegt "sync met Figma", "implementeer dit design", "pas de code aan op basis van Figma"
- zegt "neem dit over uit Figma", "vertaal naar code", "update de component op basis van het design"

---

## MCP-gebruik — Console MCP primair, native als backup

Overgenomen van de globale skill, zodat RowTrack dezelfde regel volgt: **Figma Console MCP (Desktop Bridge) is de primaire tool voor álle Figma-operaties — lezen én schrijven.** Native Figma MCP is uitsluitend backup: wanneer de Desktop Bridge niet actief is, of een Console-tool faalt.

- **Start elke operatie met `figma_get_status`** (Desktop Bridge check). Niet actief → vraag: *"Wil je Desktop Bridge activeren, of overschakelen naar native MCP?"* Wacht op antwoord, ga nooit stilzwijgend over op native.
- Lezen via Console: `figma_get_component_for_development_deep` (structuur, afmetingen, states) en `figma_take_screenshot` (visueel).
- Native backup-equivalenten: `get_metadata`, `get_screenshot`, `get_design_context` — alléén bij fallback.
- **Nooit** native Figma Code Connect gebruiken.

> RowTrack gebruikt hardcoded design tokens (geen Figma-variabelen). De `boundVariables` die de globale skill via Console uitleest zijn hier dus meestal leeg — voor RowTrack zit de waarde van de deep-read in structuur, afmetingen en states, niet in token-paden.

---

## Doel
Vertaal een Figma component of scherm naar correcte, pixel-accurate
TypeScript/React Native code voor het RowTrack project. Respecteer de
bestaande codebase-conventies (StyleSheet, geen Tailwind, Expo Router,
@expo/vector-icons, geen lucide-react-native).

---

## Werkwijze

### Stap 1 — Extraheer node info uit de URL
Haal `fileKey` en `nodeId` uit de Figma URL:
- URL formaat: `https://figma.com/design/:fileKey/:naam?node-id=X-Y`
- nodeId conversie: `X-Y` → `X:Y`

### Stap 2 — Inspecteer de structuur
Gebruik `figma_get_component_for_development_deep` (Console MCP) voor de node-hiërarchie, exacte afmetingen en states. Backup bij fallback: `get_metadata`.
- Identificeer alle child frames, tekst nodes en component instances
- Noteer exacte afmetingen (width, height, x, y)
- Identificeer herbruikbare sub-componenten

**Wat je hier leest is wat de keten kón bouwen, niet wat iemand bedoelde.** Sinds
2026-09-09 geldt *Figma beslist, code bewaart* (zie `apps/rowtrack/CLAUDE.md`), en de
componenten in `RowTrack -  Design System` zijn door `figma/builder.js` uit de
Storybook-render gegenereerd. Alles wat die keten niet kan uitdrukken staat er dus als
iets ánders — en dat ziet er precies zo uit als een ontwerpbeslissing. Vijf vormen,
allemaal gemeten op 2026-09-09 (`briefings/2026-09-09-audit-figma-verschilklassen.md`):

| Wat je ziet | Wat het is | Wat je in code schrijft |
|---|---|---|
| Een rand rondom, of geen rand | de keten zet één `strokeWeight`; per zijde kan hij niet — 110 elementen | lees de per-zijde-rand uit de code, niet uit Figma |
| Een frame met een vaste hoogte waar de inhoud onderuit steekt | een scroll-venster; `clipsContent` staat altijd op false en `scrollTop` wordt niet gemeten | `ScrollView`, en de scrollpositie staat nergens in Figma |
| Een frame zonder auto layout met een `label`-kind en een tweede tekst eroverheen | één `<Text>` met een geneste `<Text>` — Figma kent geen inline-stroom (3 nodes) | één `<Text>` met een genest `<Text>`, niet twee views |
| Een leeg invoerveld | een `placeholder`-attribuut; de walker leest alleen echte tekstknopen (4 velden) | de placeholder staat in de code, niet in Figma |
| Twee frames pal tegen elkaar | er zat een `margin` tussen; auto layout kent geen per-kind marge (57 nodes, 12 waarden) | lees de marge uit de code; in Figma is ze verdwenen |

Vraag bij elk van deze vijf dus de **code** en niet Figma. Andersom geldt hetzelfde: zie je
in Figma iets wat de keten wél kan bouwen en het wijkt af van de code, dan is dát een
beslissing — de bouwhash-poort van de builder wijst ze aan.

**Een instance is geen inhoud.** Een schermframe op *Screens v2* bestaat vrijwel volledig
uit library-instances, en drie dingen daaraan zijn niet te zien maar wel te toetsen:

1. **De tekst kan van de library zijn.** Een instance draagt de story-data van het component
   tenzij er een slot op staat. Gemeten 2026-09-09: 23 van de tekstnodes in de 24 frames
   tonen zo de data van een ánder scherm — "20 AUG 2026" waar het scherm 2 september rendert.
   `pnpm --filter rowtrack figma:instance-tekst --lijst` geeft de lijst. Neem tekst uit een
   instance dus nooit als waarheid over zonder die lijst ernaast.
2. **Een `FRAME` met een componentnaam is een teruggevallen kopie.** Waar de library-variant
   een ander aantal kinderen heeft, vervangt de builder de instance door een nagebouwde
   subboom — 37 van de 135. Die kopie toont wél de schermdata. In één frame staan dus
   `Segmented` als INSTANCE en `Segmented` als FRAME naast elkaar, met dezelfde naam en
   tegengestelde waarheden. Lees het `type`, niet de naam.
3. **Een instance toont de GEPUBLICEERDE library, niet de werkversie.** Tussen een wijziging
   in de library en Jeroens publicatie leest een schermframe de vórige component. Gemeten op
   2026-09-09: na de tekst-fix stonden twaalf frames nog exact op hun oude waarde tot na de
   publicatie. Kijk bij twijfel naar de publicatiestatus vóór je een verschil als drift meldt.

**Een maat op een instance zegt niet of hij van het scherm of van de library komt.** De
builder zet de gemeten layout van het scherm als override op de instance — padding, gap,
maat en opacity. `paddingTop: 20` op een instance ziet er dus even "exact" uit als de 24 die
in de library staat. De regel *exact overnemen* hieronder geldt voor de component in zijn
eigen pagina; voor een instance in een scherm is de library de bron.

### Stap 3 — Screenshot ophalen
Gebruik `figma_take_screenshot` (Console MCP) om de visuele weergave te bekijken. Backup bij fallback: `get_screenshot`.
- Controleer kleuren, spacing, typografie en layout
- Identificeer states die niet uit de structuur blijken (hover, active, connected)
- Vergelijk met eventueel bestaande code

### Stap 4 — Design context ophalen (optioneel voor details)
De deep-read uit stap 2 dekt de meeste stijlinformatie. Heb je extra detail nodig op een specifieke node → native `get_design_context` als backup.

### Stap 5 — Analyseer bestaande codebase
Lees de bestaande component bestanden voordat je schrijft:
```bash
# Relevante bestanden lezen
cat components/workout/IdlePhase.tsx
cat components/BleStatusBar.tsx
cat components/GoalSegments.tsx
# etc.
```

Controleer:
- Bestaande StyleSheet conventies
- Import paden (`@/components/...`)
- Font families — lees de actuele namen uit `constants/typography.ts` (`fontFamily`), nooit uit je hoofd
- State management patronen (useState, context)
- Bestaande design tokens in gebruik

### Stap 6 — Implementeer de component
Schrijf de component in TypeScript/React Native met:

**Structuur:**
```tsx
// components/COMPONENTNAAM.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ComponentNaamProps {
  // Exact de props die uit Figma blijken
}

export function ComponentNaam({ ... }: ComponentNaamProps) {
  return (
    // Exacte layout op basis van Figma structuur
  );
}

const styles = StyleSheet.create({
  // Exacte waarden uit Figma — nooit schatten
  // Gebruik altijd numerieke waarden, geen strings voor afmetingen
});
```

**Verplichte conventies:**
- `StyleSheet.create()` — nooit inline styles
- Font families via `fontFamily` uit `@/constants` — lees `constants/typography.ts` voor de actuele namen
- Kleuren als hex strings uit de design tokens
- `TouchableOpacity` voor interactieve elementen, `activeOpacity={0.8}`
- Iconen via `@expo/vector-icons` (Ionicons) — nooit lucide-react-native
- Afmetingen exact overnemen: geen afronding tenzij het een float is

**Design tokens RowTrack:**
```ts
bg:         '#0A0E1A'   // schermachtergrond
surface:    '#1A1F2E'   // card achtergrond
cyan:       '#00E5FF'   // actief / primair
red:        '#EF4444'   // destructief
green:      '#22C55E'   // success / connected
grayDot:    '#47556E'   // disconnected
textWhite:  '#F8FAFC'   // primaire tekst
textMuted:  '#94A3B8'   // secundaire tekst / labels
textOnCyan: '#0A0A0F'   // tekst op cyaan bg
gold:       '#FFD700'   // achievement / PR
```

### Stap 7 — Update bestaande bestanden
Als het component al bestaat, **update** het in plaats van een nieuw bestand te maken.
Pas ook de parent component aan die dit component gebruikt.

### Stap 8 — Design parity check (visueel)
De code-checks in stap 9 bewijzen niet dat het component er effectief uitziet als het design. Deze stap doet dat wel — een visuele vergelijking, geen aanname.
1. **Figma-referentie** — `figma_take_screenshot` (Console MCP) van de bron-node; backup bij fallback: `get_screenshot`. De screenshot uit stap 3 hergebruiken mag, of opnieuw ophalen.
2. **Gebouwd component renderen** — render het component in de draaiende Expo-app (iOS simulator of device) en maak een screenshot van het scherm/component. Draait er geen Expo-instance → vraag om er een te starten; ga niet zelf gokken.
3. **Vergelijk** op de dingen die een code-review níet vangt: layout & flex-richting, spacing/gap, proporties & exacte afmetingen, alignment, typografie (Inter-gewichten), `@expo/vector-icons` iconen, afgekapte of overlopende content, en elke state.
4. **Itereer** — bij een mismatch: fix in code → opnieuw renderen → opnieuw vergelijken. Max 3 iteraties; daarna structurele afwijkingen melden i.p.v. blijven bijschaven.

Pas door naar stap 9 als de render visueel overeenkomt met de Figma-referentie. Kan het component niet gerenderd worden (geen Expo-instance) → meld expliciet dat de parity-check is overgeslagen; sluit nooit stil af alsof hij geslaagd is.

### Stap 9 — Verificatie
Na implementatie:
- Controleer dat alle states correct zijn geïmplementeerd
- Controleer dat afmetingen exact overeenkomen met Figma
- Controleer dat de component correct geïmporteerd wordt in de parent
- Controleer dat de design parity check (stap 8) geslaagd of expliciet als overgeslagen gemeld is

---

## Speciale gevallen

### Schermen (volledige pagina's)
Bij een volledig scherm (bv. IdlePhase, ActivePhase):
1. Lees eerst alle child node IDs via `figma_get_component_for_development_deep` (Console MCP); backup: `get_metadata`
2. Neem per logisch blok een screenshot met `figma_take_screenshot` (Console MCP); backup: `get_screenshot`
3. Implementeer bottom-up: eerst sub-componenten, dan het scherm zelf
4. Gebruik `ScrollView` als de content de schermhoogte kan overschrijden

### Component varianten
Als een Figma frame meerdere states toont (bv. Default + Connected):
- Implementeer als één component met een `state` prop
- Gebruik conditionele styling: `[styles.base, isActive && styles.active]`

### Inputvelden
Figma input frames worden geïmplementeerd als:
```tsx
<View style={styles.inputBox}>
  <TextInput
    style={styles.inputValue}
    keyboardType="numeric"
    selectTextOnFocus
  />
  <Text style={styles.inputUnit}>{unit}</Text>
</View>
```

### Chip rijen
Figma chip instanties worden geïmplementeerd als:
```tsx
<View style={styles.chipRow}>
  {chips.map((chip) => (
    <Chip
      key={chip.label}
      label={chip.label}
      active={activeChip === chip.label}
      onPress={() => setActiveChip(chip.label)}
    />
  ))}
</View>
// chipRow: { flexDirection: 'row', gap: 8 }
// Chip flex: 1 zodat alle chips gelijke breedte hebben
```

---

## Regels
- **Nooit** native Figma Code Connect gebruiken
- **Nooit** lucide-react-native importeren — gebruik `@expo/vector-icons`
- **Nooit** Tailwind of inline styles gebruiken
- **Altijd** eerst screenshotten en metadata lezen vóór implementatie
- **Altijd** bestaande code lezen vóór schrijven
- **Altijd** exact de Figma waarden overnemen — nooit schatten of afronden, behálve de vijf
  vormen uit stap 2 en de breedte van een tekstnode
- **Een tekstbreedte is een uitkomst, geen maat.** Lees `textAutoResize`: `WIDTH_AND_HEIGHT`
  betekent dat de node hugt en dat zijn breedte de tekstengine van Figma is — die meet
  dezelfde tekst breder dan de app, dus overnemen geeft een te brede view. Alleen `HEIGHT`
  (vaste breedte) is een echte maat. Gemeten 2026-09-09 over de 24 schermframes: 495 van de
  625 tekstnodes huggen, 130 zijn een blok
- **FILL plus een uitlijning binnenin is `alignSelf`, geen breedte.** Figma kent geen
  `align-self`, dus de keten zet een rechts of gecentreerd kind op FILL en lijnt de inhoud
  binnenin uit. Zie je een node die de volle breedte vult met `textAlignHorizontal: RIGHT`,
  schrijf dan `alignSelf: 'flex-end'` en géén `width: '100%'`
- **1 component = 1 bestand** in de `components/` folder
- Bestandsnaam = componentnaam in PascalCase: `GoalSegments.tsx`
