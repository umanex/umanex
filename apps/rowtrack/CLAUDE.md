# RowTrack — CLAUDE.md

## Project overzicht
React Native (Expo) rowing workout tracker app met BLE connectiviteit,
gamificatie en Supabase backend.

**Stack:** React Native · Expo SDK · Expo Router · TypeScript · Supabase  
**Figma bestand:** T1bGrvIzSNeLyh5CbarATZ  
**Design MCP:** Figma Console MCP (figma-console-mcp van southleft) via Desktop Bridge  

---

## Skills

> **Lees altijd de relevante SKILL.md vóór je begint.**
> Skills staan in `.claude/skills/`.

### 🔁 Code to Figma — `.claude/skills/code-to-figma/SKILL.md`

**Trigger:** Gebruik deze skill altijd wanneer de gebruiker vraagt om een component
naar Figma te exporteren, te synchroniseren, bij te werken in Figma, of zegt:
"exporteer naar Figma", "update Figma", "zet dit in Figma", "sync naar Figma".

Exporteert een bestaand React/TypeScript component naar Figma via de
Figma Console MCP en Desktop Bridge. Maakt een visueel accurate weergave
van alle component states op de "Components" pagina van het Figma bestand.

**Nooit** native Figma Code Connect gebruiken — altijd `figma_execute` via Console MCP.

---

### 🎨 Figma to Code — `.claude/skills/figma-to-code/SKILL.md`

**Trigger:** Gebruik deze skill altijd wanneer de gebruiker een Figma URL deelt,
vraagt om een component te implementeren vanuit Figma, vraagt om design-aanpassingen
door te voeren in de code, of zegt: "sync met Figma", "implementeer dit design",
"pas de code aan op basis van Figma".

Vertaalt een Figma component of scherm naar correcte TypeScript/React Native code
voor het RowTrack project. Inspecteert het Figma design via `get_metadata`,
`get_screenshot` en `get_design_context` en implementeert pixel-accurate code
die de bestaande codebase-conventies volgt.

**Nooit** native Figma Code Connect gebruiken — altijd inspecteren via Figma MCP tools.

---

## Architectuur

```
app/
  (tabs)/
    index.tsx          # Dashboard / Home
    workout/
      index.tsx        # Workout scherm (IdlePhase / ActivePhase)
    history/
      index.tsx        # Historiek lijst
      [id].tsx         # Historiek detail
    profile/
      index.tsx        # Profiel
    _layout.tsx        # Tab navigatie

components/
  workout/
    IdlePhase.tsx      # Idle workout scherm
    ActivePhase.tsx    # Actieve workout (portrait + landscape)
    ProgressBar.tsx    # Geanimeerde voortgangsbalk
    MotivationalToast.tsx  # Fullscreen goal-bereikt overlay
    Confetti.tsx       # Confetti animatie (60 particles)
  BleStatusBar.tsx     # BLE verbindingsstatus
  HrStatusBar.tsx      # Hartslagmeter status
  GoalSegments.tsx     # Doeltype segmented control
  GoalInput.tsx        # Numeriek invoerveld met eenheid
  Chip.tsx             # Selecteerbare chip (suggesties)
  Icon.tsx             # Icon wrapper (@expo/vector-icons)

lib/
  ble/
    ble-context.tsx    # BLE state (rower + HR)
    ble-service.ts     # BLE scan / connect / disconnect
    hr-service.ts      # Hartslagmeter BLE
    ftms-parser.ts     # FTMS characteristic parser
    constants.ts       # BLE UUIDs
  calories.ts          # Kcal berekening (watt / HR)
  formatters.ts        # Tijd / afstand formatters
  hooks/
    useWorkoutMetrics.ts
    useGoalProgress.ts
  workout-phase-context.tsx
```

---

## Design tokens

```ts
// Kleuren
bg:         '#0A0E1A'   // schermachtergrond
surface:    '#1A1F2E'   // card / component achtergrond
cyan:       '#00E5FF'   // actief / primair / CTA
red:        '#EF4444'   // destructief / stop / Verbreek
green:      '#22C55E'   // connected / success
grayDot:    '#47556E'   // disconnected indicator
textWhite:  '#F8FAFC'   // primaire tekst
textMuted:  '#94A3B8'   // secundaire tekst / labels / uppercase headers
textOnCyan: '#0A0A0F'   // tekst op cyaan achtergrond
gold:       '#FFD700'   // PR badge / achievement / goal bereikt

// Border radius
card:    12
button:  8
chip:    8
segment: 8

// Typografie font families
Inter_400Regular   // body, units, hints
Inter_500Medium    // labels, chips
Inter_600SemiBold  // knoppen, segment labels
Inter_700Bold      // headers, KPI waarden
```

---

## Conventies

### Code
- `StyleSheet.create()` — nooit inline styles
- `TouchableOpacity` voor interactieve elementen, `activeOpacity={0.8}`
- Font families via Expo namen: `Inter_400Regular`, `Inter_500Medium`, etc.
- Iconen via `@expo/vector-icons` (Ionicons) — **nooit** `lucide-react-native`
- Import alias: `@/components/...`, `@/lib/...`
- 1 component = 1 bestand, PascalCase bestandsnaam

### Figma workflow
- **Nooit** native Figma Code Connect
- **Altijd** Figma Console MCP (`figma_execute`) voor schrijfoperaties
- **Altijd** `get_metadata` + `get_screenshot` voor lezen
- Figma bestand: `T1bGrvIzSNeLyh5CbarATZ`
- Components pagina: `node-id=21-378`
- Screens pagina: `node-id=0-1`

### BLE
- Rower: FTMS service `00001826`, characteristic `00002ad1`
- HR: Heart Rate service `0x180D`, characteristic `0x2A37`
- Twee notification types: distance/elapsed packet en spm/watts/split packet

### Supabase tabellen
- `profiles`: id, naam, gender, age, weight_kg, height_cm
- `workouts`: id, user_id, goal_type, goal_value, distance_m, elapsed_s,
              avg_watts, avg_spm, avg_split, avg_hr, max_hr, calories,
              created_at
- `period_goals`: id, user_id, period (week/month), goal_type, goal_value

---

## Veelgemaakte fouten

| Probleem | Oplossing |
|---|---|
| `topSvgLayout` crash | Gebruik `@expo/vector-icons`, niet `lucide-react-native` |
| BLE PLX old-arch interop | `react-native-ble-plx` uses `RCT_EXPORT_MODULE()`; RN 0.81 interop layer handles this automatically |
| Modal niet fullscreen | Gebruik `<Modal transparent statusBarTranslucent>`, niet `absoluteFillObject` |
| Fonts niet geladen in Figma | `await figma.loadFontAsync(...)` vóór elke `createText()` |
| Tab label verkeerd | Tab heet "Training" (niet "Workout") |
| pod install faalt | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
