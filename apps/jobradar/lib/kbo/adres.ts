/**
 * Adresbewerkingen op KBO-data, los van elk script.
 *
 * Waarom een eigen bestand: deze functie stond eerst in `scripts/geocode.mjs`, en dat script
 * draait `main()` op moduleniveau. Een suite die hem importeerde startte dus de hele
 * geocoder — met een spiegel op schijf zou dat een publieke dienst bevraagd hebben omdat
 * iemand een invariant wilde toetsen. Een module die je kan importeren mag niets doen.
 */

/**
 * Haalt de deelgemeente-marker uit een KBO-straatnaam.
 *
 * KBO schrijft `Zavelstraat(STE)`, `Spinnerijstraat(Kor)`, `Steenkaaistraat (BAA)`.
 * Nominatim kent die niet en antwoordt "niet gevonden" — gemeten op het geleverde bestand
 * dragen 16 van de 215 adressen zo'n achtervoegsel (7,4%), en op precies zo'n adres
 * (AUCXIS, `Zavelstraat(STE) 40`) sloeg de geocoding om van niets naar een
 * huisnummer-treffer zodra de marker eraf ging.
 */
export function schoneStraat(naam: string | null | undefined): string {
  return (naam ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
