/**
 * Welke story-componenten een SCHERM zijn in plaats van een library-component.
 *
 * EEN BRON. Deze lijst stond tot 2026-09-08 twee keer los in de repo — als frame-namen in
 * `figma-build-spec.mjs` en als reden-tekst in `figma-sync-check.mjs` — en `figma-links.mjs`
 * kende hem helemaal niet. Drie plekken die hetzelfde moeten weten en het los opschrijven,
 * lopen uiteen zodra er een scherm bijkomt.
 *
 * WAT EEN SCHERM ONDERSCHEIDT. Een component is herbruikbaar en hoort in de library; een
 * scherm is een compositie die je één keer samenstelt. Twee gevolgen, allebei afdwingbaar:
 *
 *  · Geen variant-assen. `bleStatus × hrStatus × phase × hasProfileWeight` zou 160 nodes
 *    eisen voor één scherm, en die assen zijn in beeld niet orthogonaal. In plaats daarvan
 *    een handvol REPRESENTATIEVE frames, met de hand gekozen — dat is `frames` hieronder.
 *  · Geen pagina in het library-bestand. Een scherm hoort in `RowTrack - Design` op
 *    *Screens v2*, niet tussen de componenten. `[pagina]`, `[link]` en `figma-links.mjs`
 *    slaan ze daarom over — expliciet en telbaar, niet door de as zachter te maken.
 */
export const SCHERMEN = {
  ActivePhase: {
    frames: ['Playground', 'Doel Afstand', 'Zonder Hartslagband', 'Doel Bereikt', 'Samenvatting', 'Landscape'],
    reden: 'schermcompositie — bleStatus × hrStatus × phase × hasProfileWeight zou 160 nodes eisen voor één scherm, en die assen zijn in beeld niet orthogonaal; hoort in RowTrack - Design op Screens v2',
  },
  IdlePhase: {
    frames: ['Playground', 'Niet Verbonden', 'Doel Afstand', 'Toestel Keuze'],
    reden: 'schermcompositie — idem, 320 nodes; hoort in RowTrack - Design op Screens v2',
  },
};

/** Is dit story-component een scherm? */
export const isScherm = (comp) => Object.hasOwn(SCHERMEN, comp);
