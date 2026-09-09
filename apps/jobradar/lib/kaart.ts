/**
 * De rekenkant van de prospectkaart: projectie en clustering.
 *
 * Los van het component, zodat `scripts/kaart-scenarios.ts` het kan uitvoeren zonder DOM.
 * Er is bewust geen kaart-library: bij drie polygonen en 227 punten in één vast bereik is
 * dit honderd regels rekenwerk tegenover 19,1 MB en 17 dependencies (gemeten).
 */

/** [minLon, minLat, maxLon, maxLat] */
export type Bbox = [number, number, number, number]

/**
 * De uitsnede van de kaart: West-Vlaanderen, Oost-Vlaanderen en Brussel.
 *
 * Gemeten op `public/geo/provincies.json`, met een marge zodat een punt aan de rand niet
 * tegen de zijkant plakt.
 */
export const KAART_BBOX: Bbox = [2.47, 50.65, 4.53, 51.43]

/**
 * Op 51°N is een graad lengte korter dan een graad breedte. Zonder die correctie wordt
 * België merkbaar uitgerekt — een kaart die niet klopt met wat mensen kennen leest als een
 * fout, ook als elke stip op de juiste plek staat.
 */
export function lonSchaal(bbox: Bbox = KAART_BBOX): number {
  const midden = (bbox[1] + bbox[3]) / 2
  return Math.cos((midden * Math.PI) / 180)
}

/** De verhouding breedte:hoogte van het viewBox, mét de correctie hierboven. */
export function verhouding(bbox: Bbox = KAART_BBOX): number {
  return ((bbox[2] - bbox[0]) * lonSchaal(bbox)) / (bbox[3] - bbox[1])
}

/**
 * Van lengte/breedte naar SVG-coördinaten binnen een viewBox van `breedte` × `hoogte`.
 *
 * `y` keert om: SVG telt naar beneden, breedtegraad naar boven. Dat vergeten levert een
 * kaart die op het eerste gezicht klopt en waarin Brugge onder Kortrijk staat.
 */
export function projecteer(
  lon: number,
  lat: number,
  breedte: number,
  hoogte: number,
  bbox: Bbox = KAART_BBOX
): { x: number; y: number } {
  const s = lonSchaal(bbox)
  const x = ((lon - bbox[0]) * s) / ((bbox[2] - bbox[0]) * s)
  const y = (bbox[3] - lat) / (bbox[3] - bbox[1])
  return { x: x * breedte, y: y * hoogte }
}

/** Ligt dit punt binnen de uitsnede? Erbuiten tekenen zou het tegen de rand plakken. */
export function binnenKaart(lon: number, lat: number, bbox: Bbox = KAART_BBOX): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
}

/**
 * Ligt dit punt in één van de provincievlakken?
 *
 * `binnenKaart` toetst de rechthoek, en dat is niet genoeg: de uitsnede is ruimer dan de
 * drie provincies. Gemeten op de eerste volledige render (2026-09-09) stonden drie
 * lead-vermoedens als losse ruiten in leeg wit, rond lon 4,41–4,45 — Vlaams-Brabant en
 * Antwerpen. Logisch, want de Adzuna-zoekstraal loopt over de provinciegrens; dat staat
 * voor vacatures al in `CLAUDE.md`. Een stip buiten elk vlak is geen locatie maar ruis.
 */
export function inProvincie(lon: number, lat: number, ringen: number[][][]): boolean {
  for (const ring of ringen) {
    let binnen = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number]
      const [xj, yj] = ring[j] as [number, number]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) binnen = !binnen
    }
    if (binnen) return true
  }
  return false
}

export type Punt = { nummer: string; x: number; y: number }
export type Cluster = { x: number; y: number; punten: Punt[] }

/**
 * Groepeert punten die binnen `straal` van elkaar liggen, in SVG-eenheden.
 *
 * Waarom dit nodig is: 43 van de 218 bedrijven staan in Gent en 29 in Brussel. Zonder
 * groeperen zijn dat twee zwarte vlekken waarin je niets kan aanwijzen.
 *
 * De methode is bewust simpel — één doorloop, eerste punt wordt het anker. Dat is niet de
 * netste clustering die bestaat, maar bij 227 punten is het verschil onzichtbaar en de
 * uitkomst is deterministisch: dezelfde invoer geeft dezelfde groepen, dus de kaart springt
 * niet tussen twee renders.
 */
export function clusterPunten(punten: Punt[], straal: number): Cluster[] {
  const clusters: Cluster[] = []
  // Sorteren maakt de uitkomst onafhankelijk van de volgorde waarin de database toevallig
  // levert. Zonder dit verschuift een cluster zodra iemand de ORDER BY wijzigt.
  const gesorteerd = [...punten].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  for (const p of gesorteerd) {
    const bij = clusters.find((c) => Math.hypot(c.x - p.x, c.y - p.y) <= straal)
    if (bij) {
      bij.punten.push(p)
      // Het anker verschuift naar het zwaartepunt, anders trekt de eerste stip de hele
      // groep naar zich toe en staat de cluster naast waar hij hoort.
      bij.x = bij.punten.reduce((s, q) => s + q.x, 0) / bij.punten.length
      bij.y = bij.punten.reduce((s, q) => s + q.y, 0) / bij.punten.length
    } else {
      clusters.push({ x: p.x, y: p.y, punten: [p] })
    }
  }
  return clusters
}

/** Een GeoJSON-ring naar een SVG-pad. Alleen `Polygon`; de drie provincies zijn dat alle drie. */
export function ringNaarPad(
  ring: number[][],
  breedte: number,
  hoogte: number,
  bbox: Bbox = KAART_BBOX
): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const { x, y } = projecteer(lon!, lat!, breedte, hoogte, bbox)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ') + ' Z'
  )
}
