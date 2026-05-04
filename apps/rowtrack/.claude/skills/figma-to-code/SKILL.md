# Skill: Figma to Code

## Trigger
Gebruik deze skill **altijd** wanneer de gebruiker:
- een Figma URL deelt (figma.com/design/...)
- vraagt om een component of scherm te implementeren vanuit Figma
- vraagt om design-aanpassingen door te voeren in de code
- zegt "sync met Figma", "implementeer dit design", "pas de code aan op basis van Figma"
- zegt "neem dit over uit Figma", "vertaal naar code", "update de component op basis van het design"

**Nooit** native Figma Code Connect gebruiken. Altijd inspecteren via
**Figma MCP tools** (`get_metadata`, `get_screenshot`, `get_design_context`).

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
Gebruik `get_metadata` voor een overzicht van de node-hiërarchie:
- Identificeer alle child frames, tekst nodes en component instances
- Noteer exacte afmetingen (width, height, x, y)
- Identificeer herbruikbare sub-componenten

### Stap 3 — Screenshot ophalen
Gebruik `get_screenshot` om de visuele weergave te bekijken:
- Controleer kleuren, spacing, typografie en layout
- Identificeer states die niet uit metadata blijken (hover, active, connected)
- Vergelijk met eventueel bestaande code

### Stap 4 — Design context ophalen (optioneel voor details)
Gebruik `get_design_context` voor gedetailleerde stijlinformatie van
specifieke nodes wanneer metadata onvoldoende is.

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
- Font families (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`)
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
- Font families via Expo font namen: `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`
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

### Stap 8 — Verificatie
Na implementatie:
- Controleer dat alle states correct zijn geïmplementeerd
- Controleer dat afmetingen exact overeenkomen met Figma
- Controleer dat de component correct geïmporteerd wordt in de parent

---

## Speciale gevallen

### Schermen (volledige pagina's)
Bij een volledig scherm (bv. IdlePhase, ActivePhase):
1. Lees eerst alle child node IDs via `get_metadata`
2. Neem screenshots van elk logisch blok afzonderlijk
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
- **Altijd** exact de Figma waarden overnemen — nooit schatten of afronden
- **1 component = 1 bestand** in de `components/` folder
- Bestandsnaam = componentnaam in PascalCase: `GoalSegments.tsx`
