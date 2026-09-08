#!/usr/bin/env node
/** Emit de compacte regels die het figma_execute-blok parst. Eén regel per variabele. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = JSON.parse(readFileSync(join(APP, 'figma/tokens-payload.json'), 'utf8'));
const h = c => Math.round(c * 255).toString(16).padStart(2, '0');
const enc = v => {
  if (v.alias) return `${v.naam}|A|${v.alias.set}:${v.alias.naam}`;
  if (v.type === 'COLOR') { const c = v.waarde; return `${v.naam}|C|${h(c.r)}${h(c.g)}${h(c.b)}${h(c.a ?? 1)}`; }
  if (v.type === 'FLOAT') return `${v.naam}|F|${v.waarde}`;
  // R = render-familie: de Figma-kant lost de familienaam op uit de expoBase, zodat de
  // vertaaltabel bij de fontlijst staat en niet hier.
  if (v.expoBase) return `${v.naam}|R|${v.expoBase}`;
  return `${v.naam}|S|${v.waarde}`;
};
const set = process.argv[2];
if (set === 'styles') {
  for (const t of p.textStyles) {
    console.log([t.naam, t.expoVariant, t.fontSize, t.lineHeight ?? '', t.letterSpacingPct ?? '',
      t.binding.fontFamily ?? '', t.binding.fontSize ?? '', t.binding.lineHeight ?? '',
      t.binding.letterSpacing ?? '', t.binding.fontWeight ?? ''].join('|'));
  }
} else if (set === 'effects') {
  console.log(JSON.stringify(p.effectStyles));
} else {
  for (const v of p.collecties[set].variabelen) console.log(enc(v));
}
