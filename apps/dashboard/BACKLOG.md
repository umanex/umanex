# BACKLOG.md — gemeld, niet gebouwd

Dit bestand vangt het werk dat **buiten scope** viel: wat er benoemd is maar niet gedaan, plus de bevindingen uit `ux-audit` en `security-audit` die niet meteen gebouwd worden (P3 altijd; P0–P2 wanneer de audit buiten de triade draait). Zonder deze lijst is "buiten scope gelaten" alleen een zin in een antwoord dat wegscrollt — de melding bestaat dan wel, het werk niet, en niemand kan er later op terugkomen.

Entries komen erbij **op het moment van de melding**, niet aan het einde van de sessie. Een sessie die zonder reflectie afloopt mag geen scope-drop verliezen; dat is precies de vorm waarin ze vandaag verdwijnen.

## Waarom dit geen HANDOFF is

Een handoff-item is **sessie-gebonden**: het zorgt dat de volgende sessie niet koud begint en verdwijnt zodra het opgepakt is. Een backlog-item is **werk** — het blijft bestaan tot het gebouwd of bewust verworpen is, ook als er tien sessies overheen gaan. Ze in één bestand gooien maakt het sessiestart-signaal onbruikbaar: de handoff-lijst hoort kort te zijn, een backlog mag lang worden.

| Soort bevinding | Huis |
|---|---|
| Werk dat benoemd is maar niet gebouwd (scope-drop) | **hier** |
| P3 uit `ux-audit` of `security-audit`, en P0–P2 buiten de triade | **hier** |
| Waargenomen fout van een skill of werkprincipe | `LEARNINGS.md` (via `vastleggen`) |
| Onzekerheid, aanname, risico, next-step van déze sessie | `HANDOFF.md` (via `sessie-reflectie`) |
| Durend feit over Jeroen of het project | auto-memory |

## Statussen

- `open` — vastgelegd, nog geen beslissing over genomen. Telt mee bij sessiestart.
- `gepland` — dit gebeurt; het wacht op een plek in de planning.
- `gebouwd` — gedaan. Blijft staan als spoor, met commit of PR erbij.
- `verworpen` — bewust niet doen. **Reden verplicht**, anders komt hetzelfde voorstel over drie maanden terug en begint de afweging van nul.

## Types

`feature` · `refactor` · `fix` · `test` · `infra` · `ux` · `security` · `docs`

## Format

Elke entry staat onder een laag-header (`# Globaal`, `# Klant — {naam}`, `# Project — {app}`) en heeft deze vorm:

    ## YYYY-MM-DD — {korte titel} · [{type}]
    - **Wat:** {1-2 zinnen — wat er gebouwd zou worden}
    - **Waarom niet nu:** {waarom het buiten scope viel}
    - **Eerste zet:** {concreet startpunt of "-"}
    - **Status:** open

<!-- De eerste entry maakt hieronder de juiste laag-header aan. -->

# Project — dashboard

## 2026-09-09 — `dev` en de PM2-build delen één `.next` · [infra]
- **Wat:** Het dashboard draait sinds vandaag permanent onder PM2 (`next start`, :3010) uit dezelfde map waarin `pnpm --filter dashboard dev` zijn dev-build schrijft. Beide gebruiken `.next`, dus wie het dashboard zélf ontwikkelt sloopt de draaiende server: `next start` faalt daarna op *Could not find a production build* (gemeten 2026-09-09 — PM2 op `errored`, `BUILD_ID` weg). De uitweg is dezelfde als bij cashflow's flow-harness: een eigen dist-map voor dev via `distDir: process.env.NEXT_DIST_DIR ?? '.next'` in `next.config.mjs`, met `NEXT_DIST_DIR=.next-dev` in het `dev`-script.
- **Waarom niet nu:** De vraag was autostart, niet de dev-ervaring, en `next.config.mjs` staat op de lijst "eerst bevestigen". De botsing is voorlopig afgedekt met een regel in `CLAUDE.md` (stop PM2, ontwikkel, `pm2:rebuild`) — dat is een afspraak, geen guard.
- **Eerste zet:** `distDir` in `next.config.mjs`, `NEXT_DIST_DIR=.next-dev` in het `dev`-script, `.next-dev` in `.gitignore`. **Acceptatietest:** met PM2 online `pnpm --filter dashboard dev` draaien op een vrije poort, dev afsluiten, dan `curl http://127.0.0.1:3010/` → 200 zonder rebuild (vandaag: PM2 `errored`).
- **Status:** open

