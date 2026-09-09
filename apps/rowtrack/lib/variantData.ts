/**
 * De variant-as-waarden van een component als `data-variant`, zodat de Figma-builder de
 * juiste variant KIEST in plaats van hem af te leiden.
 *
 * WAAROM. Bij het exporteren van een scherm plaatst de builder op elke gedeclareerde
 * componentgrens een library-instance. Voor een component met variant-assen moet hij weten
 * wélke variant. Gemeten 2026-09-09: uit de bouwspec is dat niet af te leiden — een diepe
 * vingerafdruk (maat, kleur, tekst) matchte 1 van de 88 grenzen, want een component ín een
 * scherm toont andere data dan in zijn eigen story. En een afdruk op de buitenmaat alleen is
 * juist te grof: 11 van de 21 componenten hebben varianten die identiek meten.
 *
 * Het component kent zijn eigen props wél. Dit is dezelfde beweging als `testID` en
 * `data-bron`: de code zegt wat ze weet, in plaats van de pijplijn te laten raden.
 *
 * VORM: `as=waarde;as=waarde`, volgorde-onafhankelijk. De builder ontleedt de Figma-
 * variantnaam (`fill=true, divider=false`) op dezelfde manier en eist dat élk paar daaruit
 * hier voorkomt; extra assen (een `visible`-mount-schakelaar die Figma niet heeft) worden
 * genegeerd.
 */
export const variantData = (assen: Record<string, string | number | boolean>) =>
  ({ variant: Object.entries(assen).map(([as, w]) => `${as}=${w}`).join(';') });
