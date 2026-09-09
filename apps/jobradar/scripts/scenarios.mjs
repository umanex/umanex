#!/usr/bin/env node
/**
 * Draait de invarianten op de scorekern en de signaal-afleiding, met hun tegenproef ervoor.
 *
 *   pnpm --filter jobradar scenarios
 *
 * Waarom dit bestaat en niet gewoon een rechtstreekse node-aanroep: een guard zonder
 * tegenproef meet niets. Breekt een refactor de `check()`-teller, dan meldt de suite voor
 * altijd groen "N/N checks geslaagd" terwijl er niets meer bewaakt wordt. Daarom draait
 * elke suite hier eerst één keer met `SCENARIO_SELFTEST=1` — dat injecteert één check die
 * moet falen — en die run hóórt niet-nul te eindigen.
 *
 * Let op de omkering: de tegenproef *slaagt* wanneer de suite *faalt*.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HIER, '..')

const SUITES = [
  { naam: 'signalen', bestand: 'scripts/signal-scenarios.ts' },
  { naam: 'upserts', bestand: 'scripts/upsert-scenarios.ts' },
  { naam: 'adzuna', bestand: 'scripts/adzuna-scenarios.ts' },
  { naam: 'config', bestand: 'scripts/config-scenarios.ts' },
  { naam: 'kbo', bestand: 'scripts/kbo-scenarios.ts' },
  { naam: 'spiegel', bestand: 'scripts/spiegel-scenarios.ts' },
]

/** Draait één suite en geeft exitcode + uitvoer terug. Gooit niet: de uitkomst ís het antwoord. */
function draai(bestand, env = {}) {
  return new Promise((klaar) => {
    const proc = spawn(
      process.execPath,
      [
        // Node 24 strip de types zelf; de hook lost enkel de extensieloze imports op.
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        '--import',
        './scripts/ts-resolve.mjs',
        bestand,
      ],
      { cwd: APP, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let uitvoer = ''
    proc.stdout.on('data', (d) => (uitvoer += d))
    proc.stderr.on('data', (d) => (uitvoer += d))
    proc.on('close', (code) => klaar({ code, uitvoer }))
  })
}

/** De laatste regel met een telling — dat is de samenvatting die de suite zelf print. */
function samenvatting(uitvoer) {
  const regels = uitvoer.split('\n').filter((r) => /checks geslaagd/.test(r))
  return regels[regels.length - 1]?.trim() ?? '(geen samenvatting)'
}

let gezakt = false

// ── Fase 1: de tegenproef ────────────────────────────────────────────────────
for (const suite of SUITES) {
  const { code, uitvoer } = await draai(suite.bestand, { SCENARIO_SELFTEST: '1' })
  if (code === 0) {
    gezakt = true
    console.error(`✗ tegenproef ${suite.naam}: de suite meldde succes terwijl er een fout in zat`)
    console.error('  De ingebouwde zelftest-check werd niet als fout geteld — deze suite bewaakt niets meer.')
  } else {
    console.log(`✓ tegenproef ${suite.naam}: valt met exit ${code} op een geïnjecteerde fout — ${samenvatting(uitvoer)}`)
  }
}

// ── Fase 2: de echte run ─────────────────────────────────────────────────────
let totaal = 0
for (const suite of SUITES) {
  const { code, uitvoer } = await draai(suite.bestand)
  const kop = samenvatting(uitvoer)
  totaal += Number(kop.match(/\/(\d+) checks/)?.[1] ?? 0)

  if (code === 0) {
    console.log(`✓ ${suite.naam}: ${kop}`)
    continue
  }
  gezakt = true
  console.error(`\n✗ ${suite.naam}: ${kop}\n`)
  for (const regel of uitvoer.split('\n').filter((r) => r.includes('FAIL'))) {
    console.error(`  ${regel.trim()}`)
  }
  console.error('')
}

console.log('')
console.log(
  gezakt
    ? '✗ scenarios: de kern is niet groen (of een suite kan niet meer falen)'
    : `✓ scenarios: ${totaal} checks over ${SUITES.length} suite(s), en bewezen faalbaar`
)

process.exit(gezakt ? 1 : 0)
