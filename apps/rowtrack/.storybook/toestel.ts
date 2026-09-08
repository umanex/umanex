/**
 * Toestelmaten voor SCHERM-stories.
 *
 * GEEN designtoken — een toestelmaat komt van het toestel, net als de safe-area-insets die
 * in de schermstories op nul staan. Daarom hier en niet in `tokens/tokens.json`.
 *
 * WAAROM DIT BESTAAT. De standaard-decorator zet `padding: 24` en `alignItems: 'flex-start'`,
 * zodat een component zijn eigen maat houdt. Voor een SCHERM is dat fout: ActivePhase mat
 * daardoor 303,52 x 719 in plaats van 430 x 932 (gemeten 2026-09-08), en landscape — dat op
 * `useWindowDimensions()` schakelt — rendeerde nooit, want het viewport stond vast op portret.
 * Elk `alignSelf`-verschil in een nieuwe wrapper was daarmee óf vals alarm óf onzichtbaar.
 *
 * Een story die `parameters.toestel` zet, krijgt een full-bleed decorator op deze maat, en
 * `scripts/figma-build-spec.mjs` zet het browserviewport erop vóór hij meet.
 */
export const TOESTEL = {
  /** iPhone 14 Pro Max, logische punten. */
  portret: { breedte: 430, hoogte: 932 },
  landschap: { breedte: 932, hoogte: 430 },
} as const;

export type Toestel = (typeof TOESTEL)[keyof typeof TOESTEL];
