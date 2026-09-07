#!/usr/bin/env node
/**
 * Tegenproef op design-system-guard.mjs.
 *
 * Een guard die draait is nog geen guard die meet. Deze test bouwt per as het defect dat
 * de guard moet vangen en eist dat hij er rood op gaat, mét de juiste as in het rapport.
 * De zwijg-kant staat erbij: op een schone fixture moet hij groen zijn, anders slaat hij
 * vals alarm en leert hij vooral hoe je `--no-verify` typt.
 *
 * Twee gevallen zijn regressies op een gemeten fout. De eerste versie van de guard stond
 * groen op cashflow — de app waarvoor hij gebouwd was — omdat `next.config.mjs` de package
 * in `transpilePackages` noemt en het meetbereik de app-root meenam. Geval [config-noemt]
 * en [alleen-scripts] houden dat gat dicht.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const guard = join(dirname(fileURLToPath(import.meta.url)), 'design-system-guard.mjs');

const SECTIE = app => `# ${app}

## Design-systeem-bron

- **Preset:** \`@umanex/config/tailwind/preset\`
- **Componentbron:** \`@umanex/ui\`
- **Storybook:** \`pnpm --filter @umanex/ui storybook\` (:6006)

## Verify-pad

geen
`;

const TW = `import preset from '@umanex/config/tailwind/preset';
export default { presets: [preset], content: [] };
`;

/** Een schone fixture: één app die alles correct declareert en de package echt gebruikt. */
function verseFixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-selftest-'));
  const app = join(tmp, 'apps/demo');
  mkdirSync(join(app, 'components'), { recursive: true });
  mkdirSync(join(tmp, 'packages/ui'), { recursive: true });

  writeFileSync(join(tmp, 'packages/ui/package.json'), JSON.stringify({
    name: '@umanex/ui',
    exports: {
      './components/ui/button': './components/ui/button.tsx',
      './components/ui/card': './components/ui/card.tsx',
      './lib/utils': './lib/utils.ts',
    },
  }, null, 2));

  writeFileSync(join(app, 'CLAUDE.md'), SECTIE('demo'));
  writeFileSync(join(app, 'tailwind.config.ts'), TW);
  writeFileSync(join(app, 'package.json'), JSON.stringify({
    name: 'demo', dependencies: { '@umanex/ui': 'workspace:*' },
  }, null, 2));
  writeFileSync(join(app, 'components/Panel.tsx'),
    `import { Button } from '@umanex/ui/components/ui/button';\nexport const Panel = () => <Button />;\n`);
  return { tmp, app };
}

const draai = root => {
  try {
    const o = execFileSync('node', [guard, `--root=${root}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: o };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
};
const schrijf = (p, s) => writeFileSync(p, s);
const rm = p => rmSync(p, { force: true, recursive: true });

const gevallen = [
  {
    naam: 'sectie ontbreekt',
    as: '[sectie]',
    muteer: app => schrijf(join(app, 'CLAUDE.md'), '# demo\n\n## Verify-pad\n\ngeen\n'),
  },
  {
    naam: 'veld leeg gelaten',
    as: '[velden]',
    muteer: app => schrijf(join(app, 'CLAUDE.md'),
      SECTIE('demo').replace('- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)', '- **Storybook:**')),
  },
  {
    naam: 'sectie noemt een andere preset dan de config',
    as: '[preset]',
    muteer: app => schrijf(join(app, 'CLAUDE.md'),
      SECTIE('demo').replace('@umanex/config/tailwind/preset', '@umanex/rowtrack-tokens/tailwind/preset')),
  },
  {
    naam: 'sectie zegt "geen" terwijl de config een preset importeert',
    as: '[preset]',
    muteer: app => schrijf(join(app, 'CLAUDE.md'),
      SECTIE('demo').replace('`@umanex/config/tailwind/preset`', 'geen')),
  },
  {
    naam: 'sectie noemt een preset terwijl er geen config is',
    as: '[preset]',
    muteer: app => rm(join(app, 'tailwind.config.ts')),
  },
  {
    naam: 'lokale kopie van een export van @umanex/ui',
    as: '[dubbel]',
    muteer: app => {
      mkdirSync(join(app, 'components/ui'), { recursive: true });
      schrijf(join(app, 'components/ui/button.tsx'), 'export const Button = () => null;\n');
    },
  },
  {
    naam: 'declareert @umanex/ui maar importeert hem nergens',
    as: '[adoptie]',
    muteer: app => schrijf(join(app, 'components/Panel.tsx'), 'export const Panel = () => null;\n'),
  },
  {
    naam: 'dependency aanwezig terwijl de sectie "eigen" zegt en niets importeert',
    as: '[adoptie]',
    muteer: app => {
      schrijf(join(app, 'CLAUDE.md'), SECTIE('demo').replace('`@umanex/ui`', 'eigen'));
      schrijf(join(app, 'components/Panel.tsx'), 'export const Panel = () => null;\n');
    },
  },
  {
    naam: 'config-noemt — enige vermelding staat in next.config.mjs',
    as: '[adoptie]',
    muteer: app => {
      schrijf(join(app, 'components/Panel.tsx'), 'export const Panel = () => null;\n');
      schrijf(join(app, 'next.config.mjs'), `export default { transpilePackages: ['@umanex/ui'] };\n`);
    },
  },
  {
    naam: 'alleen-scripts — enige import staat in een render-harness',
    as: '[adoptie]',
    muteer: app => {
      schrijf(join(app, 'components/Panel.tsx'), 'export const Panel = () => null;\n');
      mkdirSync(join(app, 'scripts'), { recursive: true });
      schrijf(join(app, 'scripts/render.tsx'),
        `import { Button } from '@umanex/ui/components/ui/button';\nconsole.log(Button);\n`);
    },
  },
];

let gezakt = 0;

// Zwijg-kant eerst: is de schone fixture groen? Zo niet, meet de rest niets.
{
  const { tmp, app: _ } = verseFixture();
  const r = draai(tmp);
  if (r.code !== 0) {
    console.error(`✗ zwijg-kant: schone fixture geeft exit ${r.code} — de guard slaat vals alarm.\n${r.out}`);
    gezakt++;
  } else {
    console.log('✓ zwijg-kant — schone fixture: groen');
  }
  rm(tmp);
}

for (const g of gevallen) {
  const { tmp, app } = verseFixture();
  g.muteer(app);
  const r = draai(tmp);
  if (r.code === 0) {
    console.error(`✗ ${g.naam}: guard bleef groen, verwacht ${g.as}`);
    gezakt++;
  } else if (!r.out.includes(g.as)) {
    console.error(`✗ ${g.naam}: guard ging rood, maar zonder ${g.as}\n${r.out}`);
    gezakt++;
  } else {
    console.log(`✓ ${g.as.padEnd(11)} ${g.naam}`);
  }
  rm(tmp);
}

if (gezakt) {
  console.error(`\n✗ ${gezakt} van ${gevallen.length + 1} gevallen gezakt.`);
  process.exit(1);
}
console.log(`\n✓ ${gevallen.length + 1}/${gevallen.length + 1} — de guard gaat rood op elk defect en zwijgt op een schone fixture.`);
