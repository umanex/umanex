/**
 * De rekenkant van de prospectkaart. Geen DOM, geen netwerk — `lib/kaart.ts` staat er los
 * van juist zodat dit kan.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KAART_BBOX,
  binnenKaart,
  clusterPunten,
  lonSchaal,
  projecteer,
  inProvincie,
  ringNaarPad,
  verhouding,
} from '../lib/kaart'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let geslaagd = 0
let gezakt = 0
function check(naam: string, waar: boolean, detail = '') {
  if (waar) geslaagd++
  else {
    gezakt++
    console.error(`  FAIL  ${naam}${detail ? ` — ${detail}` : ''}`)
  }
}
const bijna = (a: number, b: number, marge = 0.5) => Math.abs(a - b) <= marge

// ── 1. De projectie ─────────────────────────────────────────────────────────
{
  const B = 1000
  const H = 500

  const lo = projecteer(KAART_BBOX[0], KAART_BBOX[3], B, H)
  check('linksboven van de bbox is (0,0)', bijna(lo.x, 0) && bijna(lo.y, 0), `${lo.x},${lo.y}`)
  const rb = projecteer(KAART_BBOX[2], KAART_BBOX[1], B, H)
  check('rechtsonder is (breedte,hoogte)', bijna(rb.x, B) && bijna(rb.y, H), `${rb.x},${rb.y}`)

  // SVG telt naar beneden, breedtegraad naar boven. Dit vergeten geeft een kaart die op het
  // eerste gezicht klopt en waarin Brugge onder Kortrijk staat.
  const brugge = projecteer(3.224, 51.209, B, H)
  const kortrijk = projecteer(3.265, 50.828, B, H)
  check('noordelijker = hoger op het scherm', brugge.y < kortrijk.y, `Brugge y=${brugge.y.toFixed(0)} Kortrijk y=${kortrijk.y.toFixed(0)}`)
  check('oostelijker = verder naar rechts', kortrijk.x > brugge.x, `${kortrijk.x.toFixed(0)} vs ${brugge.x.toFixed(0)}`)

  // Zonder de cos(lat)-correctie wordt België merkbaar uitgerekt.
  check('de lengtegraad-correctie zit tussen 0,6 en 0,7 op 51°N', lonSchaal() > 0.6 && lonSchaal() < 0.7, String(lonSchaal().toFixed(4)))
  check('de verhouding b:h ligt rond 1,66', bijna(verhouding(), 1.66, 0.05), String(verhouding().toFixed(3)))

  check('Gent valt binnen de uitsnede', binnenKaart(3.72, 51.05))
  check('Brugge ook', binnenKaart(3.224, 51.209))
  check('Brussel ook', binnenKaart(4.35, 50.85))
  // Let op: `binnenKaart` toetst de rechthoek, niet de provincies. Antwerpen (4,40 · 51,22)
  // ligt wél in die rechthoek en niet in de drie provincies — de uitsnede is ruimer dan de
  // vlakken die erin getekend worden, en dat is bedoeld.
  check('Antwerpen valt binnen de rechthoek maar niet in een provincie', binnenKaart(4.4, 51.22))
  check('Hasselt ligt buiten de uitsnede', !binnenKaart(5.34, 50.93))
  check('Luik ligt erbuiten', !binnenKaart(5.57, 50.63))
  check('Amsterdam ligt erbuiten', !binnenKaart(4.9, 52.37))
  check('Rijsel ligt erbuiten', !binnenKaart(3.06, 50.63))
}

// ── 2. Clustering ───────────────────────────────────────────────────────────
{
  const p = (nummer: string, x: number, y: number) => ({ nummer, x, y })

  const los = clusterPunten([p('a', 0, 0), p('b', 100, 100), p('c', 200, 200)], 10)
  check('drie verre punten blijven drie clusters', los.length === 3, String(los.length))

  const samen = clusterPunten([p('a', 0, 0), p('b', 3, 4), p('c', 200, 200)], 10)
  check('twee nabije punten worden één cluster', samen.length === 2, String(samen.length))
  const groot = samen.find((c) => c.punten.length === 2)
  check('en die cluster draagt beide punten', !!groot && groot.punten.length === 2)
  check('het anker is het zwaartepunt, niet het eerste punt', !!groot && bijna(groot.x, 1.5, 0.01) && bijna(groot.y, 2, 0.01), groot ? `${groot.x},${groot.y}` : '—')

  // Deterministisch: dezelfde invoer in een andere volgorde geeft dezelfde groepen. Zonder
  // dat springt de kaart tussen twee renders zodra de ORDER BY verandert.
  const a = clusterPunten([p('a', 0, 0), p('b', 3, 4), p('c', 50, 50), p('d', 52, 51)], 10)
  const b = clusterPunten([p('d', 52, 51), p('c', 50, 50), p('b', 3, 4), p('a', 0, 0)], 10)
  check(
    'de uitkomst hangt niet van de invoervolgorde af',
    JSON.stringify(a.map((c) => c.punten.map((q) => q.nummer).sort())) ===
      JSON.stringify(b.map((c) => c.punten.map((q) => q.nummer).sort())),
    JSON.stringify(a.map((c) => c.punten.length)) + ' vs ' + JSON.stringify(b.map((c) => c.punten.length))
  )

  const alles = clusterPunten([p('a', 0, 0), p('b', 3, 4), p('c', 50, 50), p('d', 52, 51)], 10)
  const totaal = alles.reduce((s, c) => s + c.punten.length, 0)
  check('geen punt raakt zoek bij het clusteren', totaal === 4, String(totaal))
  check('een lege invoer geeft geen clusters', clusterPunten([], 10).length === 0)
}

// ── 3. De provinciegrenzen ──────────────────────────────────────────────────
{
  const geo = JSON.parse(readFileSync(join(APP, 'public/geo/provincies.json'), 'utf8'))
  check('het bestand draagt zijn herkomst', typeof geo.bron === 'string' && geo.bron.length > 10, String(geo.bron))
  check('drie provincies', geo.features.length === 3, String(geo.features.length))
  const namen = geo.features.map((f: { properties: { naam: string } }) => f.properties.naam).sort()
  check(
    'met Nederlandse namen',
    JSON.stringify(namen) === JSON.stringify(['Brussel', 'Oost-Vlaanderen', 'West-Vlaanderen']),
    JSON.stringify(namen)
  )
  check('alle drie zijn enkelvoudige polygonen', geo.features.every((f: { geometry: { type: string } }) => f.geometry.type === 'Polygon'))

  // Elke grens moet bínnen de uitsnede vallen, anders klopt de bbox niet met de data.
  let buiten = 0
  for (const f of geo.features) for (const [lon, lat] of f.geometry.coordinates[0]) if (!binnenKaart(lon, lat)) buiten++
  check('elk grenspunt valt binnen de uitsnede', buiten === 0, `${buiten} erbuiten`)

  // ── binnen de rechthoek is niet binnen een provincie ──────────────────────
  // Gemeten op de eerste render: drie lead-vermoedens stonden als losse ruiten in leeg wit,
  // rond lon 4,41–4,45. Ze pasten in de bbox en in geen enkel vlak.
  {
    const ringen = geo.features.map((f: { geometry: { coordinates: number[][][] } }) => f.geometry.coordinates[0])
    const gevallen: [string, number, number, boolean][] = [
      ['Gent', 3.72, 51.05, true],
      ['Brugge', 3.224, 51.209, true],
      ['Brussel-centrum', 4.35, 50.85, true],
      // Deze drie kwamen echt uit de geocode-run en stonden op de kaart in het niets.
      ['een vermoeden bij Zaventem', 4.454, 50.888, false],
      ['een vermoeden bij Mechelen', 4.451, 51.057, false],
      ['een vermoeden bij Antwerpen', 4.411, 51.213, false],
      ['Hasselt', 5.34, 50.93, false],
    ]
    for (const [naam, lon, lat, verwacht] of gevallen) {
      check(
        `${naam} ${verwacht ? 'ligt in' : 'ligt buiten'} een provincievlak`,
        inProvincie(lon, lat, ringen) === verwacht,
        String(inProvincie(lon, lat, ringen))
      )
    }
    // De scherpste: de rechthoek en de vlakken zijn níet hetzelfde. Zonder dit geval zou een
    // bbox-check als punt-in-polygoon kunnen doorgaan.
    check(
      'de rechthoek is ruimer dan de vlakken — Antwerpen zit in de eerste, niet in de tweede',
      binnenKaart(4.4, 51.22) && !inProvincie(4.4, 51.22, ringen)
    )
  }

  const pad = ringNaarPad(geo.features[0].geometry.coordinates[0], 1000, 500)
  check('een ring wordt een gesloten SVG-pad', pad.startsWith('M') && pad.endsWith(' Z'), pad.slice(0, 40))
  check('en bevat geen NaN', !/NaN/.test(pad))
}

if (process.env.SCENARIO_SELFTEST === '1') check('zelftest: deze check hoort te falen', false, 'opzettelijk')

const totaal = geslaagd + gezakt
console.log(`${geslaagd}/${totaal} checks geslaagd`)
process.exit(gezakt > 0 ? 1 : 0)
