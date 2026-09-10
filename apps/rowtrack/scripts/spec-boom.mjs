/**
 * De boomregels die de bouwspec en de Figma-boom op elkaar laten passen — op ÉÉN plek.
 *
 * WAAROM. `geometry-parity.mjs` en `instabiele-nodes.mjs` lopen allebei de spec-boom af en
 * bouwen allebei een boompad. Doen ze dat elk op hun eigen manier, dan zijn de paden niet
 * dezelfde sleutel en sluit de uitsluitingslijst nodes uit die er niet zijn — gemeten
 * 2026-09-08: 31 van 140 paden matchten, want `instabiele-nodes` telde ook de kinderen die de
 * builder in de `fills` van hun ouder opvouwt en parity niet.
 *
 * De opvouwregel zelf staat in figma/builder.js:217-220; dit is de lezerskant ervan.
 */

/**
 * Welke kinderen de builder in de `fills` van hun ouder opvouwt: een absoluut kind dat de
 * ouder bedekt en alléén een vulling draagt, is in CSS een achtergrondlaag en geen element
 * ernaast. Meet tegen de CONTENT-box, niet de border-box — een absoluut kind met inset 0 valt
 * binnen de rand van zijn ouder (gemeten op Button primary lg: ouder 153,05x44 met rand 1,
 * gradient 151,05x42 op dx=dy=1, precies twee keer de randbreedte kleiner).
 */
export function bedektPredikaat(n) {
  // TOLERANTIE PER ZIJDE. `n.border` is sinds 2026-09-09 het MAXIMUM van vier zijden, en die
  // waarde is hier geen randbreedte maar de inzet van de content-box — dus voor een node met
  // `0/0/1/0` zou hij de doos aan alle vier de kanten 1 px ruimer maken dan hij is. Gemeten op
  // de spec van die dag: 0 van de 77 asymmetrische nodes heeft een absoluut vullingskind, dus
  // de drie definities (boven-only, maximum, per zijde) geven alle drie 64 opgevouwen kinderen.
  // Dat is GEEN bewijs dat ze het eens zijn — het is de mededeling dat het geval hier niet
  // voorkomt. Daarom staat de meetkundig juiste regel er, niet de regel die vandaag toevallig
  // hetzelfde antwoord geeft.
  const [rBoven, rRechts, rOnder, rLinks] = n.borderZijden
    ?? [n.border ?? 0, n.border ?? 0, n.border ?? 0, n.border ?? 0];
  return (k) => k.abs && !k.k && !k.t && (k.grad || k.bg)
    && Math.abs(k.dx ?? 0) <= rLinks + 0.5 && Math.abs(k.dy ?? 0) <= rBoven + 0.5
    && k.w >= n.w - rLinks - rRechts - 0.5 && k.h >= n.h - rBoven - rOnder - 0.5;
}

/** De kinderen die in Figma een eigen node worden — dus zonder de opgevouwen achtergronden. */
export const echteKinderen = (n) => (n.k ?? []).filter((k) => !bedektPredikaat(n)(k));

/** Draagt deze node een vulling — zelf of via een opgevouwen achtergrondkind? */
export function heeftVulling(n) {
  if ((n.bg && n.bg.a > 0) || n.grad) return true;
  return (n.k ?? []).some(bedektPredikaat(n));
}

/** Een Ionicons-glyph wordt in Figma een placeholder-frame, geen tekst (builder.js:107). */
export const isIcoon = (n) => !!n.t && !n.k && /^ionicons$/i.test(n.t.f ?? '');

/** Een pure tekstnode: in Figma geen frame, dus zonder frame-eigenschappen. */
export const isTekstNode = (n) => !!n.t && !n.k;

/** Het pad van een kind, in het formaat dat beide scripts als sleutel gebruiken. */
export const kindPad = (pad, i, kind) => `${pad}>${i}:${kind.naam ?? '?'}`;

/** Loop elke gemeten boom van de spec af: componenten + schermen, hoofdboom + overlays. */
export function* bomen(spec) {
  for (const [soort, bron, uit] of [
    ['componenten', spec.componenten ?? {}, (d) => d.varianten],
    ['schermen', spec.schermen ?? {}, (d) => d.frames],
  ])
    for (const [comp, d] of Object.entries(bron))
      for (const v of uit(d)) {
        yield { soort, comp, variant: v.naam, boom: v.boom, pad: `${comp}[${v.naam}]`, index: 0 };
        (v.overlays ?? []).forEach((o, j) =>
          ({ soort, comp, variant: v.naam, boom: o, pad: `${comp}[${v.naam}]#overlay${j}`, index: j + 1 }));
      }
}
