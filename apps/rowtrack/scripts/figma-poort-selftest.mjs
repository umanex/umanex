#!/usr/bin/env node
/**
 * Tegenproef voor de publicatie- en handwerk-poort in figma/builder.js.
 *
 * De poort draait in de Figma-plugin, dus hij is niet vanaf de commandoregel aan te roepen.
 * Deze zelftest haalt de twee functies LETTERLIJK uit de bronbestand-tekst en draait ze tegen
 * stub-nodes. Dat is geen kopie van de logica maar de logica zelf: hernoem je `poort` of
 * `bouwhash`, dan valt deze test om in plaats van stil een oude kopie te blijven toetsen.
 *
 * Beide kanten worden getoetst. Een poort die altijd weigert is even nutteloos als een poort
 * die nooit weigert, en een hash die op alles verandert meldt bij elke herbouw handwerk.
 *
 * Gebruik: node scripts/figma-poort-selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRON = readFileSync(join(APP, 'figma/builder.js'), 'utf8');

/** Haal `function naam(...) { ... }` uit de brontekst door accolades te tellen. */
function pak(naam) {
  const start = BRON.search(new RegExp(`^(async )?function ${naam}\\(`, 'm'));
  if (start < 0) throw new Error(`functie ${naam} niet gevonden in figma/builder.js — hernoemd?`);
  let i = BRON.indexOf('{', start), diepte = 0;
  for (let j = i; j < BRON.length; j++) {
    if (BRON[j] === '{') diepte++;
    else if (BRON[j] === '}' && --diepte === 0) return BRON.slice(start, j + 1);
  }
  throw new Error(`functie ${naam}: geen sluitende accolade`);
}

const meldingen = [];
const scope = new (Object.getPrototypeOf(async function () {}).constructor)(
  'meldingen',
  `${pak('bouwhash')}\n${pak('poort')}\nreturn { bouwhash, poort };`,
);
const { bouwhash, poort } = await scope(meldingen);

// --- stub-nodes -------------------------------------------------------------------------
const T = (naam, tekst) => ({ type: 'TEXT', name: naam, width: 100, height: 20, characters: tekst });
const F = (naam, kinderen = [], w = 320, h = 48) => ({ type: 'FRAME', name: naam, width: w, height: h, children: kinderen });
const boom = () => F('Button', [F('content', [T('label', 'Start training')])]);

/** Maak een pagina-stub met één kind, en hang er publicatiestatus + pluginData aan. */
function pagina(kind, { status = 'UNPUBLISHED', hash = null } = {}) {
  const data = hash === null ? {} : { bouwhash: hash };
  kind.getPublishStatusAsync = async () => status;
  kind.getPluginData = (k) => data[k] ?? '';
  return { children: [kind] };
}

const gevallen = [];
const eis = (naam, ok, detail = '') => gevallen.push({ naam, ok, detail });

// --- 1. de poort laat door wanneer er niets aan de hand is -------------------------------
eis('verse pagina zonder pluginData bouwt gewoon',
  (await poort(pagina(boom()), 'Button', false)) === null);

{
  const b = boom();
  eis('ongewijzigde node met kloppende hash bouwt gewoon',
    (await poort(pagina(b, { hash: bouwhash(b) }), 'Button', false)) === null);
}

// --- 2. de poort weigert op publicatie ---------------------------------------------------
{
  const r = await poort(pagina(boom(), { status: 'PUBLISHED' }), 'Button', false);
  eis('gepubliceerde component wordt geweigerd', Array.isArray(r) && r.length === 1, JSON.stringify(r));
  eis('de weigering noemt component, node en status',
    !!r && /Button\/Button/.test(r[0]) && /PUBLISHED/.test(r[0]), r?.[0]);
}
{
  const r = await poort(pagina(boom(), { status: 'CHANGED' }), 'Button', false);
  eis('CHANGED telt óók als gepubliceerd', Array.isArray(r) && r.length === 1, JSON.stringify(r));
}

// --- 3. de poort weigert op handwerk -----------------------------------------------------
const mutaties = {
  hernoemd:    (n) => { n.children[0].name = 'wrapper'; },
  hertypt:     (n) => { n.children[0].children[0].characters = 'Stop training'; },
  vergroot:    (n) => { n.children[0].width = 260; },
  toegevoegd:  (n) => { n.children.push(T('badge', 'PR')); },
  weggehaald:  (n) => { n.children[0].children.pop(); },
};
for (const [naam, muteer] of Object.entries(mutaties)) {
  const oud = bouwhash(boom());
  const b = boom(); muteer(b);
  const r = await poort(pagina(b, { hash: oud }), 'Button', false);
  eis(`handwerk gedetecteerd: ${naam}`, Array.isArray(r) && /met de hand gewijzigd/.test(r[0]), JSON.stringify(r));
}

// --- 4. CONTROLE: waar de poort moet zwijgen ---------------------------------------------
// Figma legt bij een herbouw subpixel-ruis en nieuwe posities op. Slaat de hash daarop aan,
// dan meldt élke herbouw handwerk en is de poort binnen een week uitgezet.
{
  const oud = bouwhash(boom());
  const b = boom();
  b.x = 512; b.y = 96;                    // verplaatst op de pagina
  b.children[0].width = 320.4;            // subpixel-ruis, rondt naar dezelfde px
  b.children[0].children[0].height = 19.7;
  const r = await poort(pagina(b, { hash: oud }), 'Button', false);
  eis('CONTROLE: positie en subpixel-ruis zijn géén handwerk', r === null, JSON.stringify(r));
}
{
  // Een node zonder eerdere bouwhash is niet "gewijzigd" maar "onbekend" — niet weigeren,
  // anders blokkeert de eerste run na het invoeren van de poort alles.
  const r = await poort(pagina(boom(), { hash: null }), 'Button', false);
  eis('CONTROLE: ontbrekende hash blokkeert niet', r === null, JSON.stringify(r));
}

// --- 5. de ontsnapping is zichtbaar, niet stil -------------------------------------------
{
  meldingen.length = 0;
  const r = await poort(pagina(boom(), { status: 'PUBLISHED' }), 'Button', true);
  eis('__force laat door', r === null);
  eis('__force logt wat het overschreef',
    meldingen.length === 1 && /GEFORCEERD OVERSCHREVEN/.test(meldingen[0]), JSON.stringify(meldingen));
}

// --- 6. de hash zelf: dezelfde boom, dezelfde vingerafdruk --------------------------------
eis('bouwhash is deterministisch', bouwhash(boom()) === bouwhash(boom()));
eis('bouwhash draagt het knooppunt-aantal', bouwhash(boom()).split(':')[1] === '3');

// --- verslag ------------------------------------------------------------------------------
const stuk = gevallen.filter((g) => !g.ok);
for (const g of gevallen) console.log(`${g.ok ? '  ok' : 'FOUT'}  ${g.naam}${g.ok ? '' : `\n        ${g.detail}`}`);
console.log(`\n${gevallen.length - stuk.length}/${gevallen.length} geslaagd`);
process.exit(stuk.length ? 1 : 0);
