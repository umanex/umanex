/**
 * Tapt de StyleSheet-sleutelnamen af vóór ze in de bundle verdwijnen.
 *
 * WAAROM DIT NODIG IS. De laagnaam in Figma moet de code-naam zijn — `badge`, `valuesRow`,
 * `trackFill` — en niet de broer-index of de tekst die erin staat (leesbaarheidscontract,
 * regel 1). Die naam bestaat in de DOM niet meer: `createIdentifier`
 * (react-native-web/dist/exports/StyleSheet/compiler/index.js) zet de CSS-property alleen in
 * de dev-tak in de klassenaam; in een productiebuild is elke klasse `r-<hash>`.
 *
 * WAAROM HET HIER KAN. Het aanroepmoment van `create` is de laatste plek waar sleutel én
 * klassen samen bestaan. Drie dingen maken het aftappen mogelijk, alle drie gelezen in
 * node_modules en niet aangenomen:
 *
 *  · `StyleSheet` is zélf aanroepbaar en geeft `[className, inlineStyle]` terug
 *    (exports/StyleSheet/index.js, `function StyleSheet(styles, options)`).
 *  · `create` muteert het meegegeven object en geeft datzelfde object terug, met het
 *    compileerresultaat in een private WeakMap. `StyleSheet(res[sleutel])[0]` is dus exact
 *    de klassenlijst van die ene sleutel.
 *  · `StyleSheet.create = create` is een gewone, schrijfbare property op een niet-bevroren
 *    object, en `create` gebruikt geen `this`. Overschrijven mag, en losmaken van de
 *    ontvanger ook — dat laatste is wat de transform in main.ts doet.
 *
 * WAAROM IN .storybook/ EN NIET IN DE APP. Dit raakt geen productiecode. RowTrack draait op
 * het toestel met de echte `StyleSheet`; alleen de Storybook-preview krijgt de wrapper.
 */
import { StyleSheet } from 'react-native';

type Sleutel = { naam: string; volgorde: number; klassen: string[] };
type Bron = { id: number; bron: string; sleutels: Sleutel[] };

declare global {
  interface Window {
    __RNW_KEYS__?: { versie: 1; uit: boolean; actief: boolean; bronnen: Bron[]; fouten: string[] };
  }
}

const kaart = (window.__RNW_KEYS__ ??= { versie: 1, uit: false, actief: false, bronnen: [], fouten: [] });

// Negatieve controle als eersteklas schakelaar. Zonder hem is "alle nodes heten wrapper"
// niet te onderscheiden van "er zijn geen sleutels" — een lege uitkomst en een kapot
// instrument zien er identiek uit. De walker draait één story met deze vlag en eist dat
// de spec-bouw dán faalt in plaats van een spec met 100% terugval af te leveren.
kaart.uit = /[?&]rnwKeysUit=1/.test(location.search);

/**
 * De herkomst komt UITSLUITEND van de transform in main.ts, die `globalThis.__RNW_SRC__`
 * op het pad zet vlak vóór de aanroep. De wrapper leest hem en WIST hem meteen.
 *
 * Dat wissen is het punt. React-native-web roept zelf ook `create` aan (Modal, ScrollView,
 * lui geladen), en die aanroepen passeren de transform niet. Zonder wissen zouden ze de
 * herkomst erven van het laatste app-bestand dat wél langskwam — een sleutel van RNW zou
 * dan als `components/Chip.tsx` in de kaart komen. Nu leveren ze `null` en vallen ze buiten
 * de naamgeving, wat ook precies klopt: het zijn geen ontwerp-namen.
 *
 * Een stacktrace-terugval staat hier bewust NIET. Die geeft in een productiebundle alleen
 * chunknamen, en die zijn aantoonbaar fout: `components/workout/workout.styles.ts` zit
 * alleen in de ActivePhase-chunk terwijl IdlePhase hem ook gebruikt.
 */
function neemHerkomst(): string | null {
  const g = globalThis as { __RNW_SRC__?: unknown };
  const bron = typeof g.__RNW_SRC__ === 'string' ? g.__RNW_SRC__ : null;
  g.__RNW_SRC__ = undefined;
  return bron;
}

type Create = typeof StyleSheet.create;
const doel = StyleSheet as unknown as { create: Create & { __afgetapt?: true } };

if (!kaart.uit && !doel.create.__afgetapt) {
  const echt = doel.create;
  const aanroepbaar = StyleSheet as unknown as (s: unknown) => [string | undefined, unknown];

  const gepatcht = function create(styles: Parameters<Create>[0]) {
    const res = echt(styles);
    const bron = neemHerkomst();
    if (!bron) return res;                     // RNW's eigen stijlen — geen ontwerp-namen
    try {
      const sleutels: Sleutel[] = [];
      Object.keys(res).forEach((naam, volgorde) => {
        const klassen = String(aanroepbaar((res as Record<string, unknown>)[naam])[0] ?? '')
          .split(' ')
          .filter(Boolean);
        if (klassen.length) sleutels.push({ naam, volgorde, klassen });
      });
      if (sleutels.length) kaart.bronnen.push({ id: kaart.bronnen.length, bron, sleutels });
    } catch (e) {
      // Nooit stil: een lege kaart moet als instrumentfout te herkennen zijn, niet als
      // "dit component heeft geen sleutels".
      kaart.fouten.push(`${bron}: ${String(e)}`);
    }
    return res;
  } as Create & { __afgetapt?: true };

  gepatcht.__afgetapt = true;
  doel.create = gepatcht;
  // `actief` scheidt "de wrapper hangt erin" van "deze component gebruikt geen StyleSheet".
  // Zonder dat onderscheid faalt de walker op `Icon`, die legitiem géén create-aanroep doet,
  // met dezelfde melding als een niet-geladen module — een instrumentfout en een geldige
  // lege uitkomst zien er dan identiek uit (gemeten 2026-09-08).
  kaart.actief = true;
}

export {};
