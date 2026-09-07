/**
 * Tegenproef op figma-sync-check.mjs. Een guard die draait is nog geen guard die meet:
 * deze test bouwt per as het defect dat de guard moet vangen, en eist dat hij er rood
 * op gaat — mét de juiste as in het rapport. Draait ook de ongewijzigde kopie als
 * zwijg-kant: zonder mutatie moet de guard groen zijn, anders slaat hij vals alarm.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ui = join(dirname(fileURLToPath(import.meta.url)), '..');
const guard = join(ui, 'scripts/figma-sync-check.mjs');

/** Zet een wegwerp-kopie van de mappen die de guard leest. */
function verseKopie() {
  const tmp = mkdtempSync(join(tmpdir(), 'figma-sync-selftest-'));
  mkdirSync(join(tmp, 'ui/components'), { recursive: true });
  mkdirSync(join(tmp, 'tokens/build'), { recursive: true });
  cpSync(join(ui, 'components/ui'), join(tmp, 'ui/components/ui'), { recursive: true });
  cpSync(join(ui, 'figma'), join(tmp, 'ui/figma'), { recursive: true });
  cpSync(join(ui, '../tokens/build/roles.mjs'), join(tmp, 'tokens/build/roles.mjs'));
  // De twee nieuwe assen lezen deze bronnen. Zonder de kopie slaan ze over, en een
  // overgeslagen as ziet er in het rapport uit als een groene.
  cpSync(join(ui, '../tokens/build/typography.mjs'), join(tmp, 'tokens/build/typography.mjs'));
  cpSync(join(ui, '../tokens/build/theme.css'), join(tmp, 'tokens/build/theme.css'));
  cpSync(join(ui, '../tokens/tokens.json'), join(tmp, 'tokens/tokens.json'));
  return { tmp, uiRoot: join(tmp, 'ui') };
}
const draai = uiRoot => {
  try {
    return { code: 0, out: execFileSync('node', [guard, `--root=${uiRoot}`], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
};
const lees = p => readFileSync(p, 'utf8');
const schrijf = (p, s) => writeFileSync(p, s);

const gevallen = [
  {
    naam: 'variant bijgekomen in de code',
    as: '[variant]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'components/ui/badge.tsx');
      schrijf(p, lees(p).replace(
        "        outline: 'text-foreground',",
        "        outline: 'text-foreground',\n        info: 'border-transparent bg-primary text-primary-foreground',"));
    },
  },
  {
    naam: 'text style wijkt af van de tokenschaal',
    as: '[typografie]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p)); m.textStyles[0].fontSize = 99;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'text style draagt een family buiten fontFamily',
    as: '[typografie]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p)); m.textStyles[1].family = 'Comic Sans MS';
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'themawaarde wijkt af van theme.css (schema 2)',
    as: '[themawaarde]',
    muteer: uiRoot => {
      // Bouw eerst een schema-2-manifest uit theme.css zelf zodat de as kán draaien, en
      // muteer dan één waarde. Zonder die eerste helft toets je de skip-tak, niet de as.
      const p = join(uiRoot, 'figma/manifest.json');
      const css = lees(join(uiRoot, '../tokens/build/theme.css'));
      const blok = sel => {
        const mm = css.match(new RegExp(sel.replace('.', '\\.') + '\\s*\\{([^}]*)\\}'));
        return Object.fromEntries([...mm[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(x => [x[1], x[2].trim()]));
      };
      const lt = blok(':root'), dk = blok('.dark');
      const m = JSON.parse(lees(p));
      m.schemaVersie = 2;
      m.collections.Theme.waarden = Object.fromEntries(
        Object.keys(lt).filter(k => k in dk).map(k => [k, { Light: lt[k], Dark: dk[k] }]));
      m.collections.Theme.waarden[Object.keys(m.collections.Theme.waarden)[0]].Light = '240 100% 50%';
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'component zonder Figma-pagina',
    as: '[pagina]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      delete m.pages.Slider;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'tokenrol ontbreekt in Figma',
    as: '[token]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Theme.variables = m.collections.Theme.variables.filter(v => v !== 'warning');
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'radius-afgeleide volgt de preset niet meer',
    as: '[schaal]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Base.variables['radius-md'] = 7;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'spacing wijkt af van n × 4px',
    as: '[schaal]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Base.variables['spacing-4'] = 15;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'Base-variabele zonder bekende categorie (drift)',
    as: '[schaal]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Base.variables['shadow-offset'] = 3;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    naam: 'icon-stroke wijkt af van lucide',
    as: '[schaal]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Base.variables['icon-stroke'] = 1.5;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    // Afgaan-kant van de dekkings-as: een variabele die nergens in tokens.json staat en
    // ook niet als bekende schuld genoteerd is. Precies het defect uit de learning.
    naam: 'nieuwe variabele zonder token in de bron',
    as: '[dekking]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'figma/manifest.json');
      const m = JSON.parse(lees(p));
      m.collections.Base.variables['spacing-7'] = 28;
      schrijf(p, JSON.stringify(m, null, 2));
    },
  },
  {
    // De tweede kant van BEKENDE_GATEN: zodra de schuld ingelost is moet de lijst
    // krimpen. Zonder deze case veroudert hij stil en dekt hij op den duur precies af
    // wat de as moet vangen.
    naam: 'bekend gat heeft nu wél een token',
    as: '[dekking]',
    muteer: uiRoot => {
      const p = join(uiRoot, '../tokens/tokens.json');
      const t = JSON.parse(lees(p));
      t.Base = { 'icon-stroke': { $value: '2', $type: 'number' } };
      schrijf(p, JSON.stringify(t, null, 2));
    },
  },
  {
    // Lege bron: "niets gevonden" en "instrument kapot" zien er allebei leeg uit. De as
    // moet hier één instrumentmelding geven, niet twintig losse bevindingen.
    naam: 'lege token-bron leest als instrumentfout',
    as: '[dekking]',
    bevat: 'instrumentfout, geen bevinding',
    muteer: uiRoot => schrijf(join(uiRoot, '../tokens/tokens.json'), '{"$metadata":{}}'),
  },
  {
    naam: 'deep-link wijst naar de node van een ander component',
    as: '[link]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'components/ui/card.stories.tsx');
      schrijf(p, lees(p).replace('node-id=27-432', 'node-id=27-374'));
    },
  },
  {
    naam: 'deep-link ontbreekt',
    as: '[link]',
    muteer: uiRoot => {
      const p = join(uiRoot, 'components/ui/tooltip.stories.tsx');
      schrijf(p, lees(p).replace(/\n\s*figma: \{ url: '[^']+' \},/, ''));
    },
  },
];

let stuk = 0;
console.log('figma-sync-selftest — tegenproef per as\n');

// Zwijg-kant: zonder mutatie moet de guard groen zijn.
{
  const { tmp, uiRoot } = verseKopie();
  const r = draai(uiRoot);
  rmSync(tmp, { recursive: true, force: true });
  if (r.code === 0) console.log('  ok   zwijg-kant: ongewijzigde kopie is groen');
  else { console.log('  FAIL zwijg-kant: guard slaat alarm zonder defect\n' + r.out); stuk++; }
}

// Afgaan-kant: elk defect moet rood worden, op de juiste as.
for (const g of gevallen) {
  const { tmp, uiRoot } = verseKopie();
  g.muteer(uiRoot);
  const r = draai(uiRoot);
  rmSync(tmp, { recursive: true, force: true });
  if (r.code === 0) { console.log(`  FAIL ${g.naam}: guard bleef groen mét het defect`); stuk++; continue; }
  if (!r.out.includes('FAIL ' + g.as)) {
    console.log(`  FAIL ${g.naam}: guard ging rood, maar niet op ${g.as}`);
    stuk++; continue;
  }
  // Sommige gevallen delen een as maar mogen niet hetzelfde zéggen: een kapot
  // instrument moet als instrumentfout lezen, niet als twintig bevindingen.
  if (g.bevat && !r.out.includes(g.bevat)) {
    console.log(`  FAIL ${g.naam}: rood op ${g.as}, maar de melding mist "${g.bevat}"`);
    stuk++; continue;
  }
  console.log(`  ok   ${g.naam} → rood op ${g.as}`);
}

if (stuk) { console.log(`\n${stuk} van ${gevallen.length + 1} tegenproeven faalde. De guard meet niet wat hij belooft.`); process.exit(1); }
console.log(`\n${gevallen.length + 1} tegenproeven geslaagd (1 zwijg-kant, ${gevallen.length} afgaan-kant).`);
