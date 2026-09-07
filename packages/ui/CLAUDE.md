# CLAUDE.md — packages/ui

De gedeelde UI-laag van de monorepo: shadcn-achtige primitives op de rollaag van
`@umanex/tokens`, gedocumenteerd in Storybook, gespiegeld in het Figma-bestand
**Component library** (`ko2OuasYxyY2YRD69MYhWX`).

## Structuur

- `components/ui/` — 1 component = 1 file, named exports, elk met een `*.stories.tsx` ernaast
- `docs/` — Storybook-only: `blocks/` (docs-blokken), `lib/` (token-catalogus), `tokens/` (MDX-pagina's)
- `figma/manifest.json` — de neergeslagen Figma-staat. **Niet met de hand bewerken**; zie Verify-pad.
- `scripts/` — de sync-guard en zijn tegenproef

Componenten raken uitsluitend de **rollaag** aan via een utility uit `@umanex/config/tailwind/preset`.
Geen primitive, geen rauwe paletklasse, geen hardcoded hex of arbitrary radius. `pnpm --filter
@umanex/tokens guard` dwingt dat af.

## Storybook ↔ Figma

Elke component heeft een eigen **pagina** in het Figma-bestand, en elk stories-bestand draagt
`parameters.figma.url` die naar de component(set) op die pagina wijst. De docs-pagina rendert
die link via `docs/blocks/FigmaLink.tsx` ("Open in Figma").

De richting is éénzijdig: **code is de bron, Figma de ontvanger.** Een variant bijbouwen doe je
in de code; Figma volgt. `tokens.json` blijft de bron voor de rollaag — de Figma-variabelen zijn
er een afgeleide van, nooit andersom.

Twee variabelen-collections in Figma:

| Collection | Modes | Inhoud | Bron |
|---|---|---|---|
| `Theme` | Light, Dark | de 42 hsl-rollen + `overlay-scrim` | `packages/tokens/build/theme.css` |
| `Base` | Value | `radius*`, `spacing-*`, `border-*`, `icon-stroke` | preset + Tailwind-schaal + lucide |

`radius-lg/md/sm` zijn afgeleiden van `--radius` (`var(--radius)`, `−2px`, `−4px` — zoals de
preset ze definieert); de guard rekent die regel terug. `spacing-*` volgt Tailwinds `n × 4px`.

**Bekende gaten**, expliciet in plaats van stil:
- `spacing-*`, `border-*` en `icon-stroke` hebben **geen token in `tokens.json`** — hun bron is de
  Tailwind-default respectievelijk lucide-react. `roles.mjs` zegt "later spacing"; tot dat er is,
  is de Figma-kant de enige plek waar deze schaal expliciet staat. Zie `BACKLOG.md`.
- `shadow/sm` en `shadow/md` zijn Tailwind-defaults, om dezelfde reden.
- De guard ziet **geen** wijziging die in Figma gemaakt wordt zonder verse manifest. CI heeft geen
  Figma-toegang; de manifest is een meting, geen live verbinding.

## Verify-pad

| Capability | Commando |
|---|---|
| **Sync code ↔ Figma toetsen** | `pnpm --filter @umanex/ui figma:check` |
| **Guard tegenproeven** (beide kanten) | `pnpm --filter @umanex/ui figma:check:selftest` |
| **Verse build** | `pnpm --filter @umanex/ui build-storybook` (output: `storybook-static/`) |
| **Render vastleggen** | `pnpm --filter @umanex/ui storybook` → `:6006`; per component `/?path=/docs/componenten-<naam>--docs` |
| **Types** | `pnpm --filter @umanex/ui type-check` |
| **Flow aandrijven** | geen — deze package heeft geen flows, alleen presentational primitives |
| **State forceren** | via Storybook-args (`argTypes`); dark mode via de Theme-toolbar (`.dark`-class) |
| **Invariant draaien** | de sync-invarianten zitten in `figma:check`; er is geen aparte rekenkern |

### Figma-manifest verversen

Nodig na **elke** wijziging aan het Figma-bestand (nieuwe component, hernoemde variant, node-ids
na een herbouw). Vereist een actieve Desktop Bridge — en het **juiste bestand als actief doel**. De Bridge is
multi-client: meerdere bestanden kunnen tegelijk verbonden zijn, elk met een eigen verbinding.
Staat de Component library niet actief, dan schakel je, je stopt niet:

1. `figma_get_status` — draait de Bridge?
2. `figma_list_open_files` — welke bestanden zijn verbonden, en welk is actief?
3. `figma_navigate` met `https://www.figma.com/design/ko2OuasYxyY2YRD69MYhWX/...` — schakelt het
   actieve doel om zodra dat bestand verbonden is.
4. Antwoordt hij `websocket_file_not_connected`, dan is de plugin daar niet open. Vraag de
   gebruiker de Desktop Bridge plugin in **dat** bestand te openen; hij verbindt vanzelf.

De fileKey-assert hieronder blijft nodig náást die schakelstap, niet in plaats daarvan: het
actieve doel kan bij een reconnect stil terugwisselen. Assert op de **fileKey**,
niet op de bestandsnaam — die is een bewering die verandert zodra iemand het bestand hernoemt:

```js
// figma_execute (Figma Console MCP) — schema 2
// Levert precies de vorm die figma-sync-check.mjs leest: pages[naam].primary, niet .nodes.
// Tot 2026-09-07 stond hier `nodes: p.children.map(...)`; een manifest uit dát recept gaf
// 18 verschillen met de melding "fix de code, of werk Figma bij" — de verkeerde oorzaak.
if (figma.fileKey !== "ko2OuasYxyY2YRD69MYhWX") return { fout: "verkeerde file: " + figma.fileKey };
await figma.loadAllPagesAsync();

// Theme-waarden per mode: de [themawaarde]-as vergelijkt hiermee tegen theme.css. Zonder
// dit blok toetst de guard alleen NAMEN en blijft een kleurwijziging in Figma eeuwig groen.
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const collections = {}, waardenPerCollectie = {};
for (const c of cols) {
  const modeNaam = Object.fromEntries(c.modes.map(m => [m.modeId, m.name]));
  const vars = await Promise.all(c.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
  collections[c.name] = { modes: c.modes.map(m => m.name), variables: vars.map(v => v.name) };
  if (c.name === "Theme") {
    const w = {};
    for (const v of vars) {
      w[v.name] = {};
      for (const [modeId, val] of Object.entries(v.valuesByMode)) {
        // De rollaag staat in theme.css als HSL-triplet zonder functie: "0 0% 100%".
        // theme.css draagt de rollaag als HSL-triplet, behalve waar een alpha nodig is —
        // `overlay-scrim` staat er als rgba(). Stuur dus dezelfde vorm uit als de bron,
        // anders vergelijkt de guard een triplet met een rgba en valt hij om op het formaat.
        w[v.name][modeNaam[modeId]] = (typeof val === "object" && val.r !== undefined)
          ? (val.a < 0.999
              ? `rgba(${Math.round(val.r * 255)}, ${Math.round(val.g * 255)}, ${Math.round(val.b * 255)}, ${Math.round(val.a * 100) / 100})`
              : rgbNaarHslTriplet(val))
          : val;
      }
    }
    collections[c.name].waarden = w;
  }
}
function rgbNaarHslTriplet({ r, g, b }) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hu = 0, sa = 0;
  if (mx !== mn) {
    const d = mx - mn;
    sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hu = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hu *= 60;
  }
  const rond = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  return `${rond(hu)} ${rond(sa * 100)}% ${rond(l * 100)}%`;
}

// Pagina's: primary is de component(set) waarop de guard ankert. `varianten` legt de
// individuele variant-nodes vast — de join-sleutel die een maat-as later nodig heeft om
// een padding in Figma aan een padding in de browser te koppelen.
const pages = {};
for (const p of figma.root.children) {
  const kinderen = p.children;
  // Welke node is "primary"? Niet simpelweg de eerste component set — op de Tabs-pagina
  // staan `Tabs` (COMPONENT) en `TabsTrigger` (COMPONENT_SET) naast elkaar, en de deep-link
  // in tabs.stories.tsx wijst naar `Tabs`. De naam is hier de sleutel: exacte match op de
  // paginanaam wint, dan een prefix (pagina "Tooltip" ↔ node "TooltipContent"), en pas
  // daarna de eerste set. Zonder die volgorde kiest het recept TabsTrigger en faalt de
  // [link]-as op een verschil dat er niet is.
  const hoofd = kinderen.find(c => c.name === p.name)
    ?? kinderen.find(c => c.name.startsWith(p.name))
    ?? kinderen.find(c => c.type === "COMPONENT_SET")
    ?? kinderen.find(c => c.type === "COMPONENT") ?? null;
  pages[p.name] = {
    pageId: p.id,
    primary: hoofd ? {
      name: hoofd.name, id: hoofd.id, type: hoofd.type,
      variantProperties: hoofd.type === "COMPONENT_SET" ? hoofd.variantGroupProperties : null,
      varianten: hoofd.type === "COMPONENT_SET"
        ? hoofd.children.map(v => ({ name: v.name, id: v.id })) : null,
    } : null,
    // Ook `extra` houdt zijn variant-assen. Op de Tabs-pagina draagt TabsTrigger de assen
    // terwijl Tabs de primary is; laat je ze hier weg, dan is die informatie weg uit de
    // manifest en kan geen enkele as hem ooit nog toetsen.
    extra: kinderen.filter(c => c !== hoofd).map(c => ({
      name: c.name, id: c.id, type: c.type, variantProperties: platteAssen(c),
      varianten: c.type === "COMPONENT_SET" ? c.children.map(v => ({ name: v.name, id: v.id })) : null })),
  };
}

return {
  $comment: "Neergeslagen Figma-staat. NIET met de hand bewerken — ververs via packages/ui/CLAUDE.md.",
  schemaVersie: 2,
  fileKey: figma.fileKey, fileName: figma.root.name,
  gegenereerd: new Date().toISOString().slice(0, 10),
  collections,
  textStyles: (await figma.getLocalTextStylesAsync()).map(t => ({
    name: t.name, family: t.fontName.family, style: t.fontName.style,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight.unit === "PIXELS" ? t.lineHeight.value : t.lineHeight.unit,
    letterSpacing: t.letterSpacing.value ?? 0 })),
  effectStyles: (await figma.getLocalEffectStylesAsync()).map(e => e.name),
  pages,
};
```

Werk daarna `figma/manifest.json` bij en draai `figma:check`. Lees een node die in deze sessie
bewerkt is **altijd** via de runtime (`figma_execute`, `figma_capture_screenshot`) — de REST-tools
(`figma_take_screenshot`, `figma_get_component_for_development`) geven de laatst opgeslagen
cloud-staat en zijn na een verse edit per definitie stale.

## Wat hier NIET hoort

- App-specifieke composities — die horen in `apps/<app>/src/components/`
- Feature-logica, data-fetching, state management
- Nieuwe dependencies zonder bevestiging (zie de globale CLAUDE.md)
