# RowTrack — Figma ↔ Code mapping

Single source of truth voor welke code-eenheid bij welk Figma frame hoort.
Bijwerken bij elke Figma re-organisatie of nieuwe screen/component.

**Figma file**: https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=0-1&t=k6rKeRyqVNPmF9Pn-1
**Laatst gesynct**: 2026-07-15

Lege `node-id` kolom = nog niet gemapt of nog niet in Figma. Verwijder rijen
voor gedeprecate code.

---

## Screens (`app/(tabs)/`)

| Code | Figma node-id | Frame naam |
|---|---|---|
| `app/(tabs)/index.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=16-159&t=k6rKeRyqVNPmF9Pn-4` | Home |
| `app/(tabs)/workout/index.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1506&t=k6rKeRyqVNPmF9Pn-4` | IdlePhase |
| `app/(tabs)/history/index.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=5-6&t=k6rKeRyqVNPmF9Pn-4` | History |
| `app/(tabs)/profile/index.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=52-8768&t=k6rKeRyqVNPmF9Pn-4` | Profile |

## Auth (`app/(auth)/`)

Node-ids uit de sync van 2026-07-08, nog niet opnieuw geverifieerd tegen Figma.

| Code | Figma node-id | Frame naam |
|---|---|---|
| `app/(auth)/login.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=182-2642` | Auth/Login |
| `app/(auth)/register.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=182-2660` | Auth/Register |

## Profile — sheet states (`app/(tabs)/profile.tsx`)

Elke rij opent een `BottomSheet`-state boven het Profile-scherm. Node-ids in de `Profile`-sectie (`354:2004`).

| Sheet | Figma node-id | Frame naam |
|---|---|---|
| Voornaam | `53:9905` | 07 – Profile/Voornaam |
| E-mail | `53:10039` | 07 – Profile/Mail |
| Geslacht | `52:9155` | 07 – Profile/Geslacht |
| Lengte | `52:9286` | 07 – Profile/Lengte |
| Gewicht | `52:9424` | 07 – Profile/Gewicht |
| Geboortedatum | `52:9538` | 07 – Profile/Geboortedatum |
| Doel bewerken | `52:9730` | 07 – Profile/Doel bewerken |

