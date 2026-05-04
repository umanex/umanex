# Skill: Code to Figma

## Trigger
Gebruik deze skill **altijd** wanneer de gebruiker:
- vraagt om een component naar Figma te exporteren
- zegt "exporteer naar Figma", "update Figma", "zet dit in Figma", "sync naar Figma"
- vraagt om een bestaand component te synchroniseren of bij te werken in Figma
- vraagt om designs up-to-date te brengen op basis van code-wijzigingen

**Nooit** native Figma Code Connect gebruiken. Altijd via **Figma Console MCP** (`figma_execute`).

---

## Doel
Exporteer een bestaand React Native / TypeScript component naar Figma via de
Figma Console MCP Desktop Bridge. Maak een visueel accurate weergave van het
component in het RowTrack Figma bestand (T1bGrvIzSNeLyh5CbarATZ), pagina "Components".

---

## Werkwijze

### Stap 1 — Lees het broncomponent
Lees het `.tsx` bestand volledig. Extraheer:
- Componentnaam
- Props interface (naam, type, default waarden)
- Alle visuele states (bv. `state: 'Default' | 'Active'`)
- Exacte StyleSheet waarden: kleuren, afmetingen, borderRadius, padding, fontSize, fontWeight
- Conditionele stijlen per state
- Kinderelementstructuur (tekst, iconen, sub-views)

### Stap 2 — Inspecteer de huidige Figma pagina
Gebruik `figma_get_status` om te bevestigen dat de Desktop Bridge actief is.
Gebruik dan `figma_execute` om de "Components" pagina te inspecteren:

```js
const page = figma.root.children.find(p => p.name === 'Components') || figma.currentPage;
figma.currentPage = page;
const existing = page.findOne(n => n.name === 'COMPONENTNAAM' && n.type === 'FRAME');
return existing ? `Bestaand frame gevonden: ${existing.id}` : 'Nieuw frame nodig';
```

Als het component al bestaat: **update** het bestaande frame in plaats van een nieuw aan te maken.

### Stap 3 — Fonts laden
```js
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
```

### Stap 4 — Maak of update het component frame
Maak per visuele state een aparte instantie binnen een container frame.
Gebruik exact de StyleSheet waarden uit de code — nooit schatten:

```js
// Kleur helper (hex naar Figma RGB 0–1)
function hex(h) {
  return {
    r: parseInt(h.slice(1,3),16)/255,
    g: parseInt(h.slice(3,5),16)/255,
    b: parseInt(h.slice(5,7),16)/255,
  };
}

// Container frame
const frame = figma.createFrame();
frame.name = 'ComponentNaam';
frame.resize(breedte, hoogte);
frame.fills = [];  // transparant
page.appendChild(frame);
```

### Stap 5 — States als sub-frames
Elke state (Default, Active, Connected, …) krijgt een eigen sub-frame
binnen het container frame, met een label erboven:

```js
// State label
const lbl = figma.createText();
lbl.fontName = { family: 'Inter', style: 'Regular' };
lbl.fontSize = 11;
lbl.characters = 'State=Default';
lbl.fills = [{ type: 'SOLID', color: hex('#94A3B8') }];
frame.appendChild(lbl);

// State frame — exacte afmetingen en kleuren uit StyleSheet
const stateFrame = figma.createFrame();
stateFrame.name = 'State=Default';
stateFrame.resize(370, 48);
stateFrame.fills = [{ type: 'SOLID', color: hex('#1A1F2E') }];
stateFrame.cornerRadius = 12;
frame.appendChild(stateFrame);
```

### Stap 6 — Beschrijving toevoegen
```js
frame.description = [
  '→ components/COMPONENTNAAM.tsx',
  '',
  'Props:',
  '  state: "Default" | "Active"',
  '  label: string',
  '  onPress: () => void',
  '',
  'States:',
  '  Default: bg=#1A1F2E, text=#94A3B8',
  '  Active:  bg=#00E5FF, text=#0A0A0F',
].join('\n');
```

### Stap 7 — Positionering
Plaats nieuwe frames rechts van bestaande componenten, 80px tussenruimte.
Sluit af met:
```js
figma.viewport.scrollAndZoomIntoView([frame]);
```

### Stap 8 — Screenshot ter verificatie
Neem een screenshot van het frame via de Figma MCP screenshot tool
om het resultaat visueel te bevestigen.

---

## Design Tokens (RowTrack)

```ts
// Kleuren
bg:         '#0A0E1A'   // schermachtergrond
surface:    '#1A1F2E'   // card / component achtergrond
cyan:       '#00E5FF'   // actieve staat, primaire knop
red:        '#EF4444'   // destructieve actie (Verbreek)
green:      '#22C55E'   // connected indicator
grayDot:    '#47556E'   // disconnected indicator
textWhite:  '#F8FAFC'   // primaire tekst
textMuted:  '#94A3B8'   // inactieve labels, secndaire tekst
textOnCyan: '#0A0A0F'   // tekst op cyaan achtergrond
gold:       '#FFD700'   // PR badge, achievement

// Border radius
card:    12
button:  8
chip:    8
segment: 8

// Typografie (fontSize)
xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 20, xxl: 28, display: 40
```

---

## Regels
- **Nooit** native Figma Code Connect gebruiken
- **Altijd** `figma_execute` via Figma Console MCP Desktop Bridge
- **Altijd** exact de waarden uit het TSX bestand gebruiken — nooit schatten
- **Altijd** beschrijving toevoegen met bestandspad en props
- Bestaande frames **updaten**, niet dupliceren
- Per component = 1 container frame op de "Components" pagina
- Alle states zichtbaar naast elkaar binnen het container frame
- Frame breedte altijd exact: state-frames zijn 370px breed (inner padding 16px)
