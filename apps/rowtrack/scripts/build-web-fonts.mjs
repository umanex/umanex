#!/usr/bin/env node
/**
 * Genereert de @font-face-laag voor de web-render (Storybook) uit dezelfde bron als de app.
 *
 * WAAROM DIT GEEN TWEEDE LIJST IS. `constants/fonts.ts` wordt gegenereerd uit de FONTS-bron
 * in `style-dictionary.config.mjs` — de enige plek waar font-gewichten staan. Dit script
 * leest dat gegenereerde bestand en niets anders: de import-regels geven per variant het
 * npm-pakket, de fontMap geeft welke varianten de app werkelijk laadt. Een variant die daar
 * bijkomt of wegvalt, komt hier vanzelf mee. Een handgeschreven lijst zou binnen één
 * tokenwijziging uit elkaar lopen.
 *
 * react-native-web mapt `fontFamily: 'AlbertSans_400Regular'` één-op-één op de CSS
 * font-family. Elke variant is dus zijn eigen family — precies zoals expo-font ze
 * registreert — en font-weight/style blijven `normal`, anders synthetiseert de browser
 * bovenop een bestand dat het gewicht al draagt.
 *
 * Uitvoer:  .storybook/public/fonts/*.ttf  (gitignored, kopie)
 *           .storybook/fonts.css           (gitignored, gegenereerd)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const require_ = createRequire(join(APP, 'package.json'));

const bron = readFileSync(join(APP, 'constants/fonts.ts'), 'utf8');

// 1. import-blokken: welke variant komt uit welk pakket.
const pakketVan = {};
for (const m of bron.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)';/g)) {
  const pkg = m[2];
  for (const naam of m[1].split(',').map(s => s.trim()).filter(Boolean)) pakketVan[naam] = pkg;
}

// 2. fontMap: welke varianten de app werkelijk laadt. Dat is de lijst die telt — een
//    geïmporteerde maar ongebruikte variant hoort niet in de web-render.
const mapBlok = bron.match(/export const fontMap = \{([\s\S]*?)\} as const;/);
if (!mapBlok) throw new Error('[web-fonts] fontMap niet gevonden in constants/fonts.ts');
const varianten = mapBlok[1].split(',').map(s => s.trim()).filter(Boolean);

if (!varianten.length) throw new Error('[web-fonts] fontMap is leeg — dat kan niet kloppen');

const uitDir = join(APP, '.storybook/public/fonts');
if (existsSync(uitDir)) rmSync(uitDir, { recursive: true });
mkdirSync(uitDir, { recursive: true });

const regels = [];
const ontbreekt = [];
for (const variant of varianten) {
  const pkg = pakketVan[variant];
  if (!pkg) { ontbreekt.push(`${variant}: geen import-regel in constants/fonts.ts`); continue; }
  // De map heet de variant zonder zijn ExpoBase-prefix: AlbertSans_400Regular -> 400Regular.
  const submap = variant.slice(variant.indexOf('_') + 1);
  let pad;
  try {
    pad = require_.resolve(`${pkg}/${submap}/${variant}.ttf`);
  } catch {
    ontbreekt.push(`${variant}: ${pkg}/${submap}/${variant}.ttf niet vindbaar`);
    continue;
  }
  copyFileSync(pad, join(uitDir, `${variant}.ttf`));
  regels.push(
    `@font-face {\n  font-family: '${variant}';\n  src: url('/fonts/${variant}.ttf') format('truetype');\n` +
    `  font-weight: normal;\n  font-style: normal;\n  font-display: block;\n}`,
  );
}

if (ontbreekt.length) {
  console.error('[web-fonts] niet opgelost:');
  for (const o of ontbreekt) console.error('  - ' + o);
  process.exit(1);
}

writeFileSync(
  join(APP, '.storybook/fonts.css'),
  `/* GEGENEREERD door scripts/build-web-fonts.mjs — niet met de hand bewerken.\n` +
  `   Bron: constants/fonts.ts, zelf gegenereerd uit de FONTS-bron in style-dictionary.config.mjs. */\n\n` +
  regels.join('\n\n') + '\n',
);

console.log(`[web-fonts] ${regels.length} @font-face-regels geschreven naar .storybook/fonts.css`);
console.log(`[web-fonts] ${regels.length} bestanden gekopieerd naar .storybook/public/fonts/`);