Lengte/Gewicht = single-column `WheelPicker`; Geboortedatum = 3-koloms date-wheel. Bijgewerkt 2026-07-15 (code→Figma, wheel-redesign cf. PR #124/#126).

## History - Segments

| Code | Figma node-id | Frame naam |
| `app/(tabs)/history/[id].tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=5-7&t=k6rKeRyqVNPmF9Pn-4` | History/Detail/Overview |
| `app/(tabs)/history/[id].tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=38-5009&t=k6rKeRyqVNPmF9Pn-4` | History/Detail/Splits |
| `app/(tabs)/history/[id].tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=38-5115&t=k6rKeRyqVNPmF9Pn-4` | History/Detail/BPM |

## Workout — phases & overlays

| Code | url | Frame naam |
|---|---|---|
| `components/workout/ActivePhase.tsx` (portrait) | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2400` | Active/Portrait/None (base; goal-varianten zie sectie hieronder) |
| `components/workout/ActivePhase.tsx` (landscape) | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2746` | Active/Landscape/None (base; goal-varianten zie sectie hieronder) |
| `components/workout/ActivePhase.tsx` (summary) | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=43-8278&t=k6rKeRyqVNPmF9Pn-4` | Active/Summary |
| `components/workout/ProgressBar.tsx` | `` | Workout / Progress Bar |
| `components/workout/Confetti.tsx` | `` | Workout / Confetti (animatie) |
| `components/GoalSetupModal.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=182-2599` | Workout / Goal Setup Modal |
| `components/MotivationalToast.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=5-5&t=k6rKeRyqVNPmF9Pn-4` | Workout / Motivational Toast (goal-reached viering) |
| `components/MilestoneOverlay.tsx` | `` | Workout / Milestone Overlay |
| `components/PaceZone.tsx` | `` | Workout / Pace Zone |
| `components/SplitsList.tsx` | `` | Workout / Splits List |

## Components — atoms

| Code | Figma node-id | Component naam |
|---|---|---|
| `components/Button.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=109-2214&t=NfyKsxb0ybecTdzm-4` | Button |
| `components/Card.tsx` | `` | Atoms / Card |
| `components/Chip.tsx` | `` | Atoms / Chip |
| `components/Dot.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=67-14291&t=k6rKeRyqVNPmF9Pn-4` | Dot |
| `components/Icon.tsx` | `` | Atoms / Icon |
| `components/Segment.tsx` | `` | Atoms / Segment |
| `components/Subtitle.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=55-13730&t=NfyKsxb0ybecTdzm-4` | Subtitle |
| `components/TabItem.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=21-400&t=NfyKsxb0ybecTdzm-4` | TabItem |
| `components/KpiSingle.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=89-3445&t=k6rKeRyqVNPmF9Pn-4` | KPI_single |



## Components — molecules

| Code | Figma node-id | Component naam |
|---|---|---|
| `components/FormField.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=182-2592` | Forms / FormField |
| `components/GoalInput.tsx` | `` | Forms / GoalInput |
| `components/GoalSegments.tsx` | `` | Forms / GoalSegments |
| `components/MetricDisplay.tsx` | `` | Data / MetricDisplay |
| `components/SectionHeader.tsx` | `` | Layout / SectionHeader |
| `components/SummaryRow.tsx` | `` | Data / SummaryRow |
| `components/EmptyState.tsx` | `` | Feedback / EmptyState |
| `components/ErrorMessage.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=182-2565` | Feedback / ErrorMessage |
| `components/BleStatusBar.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=21-485&t=k6rKeRyqVNPmF9Pn-4` | Status / BleStatusBar |
| `components/HrStatusBar.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=21-515&t=k6rKeRyqVNPmF9Pn-4` | Status / HrStatusBar |
| `components/WorkoutCard.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=56-13791&t=k6rKeRyqVNPmF9Pn-4` | Cards / WorkoutCard |
| `components/WheelPicker.tsx` | `36:1956` (component) · `377:2552` (goal-export met fade) | IdlePhase/Wheel |
| `components/GoalProgressCard.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=64-14031&t=k6rKeRyqVNPmF9Pn-4` | GoalProgressCard |
| `components/TabBar.tsx` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=5-9&t=k6rKeRyqVNPmF9Pn-4` | Cards / GoalProgressCard |


### `IdlePhase.tsx` variants

| Variant | url |
|---|---|
| `goalType=none` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1506&t=k6rKeRyqVNPmF9Pn-4` |
| `goalType=duration` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1508&t=k6rKeRyqVNPmF9Pn-4` |
| `goalType=distance` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1510&t=k6rKeRyqVNPmF9Pn-4` |
| `goalType=watts` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1514&t=k6rKeRyqVNPmF9Pn-4` |
| `goalType=split` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=35-1512&t=k6rKeRyqVNPmF9Pn-4` |

---

### `ActivePhase.tsx` variants

#### Portrait

| Variant | url |
|---|---|
| `goalType=none` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2400` |
| `goalType=duration` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2436` |
| `goalType=distance` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2536` |
| `goalType=split` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=296-1900` |
| `goalType=watts` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=296-1947` |


#### Landscape

| Variant | url |
|---|---|
| `goalType=none` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-2746` |
| `goalType=duration` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-3359` |
| `goalType=distance` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=290-3406` |
| `goalType=split` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=297-2068` |
| `goalType=watts` | `https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack?node-id=297-2143` |

> ⚠️ Het watts-frame (`297-2143`) heet in Figma momenteel **"Active/Landscape/Split"** — een naam-slip (er staan twee "Landscape/Split"-frames). Node-id klopt op kolompositie (Watts). Naam best rechttrekken in Figma.

> Oude Active-node-ids (`5-3`, `5-4`, `42-53xx`/`42-57xx`) zijn vervallen — de hele Active-set is herbouwd in Figma-sectie **"Active workouts"** (`236:5088`) op 2026-07-14. `Active/Summary` (`43-8278`), Home, History, Profile en IdlePhase bleven ongewijzigd.


---

## Gebruik (voor Claude Code)

Bij elke Figma-gerelateerde taak:
1. Lees deze file
2. Vind de juiste `node-id` op basis van het code-pad
3. `get_design_context` (of `get_metadata` / `get_screenshot`) op die node
4. Pas code aan via tokens

Bij screen-varianten (portrait/landscape, summary phase, etc.) staat de
variant tussen haakjes achter het pad — match exact.

## Onderhoud

Werk dit bestand bij:
- bij hernoemen of verplaatsen van Figma frames
- bij nieuwe screens of components
- bij verplaatsen of hernoemen van code-files
- bij deprecation (verwijder rij)

Eén commit per batch-update: `docs(rowtrack): sync figma-map`.

## Node-id vinden in Figma

Selecteer het frame of component → rechtermuis → *Copy link to selection*.
Format: `figma.com/design/{fileId}/...?node-id=12-340`. Neem alleen het
`12-340` deel over.