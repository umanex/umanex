# soda-plus — projectcontext

Designopdracht voor de sollicitatie bij **soda+**. Next.js (App Router), dev op poort 3004.

Dit bestand is bewust **minimaal**: het bevat alleen wat vaststaat. Vul aan naarmate de
opdracht duidelijk wordt — verzonnen projectcontext is schadelijker dan geen.

## Wat vaststaat

- **De bron is `Voorbeeld SODA-rapport.pdf` — één pagina, KTA Brugge, klas OKANOR.** DW1–DW3 dragen
  scores (S=B · O=B · D=A · A=A/B/B) én klassenraadfeedback; DW4 is de periode die nog moet volgen en
  is aan beide kanten leeg. Het vak "Oplossing voor de B-scores volgens de leerling" is overal leeg.
  **Lees dat niet als een structurele fout** — het is een voorbeelddocument, en Jeroen heeft dat op
  2026-09-02 tweemaal bevestigd; board en script trekken er geen conclusie uit. Wat wél in het
  document staat en het argument draagt: drie periodes dezelfde twee B's, attitude van A naar B, en
  drie feedbackblokken die bijna hetzelfde zeggen zonder ooit naar het vorige te verwijzen. Het
  argument wordt sterker, niet zwakker, als dat vak wél was ingevuld. De demo-data komt hiervandaan
  (scherm 00 = DW1 en DW2; de citaten op 05 en 10 staan in DW2 en DW3). De achterkant, waar het
  sterretje naar verwijst, hebben we niet. Zie `LEARNINGS.md` in umanex-os, entry 2026-09-02 — over
  dit document is twee keer geschreven zonder het te openen.
- De app heet `soda-plus` op schijf en in git (`feat(soda-plus): ...`); `soda+` is de merknaam.
- Werk in de hoofdtree, `apps/soda-plus`, op een feature branch vanaf `origin/main`; de vroegere eigen zusmap-worktree is op 2026-08-25 geschrapt (`.umanex-os/CLAUDE.md` → Git workflow → Parallel werk).
- Stack conform monorepo-default: Next.js 14 + Tailwind 3, rollaag via `@umanex/config/tailwind/preset`,
  `@umanex/ui` en `@umanex/tokens` als workspace-deps. Geen DB, geen auth, geen mail.

## Wat nog open staat

- De opdracht zelf — inhoud van de brief van soda+. Zonder die brief geen TC-EBC en dus geen schermwerk.
- Merk-context: type-stack, kleur, tone of voice. `app/layout.tsx` draait nu op de
  fallback-fontstack; het next/font-blok komt er zodra de huisstijl vaststaat.
- Deliverable-vorm: is dit een klikbaar prototype, een casepresentatie, of allebei?

## Design-systeem-bron

Welke laag deze app zijn vorm van krijgt. Gemeten, niet afgeleid: `scripts/design-system-guard.mjs`
toetst elke regel hieronder tegen wat er op schijf staat. "geen" is overal een geldig antwoord,
mits het er staat.

- **Preset:** `@umanex/config/tailwind/preset`
- **Componentbron:** `@umanex/ui`
- **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)

---

## Verify-pad

**Code:** geen. `pnpm --filter soda-plus type-check` en `build` draaien; er is nog geen flow-harness
(`scripts/flow-harness.mjs`) zoals bij portfolio en jobradar. Dat is een gat, geen vergetelheid —
bouw hem wanneer er schermen in code staan. Vandaag leeft de deliverable in Figma, niet in `app/`.

**Board (Figma `XwEUhY92XX32sQkEIdbEFN`, pagina "Wireframes"):** de meetbare as loopt via de
Desktop Bridge, nooit via REST — een REST-render is na een edit per definitie stale.

| Capability | Commando |
|---|---|
| Bridge leeft | `figma_get_status` met `probe: true` (verwacht `probeResult.success`) |
| Render vastleggen | `figma_capture_screenshot` met `nodeId` — runtime-klasse, dus vers |
| Contrast | `figma_execute`: tel zichtbare TEXT-nodes per fill-hex. `#9e9e9e` = 2,68:1 op wit en mag niet voorkomen; `#6b6b6b` = 5,33:1 op wit en 4,85:1 op `#f4f4f4` |
| Tekstgrootte | `figma_execute`: tel `fontSize < 12`. Let op `textAutoResize === 'NONE'` — zo'n vaste box knipt stil af zónder uitloop te tonen |
| Uitloop | tekstbreedte tegen **`parent.width - paddingLeft - paddingRight`**, niet tegen de framebreedte. Twee afknottingen op 2026-09-02 stonden groen omdat ik tegen 375 px mat in plaats van tegen de cel (96) en de kaart (305) |
| Overlap | frames paginabreed paarsgewijs, én tekstnodes onderling binnen 40 px op y |
| Prototype | `figma.currentPage.findAll(n => n.reactions.length)` + `flowStartingPoints`; NAVIGATE naar het eigen frame wordt geweigerd |
| Sectie-integriteit | elk frame binnen zijn sectie, secties onderling niet overlappend op y |

De acceptatielijst van de lopende briefing is de bron; vink af met de meting in de regel.
