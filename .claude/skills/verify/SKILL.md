---
name: verify
description: Toetst of gebouwd werk zich werkelijk gedraagt zoals het acceptatie-contract zegt, door het uit te vóéren op het doelwit van de gebruiker — niet door de code te lezen. Kiest de meetbare as bij het taaktype (design-snapshot, invariant, flow-doorloop, request/response, before-after-reproductie), levert P0–P3 bevindingen met runtime-bewijs, en vinkt de acceptatie-items van de briefing af. Gebruik deze skill in de Beoordeel-stap van de triade, of wanneer de gebruiker zegt "verifieer dit", "klopt het gedrag", "werkt het echt", "check of dit doet wat de briefing zegt", "vink de acceptatie af". **Roep hem ook aan zodra je zélf gaat meten, ook zonder dat de gebruiker erom vraagt** — bij een positieve of negatieve controle, een tegenproef, de vraag of een check rood kan worden, een lege of verdachte uitkomst, een telling waarvan het meetbereik onzeker is, of vóór je een getal aan de gebruiker rapporteert. Dat is de meerderheid van de gevallen: de discipline komt op midden in het werk, niet uit de prompt. De twaalf rails hier dragen het gemeten bewijs waar `CLAUDE.md` alleen de kern van draagt. NIET voor diff-correctheid (`code-review`), design-kwaliteit (`ux-audit`) of backend-hardening (`security-audit`).
---

## Werkwijze

Deze skill beantwoordt één vraag: **gedraagt het gebouwde zich zoals het acceptatie-contract zegt, bewezen door uitvoering?**

Dat maakt hem het buitenbeentje van het Beoordeel-panel. `code-review` leest de diff, `security-audit` leest het backend-oppervlak, `ux-audit` beoordeelt kwaliteit — alle drie statisch. `verify` is de enige as die **runtime-bewijs** produceert. Een skill die alleen leest kan nooit aantonen dat iets wérkt; ze kan hoogstens aantonen dat het er goed uitziet.

Daaruit volgt de kernregel van deze skill: **een groene build is geen gedrag.** Exit 0 zegt dat er gecompileerd is, niet dat de gebruiker ziet wat hij hoort te zien. Elke bevinding steunt op waargenomen output — een waarde, een screenshot, een response, een berekend saldo — nooit op "de code doet dit".

---

## Scope-gate — verplichte eerste stap

`verify` heeft twee dingen nodig. Ontbreekt er één, dan is de uitkomst geen verificatie maar een indruk.

**1. Een acceptatie-contract (de oracle).** De machine-leesbare `- [ ]`-checklist uit PLAN: een TC-EBC bij design-werk, een licht taak-contract bij refactor/bugfix/infra. Ontbreekt die → **stop**. Zeg: *"Geen acceptatie-contract — verify heeft geen oracle. Vraag PLAN eerst om de checklist."* Zelf een checklist verzinnen en er dan tegen toetsen is een gesloten cirkel: je bewijst je eigen aanname.

**2. Een uitvoerbaar pad (de as).** Een manier om het gedrag echt op te wekken — zie de as-tabel hieronder. Begin bij de sectie `## Verify-pad` in de `CLAUDE.md` van de app: die hoort de commando's te bevatten. Ontbreekt die sectie, dan is dat je eerste bevinding. Ontbreekt het pad zelf → **niet doen alsof**. Meld expliciet *"as overgeslagen: {welke}, want {reden}"* en draai de Beoordeel-stap niet alsof hij geslaagd is. Een groene review die niets gemeten heeft geeft valse zekerheid en is slechter dan geen review.

**Valt binnen dezelfde app dezelfde as een tweede keer weg**, dan is het ontbrekende pad zélf het werk: leg het vast als `next-step` in de `HANDOFF.md` van die app, met wat het concreet moet meten. Een verify-pad is een deliverable, geen bijproduct — het ontstaat niet vanzelf uit bouwtaken, en vanaf de tweede melding is "overgeslagen" geen informatie meer maar een gewoonte.

---

## Kies de meetbare as

De as volgt uit het taaktype, niet uit wat toevallig makkelijk te draaien is.

| Taaktype | Meetbare as | Wat telt als bewijs |
|---|---|---|
| **Design-to-code** | de design-snapshot (`figma-naar-code` stap 4b) + parity- en token-checklist | een render van het gebouwde, gediff tegen de snapshot — niet tegen een vluchtige in-context mapping |
| **Business-logica met afhankelijke berekeningen** | de **invariant** over het hele model | de invariant uitgerekend over een echte dataset (`eindsaldo maand N == beginsaldo maand N+1`), niet een scherm dat het juiste getal toont |
| **Flow / interactie** | het pad daadwerkelijk afleggen | de flow doorlopen op het doeltoestel, inclusief toetsenbordpad waar dat geldt |
| **Prototype / klikbaar design** (Figma, klikdummy) | de klik in de échte prototype-player — het pad staat in `references/figma-prototype-verify-pad.md` | de `node-id` in de player-URL die naar de verwachte bestemming springt, mét de interpretatiepoort uit dat pad (stilte bewijzen met een bekend-werkende hotspot in dezelfde page-load). Lukt de player niet, dan is de terugval het **trefvlak** van de dragende node, geijkt aan een werkend exemplaar in hetzelfde bestand — nooit de reaction-properties, die zijn op een dode hotspot even groen |
| **Backend / API** | request → response → statewijziging | een echte call tegen een echte store; de rij die erna in de database staat |
| **Bugfix** | de reproductie | dezelfde input faalt vóór de fix en slaagt erna — beide kanten getoond |
| **States** (loading/empty/error) | de toestand forceren | de app in die toestand brengen (mock, throttle, lege dataset), niet de branch in de code aanwijzen |
| **Diagnose / meting** ("klopt waarde X?", "wordt Y nog juist berekend?") | de directe meting aan de bron | de grootheid zelf gemeten — een log, een opname, een teller, een testrun op synthetische invoer. Nooit een aggregaat, vuistregel of verwachtingswaarde als afsluiting: dat is de hypothese, niet het bewijs (CLAUDE.md, *"Een verwachtingswaarde is geen meting"*) |

Meerdere assen tegelijk is normaal: een feature-flow met een berekening heeft er twee. Draai ze allebei of meld welke je oversloeg.

---

## Twaalf rails — de discipline van de Beoordeel-stap

Deze staan als werkprincipe in `CLAUDE.md`; hier zijn ze operationeel.

**1. De Beoordeel-stap schrijft.** Bouwen, migreren en installeren zijn geen observaties — ze veranderen de schijf. Leest er een langlopend proces uit diezelfde plek (dev-server, PM2-app, gedeelde database), dan deployt je verificatie ongewild en valt de schade buiten je blikveld: jij ziet exit 0, de gebruiker ziet een witte pagina.

Vóór een build in een repo met draaiende processen: `pm2 status`, `lsof -nP -iTCP:<poort> -sTCP:LISTEN`. Serveert er iets uit die map → gebruik het script dat bouwen en herstarten koppelt (`pm2:rebuild`), of bouw naar een aparte map.

*Diagnose-truc:* staat de mtime van de buildmap ná de starttijd van het proces, dan serveert het uit een build die het zelf niet kent. Bewijs is één stap: haal de HTML op, trek de chunk-paden eruit, kijk of ze op schijf bestaan.

**2. Verifieer op het doelwit van de gebruiker.** Een groene check op een ander toestel, een andere build of een andere omgeving dan waar de gebruiker de fout ziet, bewijst niets over zijn geval. Draai de volledige cyclus — herstart of reload inbegrepen — op hetzelfde doelwit.

Kan dat niet, dan is een surrogaat toegestaan **mits je twee dingen meldt**: dat je op een surrogaat getest hebt, en wat dat níet uitsluit. Sluit het gat waar mogelijk met een aantoonbare gelijkheid ("de uitgerolde hook is byte-identiek aan de geteste template, en `core.hooksPath` staat gezet") — dat is geen aanname maar een diff.

**3. Geen verzonnen bewijs.** Kun je een item niet uitvoeren, markeer het `[NIET TE VERIFIËREN — reden]` en zeg hoe het wél zou kunnen. Een verificatie met valse zekerheid is schadelijker dan een eerlijke leemte, want ze sluit de vraag af.

**4. Toets een bewering over een bibliotheek aan de geïnstalleerde bron.** Die staat in `node_modules`. Hoe stelliger de bewering, hoe kleiner de kans dat ze nagekeken is — en een typecheck die slaagt zegt niets over een verkeerd begrepen contract.

*In meetgereedschap is de schade groter dan in een fix.* Een verkeerd contract in een fix faalt zichtbaar; in een instrument levert het een gevulde, geloofwaardige, verkeerde uitkomst. Gemeten op fleet-manager (2026-09-01): `page.addStyleTag({ id: 'geen-vink', content: … })` — Playwright kent alleen `content`, `path` en `url` (nagemeten in `types/types.d.ts` van de geïnstalleerde 1.62.1). De onbekende optie wordt stil genegeerd, dus de tag kreeg nooit een id, `getElementById` gaf `null`, en de injectie `span > svg { visibility: hidden }` bleef permanent op de pagina staan. Elke volgende meting las daarop "geen verschil", waarna het instrument twee bevindingen meldde die geen van beide bestonden — een select-all die 0 van 5 rijen aanvinkte, en een `/orders` zonder tabel — en die werden als codefout gediagnosticeerd vóór het instrument verdacht werd. Twee versterkers: in een `.mjs` keurt geen typecheck een onbekende property af, en de negatieve controle stond vóór de vervuiling en bleef groen. *Herkenningsteken:* een check die eerst groen was en na een tussenliggende meting rood wordt zónder dat de code veranderde, is een uitspraak over het instrument, niet over de code.

**5. Nooit een destructief pad tegen productiedata.** Rail 2 stuurt je naar het echte doelwit; deze rail begrenst dat. Verwijderen, wissen, overschrijven of een migratie draaien op data die de gebruiker echt gebruikt is geen verificatie — het is schade met een rapport eraan vast. Dat het goed afliep bewijst niets over de beslissing: die was al fout toen je hem nam, want de uitkomst was toen onbekend.

Bouw het bewijs om het pad heen. Drie vormen, in volgorde van voorkeur:

| Vorm | Hoe | Wat het bewijst |
|---|---|---|
| **Guard in plaats van effect** | roep het beschermde pad aan zónder rechten; tel de data ná afloop | dat de bescherming houdt — het sterkste bewijs dat er is, want je hebt het echte pad geraakt |
| **Synthetische invoer** | dezelfde transformatie op een verzonnen rij in een `select`, nooit een `update` | dat de logica klopt, zonder één echte rij aan te raken |
| **Testaccount met seed-data** | een tweede account waarvan het verlies niets kost | het volledige pad, end-to-end |

Kan geen van de drie, dan is het item `[NIET TE VERIFIËREN — destructief pad, geen testaccount]`. Dat is een leemte, geen vrijbrief. Wil je het tóch echt uitvoeren: vraag het vooraf, niet achteraf.

*Herkennen doe je aan de aanroep, niet aan de naam.* `revoke`, `delete`, `reset`, `drain`, `purge`, een `rpc(...)` waarvan je de body niet gelezen hebt, en elke `update`/`delete` zonder `where` op een eigen rij. Bij twijfel: lees eerst wat de functie doet, dan pas of je hem aanroept.

**6. Toets ook je instrument, niet enkel je doelwit.** Rail 2 gaat over wáár je meet; deze over waarmee. Bootst je invoermethode de interactie echt na — en geeft ze haar de tíjd die ze nodig heeft?

Een niet-getrouw instrument levert een vals-negatief dat er identiek uitziet als een echte bug — juist bij de skill die bewijs moet leveren. Bevestig een negatieve uitkomst daarom langs een tweede, onafhankelijk pad (toetsenbord naast muis, een andere driver) vóór je "werkt niet" rapporteert.

*Het gaat zelden om ontbrekende events, meestal om ontbrekende frames.* Gemeten op cashflow (2026-08-07): `left_click_drag` lévert pointer-events af — 1 pointerdown, 3 pointermove, 1 pointerup — en dnd-kit pakt het item ook echt op. De sensor weigert dus niets. Wat het gebaar mist is een frame waarin de bibliotheek haar droppables opmeet; daardoor blijft `over` leeg en gebeurt er bij het loslaten niets. Dezelfde bewegingen mét ~50 ms ertussen lossen de doelzone wél op. Een gebaar dat in één burst afloopt is geen snelle versie van een echt gebaar, het is een ánder gebaar.

*Je observatiepunt is óók een instrument.* Kijk naar wat de bibliotheek zelf vertelt — bij dnd-kit de `[aria-live]`-narratie ("Picked up…", "was moved over droppable area…") — niet naar een afgeleid symptoom. Een observer die op de DragOverlay lette meldde nul terwijl de sleep aantoonbaar was opgepakt: bij een burst commit React die overlay nooit. Twee instrumenten, twee tegengestelde antwoorden, en het zichtbaarste was het foute.

*En de omgeving van je instrument.* In een achtergrond-tabblad staat `document.visibilityState` op `hidden` en vuurt `requestAnimationFrame` niet meer: een wachtlus op frames hangt tot de tool-timeout, en animaties maken hun exit nooit af. Wat je dan meet is de tab-staat, niet de app. Gebruik timers in plaats van frames, of breng het doelwit naar de voorgrond.

*Een afwijzing heeft dezelfde vorm als een lege uitkomst.* "Niet gevonden", "geweigerd" en "instrument kapot" zien er identiek uit, dus een negatieve uitkomst vraagt evengoed een positieve controle: toon dat je opstelling de positieve uitkomst ooit kón produceren. Gemeten op 2026-08-29: `sftp -b` tegen de SFTP-drop van FOD Economie gaf `Permission denied (publickey,keyboard-interactive)` zonder ooit een wachtwoordprompt, en dat werd gerapporteerd als eigenschap van de server — met het advies een sleutelpaar via de helpdesk te laten installeren, dagen wachttijd voor een probleem dat niet bestond. `-b` zet `BatchMode=yes` door naar ssh en onderdrukt élke interactieve prompt; zonder `-b` logden exact dezelfde gegevens meteen in. De meting ging dus over het gereedschap, niet over de server. Het alarm lag er al: de foutmelding noemde `keyboard-interactive` zélf als toegestane methode, en dat is per definitie een methode die prompt — twee signalen die elkaar tegenspraken, als één gelezen. Nagemeten op 2026-09-03 met een host-key-prompt: mét `-b` `Host key verification failed` zonder prompt, zonder `-b` verschijnt `The authenticity of host … can't be established`. Let op de eerste opzet daarvan, die zélf rail 8 opleverde: met `</dev/null` gaven **béide** kanten dezelfde uitkomst, want zonder tty prompt ssh sowieso niet — pas op een pty (`script -q /dev/null`) bewoog de meting.

*Meerdere beoordelaars op één afgeleide bron zijn één meting.* Gemeten op Partner Fleet Portal (2026-08-27): een dump gefilterd op `node.visible` — de eigen vlag van de node, die niets zegt over een ouder die een component-variant heeft weggeklapt — droeg 22 `kWh`-tekstnodes waarvan er **nul** gerenderd worden. Alle drie de audit-assen meldden daarop onafhankelijk dezelfde P1 ("22 kWh-suffixen op velden die niets met energie te maken hebben"), en de scheidsrechter zette hem bovenaan als quick win met het hoogste rendement. Drie eensluidende beoordelaars zijn daar géén bevestiging: ze lazen alle drie dezelfde kapotte bron, dus hun overeenstemming meet de dump en niet het bestand. De hermeting met `absoluteRenderBounds` plus een ouder-keten-check en een positieve controle wierp de bevinding om vóór publicatie. De bron moet een tegenproef dragen vóórdat je er meerdere beoordelaars op zet.

*Een vervangen instrument valideer je eerst op wat níet veranderde.* Herschrijf of vervang je een meetinstrument — een dump-filter, een vergelijker, een parser — dan zegt zijn uitkomst over het gewijzigde deel pas iets als hij het óngewijzigde deel exact reproduceert. Gemeten op fleet-manager: een nieuw dump-filter gooide twee strings weg, en die lege uitkomst zag er identiek uit aan een schone dump; alleen 19 onveranderde schermen ernaast leggen (aantal teksten + tekenlengte) haalde het boven. Dat het instrument zélf kapot kan zijn hoort bij die toets: de vergelijker gaf twee verschillende hashes voor identieke invoer.

**7. De verwachting is de reden om te meten, nooit het bewijs.** Een vuistregel uit de literatuur, een typische waarde, een aggregaat dat logisch oogt — dat is de hypothese die de meting motiveert, niet de meting zelf. Bestaat de meetbare as (een log, een opname, een teller, het Verify-pad van de app), dan sluit alleen díe de vraag; kun je niet meten, dan lever je een hypothese mét het meetpad erbij, geen conclusie met een tabel eronder.

*Herkenningsteken:* wijkt het getal af met precies een ronde factor (×2, ×½, ×60), dan is dat vrijwel zeker een tel- of eenheidsfout — die ga je meten, niet verklaren, en de kant waarop hij valt beslis je nooit uit plausibiliteit. Gemeten op rowtrack (2026-08-16): "20-24 spm is je echte slagfrequentie" klonk sluitend met twee vuistregels als steun; een FTMS-opname en een handtelling dezelfde avond wezen het tegendeel uit, en de echte oorzaak (een noemer die rustpackets meetelde) produceerde exact het klachtgetal 24.

**8. Toets of je check rood kan worden.** Rail 6 gaat over de getrouwheid van je *instrument*, deze over de **grootheid** die je meet. Een assertie kan gevuld, waar en volledig groen zijn en tóch niets bewijzen, omdat ze de vorm van het artefact toetst in plaats van zijn gedrag — en dat voelt van binnenuit identiek aan verificatie.

Vóór je een check vertrouwt: benoem het defect dat hij moet vangen en toon dat hij daarop **afgaat** — op de toestand vóór de fix, op een kapot exemplaar elders in hetzelfde bestand, of op een geconstrueerd geval. Blijft hij groen mét het defect → proxy. Ligt zijn uitkomst per constructie vast → tautologie.

Koppel de tegenproef aan het defect zelf, niet aan een buurdefect — drie vormen: (a) **neem de fix weg** — draai de logica zelf terug en eis dat de suite omvalt, langs het pad dat productie draait, niet de functie los; (b) **vind het object eerst** — bewijs dat het ding dat je net aanraakte in het meetbereik van je check zit vóór je er een eigenschap van meet; (c) **laat het object bewegen** — zet naast elke "onveranderd"-assertie een geval waarin de uitkomst móet verschillen, want een verkeerd object dat nooit verandert bevestigt elke stabiliteitscheck. Gemeten 2026-08-24/25 (jobradar-fixtures, Soda+-`clone()`, verkeersanalyse-`querySelector`); de principe-tekst staat in CLAUDE.md onder *De tegenproef draagt het defect zelf*.

Gemeten op LQB (2026-08-18): "reaction bestaat · trigger `ON_CLICK` · actie `NAVIGATE` · bestemming geldig" stond 4 van 4 groen op een link waar klikken niets deed. Die vier asserties staan wóórd voor woord even groen op de kapotte als op de herstelde staat — de reaction hing op het `link`-FRAME (`604:43106`, `fills:0`, `strokes:0`) in plaats van op de TEXT-node eronder (`604:43108`, `fills:1`), waar hij na het herstel wél staat. Wat de twee onderscheidt, werd nooit geasserteerd. Het ijkpunt lag in het bestand zelf: op dezelfde pagina hebben 217 van de 219 eigen NAVIGATE-hotspots een trefvlak, en alle acht de structureel identieke tekstlinks dragen hun reaction op de TEXT-node. In dezelfde sessie faalde een overloop-check op de tweede manier: `CONTENT`-hoogte ís de som van de kinderen, dus "0px speling" stond voor alle 27 frames vast vóór de meting begon.

*De moeilijk meetbare as krijgt geen lagere lat.* Kun je het gedrag niet opwekken, dan is dat rail 3 (`[NIET TE VERIFIËREN — reden]`), niet een goedkopere check die er verifiërend uitziet. Signaal: één taak, twee oppervlakken, ongelijke latten — de code-kant getoetst door te klikken, het design-bestand door een property te lezen.

*Geven beide kanten dezelfde uitkomst, dan is de opstelling ongeschikt.* Gemeten op 2026-08-27 bij een guard tegen exit 123 (`xargs` na een `grep` zonder treffers, onder GitHub's `bash -e`): mét guard leefde het script, zónder guard ook. Ik rapporteerde de eerste kant als bevestiging dat de fix nodig was, terwijl de tweede net had aangetoond dat de opstelling het defect niet kón reproduceren — de meting zat in een `$( )`, en command substitution vangt de fout. Pas de CI-run was geldig: umanex-apps viel om, luminus en columba niet. Dezelfde dag nog een tweede vorm: bij de receiver-test miste een vervangingsstring één spatie, zodat het geplante defect nooit landde en de test ten onrechte groen bleef — bijna gerapporteerd als "hij vangt het niet".


**9. Anker op het object, niet op de vorm die je toevallig terugkrijgt.** Een laagnaam, een label, een kolomtitel, een tag — allemaal beschrijvingen die iemand ooit typte en die sindsdien niet meegroeiden. Identificeer waar je mee werkt aan zijn **inhoud**: de titel op de kaart, de velden in het formulier, de rij in de tabel.

Gemeten op LQB: één frame droeg de naam `unit:04-contact` en zijn kind `screen:d1-account-manager-handoff`, terwijl de kaart erin "Add your company details" heet met de velden `Company name` en `Street` — alleen de inhoud zei wat het scherm ís. Op fleet-manager las `strokeBottomWeight: 2` zonder één stroke-paint als "er staat een onderlijn" terwijl er niets getekend werd, en een tekstnode met `visible: true` onder een ouder op `opacity: 0` als "hij rendert": een render-*eigenschap* is invoer voor de render, niet de render.

*De broer met dezelfde vorm.* `querySelector('aside')` faalt niet bij twee `<aside>`'s — hij geeft de eerste. Gemeten op Columba: `Sidebar.tsx` en `SidePanel.tsx` zijn allebei een `<aside>`, dus "paneelbreedte 304px" was de sidebar, óók vóór er een paneel bestond; de toggle 372 ↔ 880 las daardoor als "verandert niet". Tel eerst: `querySelectorAll(<selector>).length` hoort **1** te zijn vóór je er een eigenschap van afleest. En de rail moet ín het instrument zitten, niet alleen in het hoofd van wie het schreef. Gemeten op fleet-manager (2026-09-07): `figma-snapshot.md` droeg `findOne` op exacte framenaam terwijl deze rail al in `CLAUDE.md` stond — de eerste treffer was een playground-kopie (FM/06 ×3, FM/07 ×2, FM/01 ×2 naamgenoten), de letterlijke `SHELL`-lijst filterde na een nav-herbouw niets meer (10 van 21 entries dood), en 350 rode verschillen (289 shell) vielen op geen enkele stap. Sindsdien telt `figma-snapshot.js` zelf — pagina, scherm-nodes, versie-varianten — weigert bij ≠ 1, en meet de shell op twee onafhankelijke signalen; `figma-snapshot.test.mjs` draait die letterlijke bron tegen een boom die het defect draagt.

*De grep-treffer.* Een `grep -n` geeft je één regel, niet de entry — en de `Status` staat daarbuiten. Gemeten over `HANDOFF.md`, `BACKLOG.md` en `LEARNINGS.md` (79 entries): de statusregel staat gemiddeld +4,4 tot +4,9 onder zijn kop en in de staart tot +11, dus een kale grep toont hem bij géén enkele entry. Een groter venster is geen fix maar een nieuwe proxy — anker op de entry.

*Een lus over een variabele draait in zsh één keer.* De tool-shell is zsh en splitst een ongequote variabele niet: `for f in $VAR` itereert over één lange string. Gemeten op 2026-08-27: `F="$(find apps -name '*.tsx')"; for f in $F` gaf **1** iteratie waar `printf '%s\n' "$F" | while read -r f` er 3 gaf op een lijst van 3. Drie keer op één dag leverde dat een stil lege of onvolledige uitkomst die als geldig resultaat las — bij de resterende hex-treffers in Luminus (leeg, terwijl `xargs` er 3 gaf), bij columba's verdeling (leeg, terwijl het bestand er 206 draagt), en bij een merge-lus waar `set -- $spec` niet splitste. Die derde viel wél op, want een falende `cd` is luid; de klasse is dat de eerste twee dat niet zijn. Committed scripts met `#!/bin/bash` zijn correct — dit is een inline-val.

**10. Het meetbereik bevat vaak de meting zelf.** Bij een telling of een exit-status heeft "de verkeerde grootheid" een eigen, herkenbare vorm. Een `grep -c` op een bestand dat zijn eigen format-voorbeeld draagt telt dat voorbeeld mee; een CI-log bevat het script dat hij logt, dus een grep op een `echo`-tekst vindt de broncode terug; `$?` na een pipe geeft de status van de láátste pijpcomponent en niet die van je script.

Gemeten op één sessie: vier keer, en drie keer met een getal dat plausibel oogde — "3 open entries" klopte precies met de drie die net bijgewerkt waren, terwijl het echte antwoord 0 was. Dezelfde vorm bij een **scope**: `git status --porcelain` rapporteert een nieuwe map als één regel, dus een `.tsx$`-filter erover gooit élk bestand erin weg — 18 bestanden waar er 23 waren, en het enige foute token zat in de vijf die wegvielen.

**11. Je zekerheid moet dekken wat je werkelijk deed.** Een melding draagt impliciet dat er een tool-call onder zit. Twee vormen waarin dat misging, allebei op 2026-08-26. Een **verklaring die je niet toetste**: na drie gefaalde `figma_execute`-calls noemde ik het `·`-teken als oorzaak en meldde dat als vaststaand; de controle-test gaf vijf keer groen, en de echte oorzaak was dat Figma tekstnodes naar hun inhoud vernoemt. Een **handeling die je niet uitvoerde**: "Ik heb hem toegevoegd aan de LEARNINGS-entry" zonder één call die dat deed. Een derde vorm, gemeten op 2026-09-07: een **identifier die je voorspelde in plaats van terugleest**. `PR #370` stond in een BACKLOG-entry vóór `gh pr create` gesproken had; het werd umanex-apps#372. Bij het harden bleek de naamruimte het grotere gat — van de verwijzingen in umanex-os bestonden er **19 van 19** óók in umanex-apps, en elf wezen naar een PR die in umanex-os niet kán bestaan. Een lezer in Columba lost datzelfde nummer dus op naar een derde PR, zonder één foutmelding. Schrijf `umanex-apps#372`, niet `#372`. De vorm bewaakt `.githooks/pre-commit`, het bestáán `scripts/refs-check.mjs`; wat géén van beide vangt is een nummer dat bestáát maar het verkeerde is — daar helpt alleen de volgorde: eerst de call, dan het nummer opschrijven. Twee valstrikken uit die bouw horen erbij, want ze zijn de rail zelf toegepast op het instrument: GitHub antwoordt op een privé-repo waar je token niet bij mag met **404**, niet met 403, dus "bestaat niet" en "mag ik niet zien" zijn hetzelfde antwoord — laat het instrument de repo eerst terugvinden. En de eerste grep-keten stond in BRE, waar `\+` een herhalingsoperator zonder operand is: de hook zweeg altijd.

Herkenningsteken voor beide: een bewering die in dezelfde adem ontstaat én wordt afgevinkt, zonder call ertussen. In een `AskUserQuestion`-optie schaadt het het meest, want daar wordt een ongemeten getal de grond waarop de gebruiker beslist: geschat −3 500 chars, gemeten −428, een factor 8. Kantelt een aanname onder een optie nádat de gebruiker koos, dan volstaat de opbrengst corrigeren niet — bied de keuze opnieuw aan.

*Een betwiste bewering over een artefact dat je nooit opende.* Arbitreren tussen twee tweedehandse lezingen is geen verificatie maar een muntworp met argumentatie eromheen. Gemeten op Soda+ (2026-09-02): een zin uit de audit van een eerdere sessie ("het oplossingskader is bij DW1, DW2 én DW3 leeg") droeg een cover, een caption en de opening van een videoscript. Op één zin pushback van de gebruiker werden alle drie in de **tegenovergestelde** richting herschreven, plus een correctie-marker in de audit en een LEARNINGS-entry — precies de plekken waar latere sessies hun feiten halen, dus een ongeverifieerde correctie daar vermenigvuldigt de fout in plaats van hem te stoppen. In die ronde stond letterlijk de zin "het document zit niet in de repo, ik heb het nooit gezien", behandeld als caveat in plaats van als stopteken; het bestand lag in `~/Downloads` en één `Read` besliste de vraag. Twee dingen maakten het erger dan een leesfout: er hing niets van de premisse af (de drie oorzaken in het ontwerp gaan over de vórm van het formulier), dus geen enkele check werd rood — en het rapport droeg zijn eigen controlegeval, onvindbaar in elke discussie die het niet opent: DW1–DW3 zijn aan de schóólkant ingevuld terwijl het leerlingvak leeg is, en DW4 moet nog volgen en staat aan béide kanten leeg. Nagespeeld op 2026-09-03 met dezelfde structuur — bron vindbaar met één `find`, niet aangereikt — en de fout **reproduceerde volledig**: drie artefacten geblokkeerd en de bron-audit "gecorrigeerd", zonder één call die de bron opende. *Herkenningsteken:* "ik heb het nooit gezien" hoort een vráág te worden, geen voetnoot.

**12. Bij afhankelijke berekeningen is de invariant de meetbare as.** Volgt een waarde uit een andere, dan valideert scherm-per-scherm niets: elke fix is lokaal correct terwijl dezelfde afgeleide waarde elders anders berekend blijft, en je kan alle schermen afvinken zonder één keer de fout te raken.

PLAN levert daarom minstens één **invariant** over het hele model, en BEOORDEEL rékent die uit over een echte dataset — `eindsaldo maand N == beginsaldo maand N+1` over de volledige reeks — in plaats van een scherm af te lezen dat het juiste getal toont. Deze rail staat als enige niet als eigen regel in het discipline-blok van `CLAUDE.md`: zijn kern hangt daar aan de PLAN-zin, omdat hij bijt vóór er iets te verifiëren valt.

---

## Rail-mapping — welke `CLAUDE.md`-kern hoort bij welke rail hier

`CLAUDE.md` draagt de kern-bewering, deze skill het gemeten geval. De koppen lopen niet
één-op-één: vier van de elf matchen letterlijk, de rest zegt hetzelfde onder een andere
kop. Die vertaling staat hieronder, en niet in een script — `scripts/test-discipline-blok.sh --fix`
leest deze tabel, zodat er één bron is die ook leesbaar is voor wie de skill opent. Een
verouderde regel valt hier op; een verouderde `case` in een script niet.

| `CLAUDE.md`-rail (fragment) | rail hier |
|---|---|
| Beoordeel-stap schrijft | 1 |
| doelwit van de gebruiker | 2 |
| destructief pad | 5 |
| instrument dat draait | 6 |
| lus over een variabele | 9 |
| tegenproef draagt het defect | 8 |
| naam is een bewering | 9 |
| grep-treffer | 9 |
| meetbereik bevat | 10 |
| verwachtingswaarde | 7 |
| zekerheid moet dekken | 11 |

Het fragment is een substring van de rail-kop in `CLAUDE.md`; een streepje betekent dat deze
skill er nog geen rail voor heeft en er dus een bij moet vóór het bewijs hierheen kan.

---

## Het verify-pad — een contract per app

Deze skill kan niet elke run het terrein opnieuw ontdekken: welke simulator, welke build, draait de dev-server, waar leeft dat scherm. Dat is verspilde tijd én een bron van valse conclusies — een build van een maand oud ziet er in een screenshot precies zo uit als een verse.

Elke app die `verify` gebruikt hoort daarom een sectie **`## Verify-pad`** in zijn eigen `CLAUDE.md` te hebben, met de letterlijke commando's per capability:

| Capability | Wat het moet kunnen |
|---|---|
| **Render vastleggen** | een screenshot van de draaiende app, met het commando erbij |
| **Flow aandrijven** | tappen, typen, navigeren — of expliciet "geen" |
| **State forceren** | loading/empty/error opwekken, plus het testaccount en hoe je het reset |
| **Invariant draaien** | de headless host voor pure logica, met het commando |
| **Verse build** | hoe je zeker weet dat je de huidige code test, niet een oude binary |

**"Geen" is een geldige waarde en hoort er expliciet te staan.** Een lege regel laat de vraag elke run terugkomen; het woord "geen" maakt het gat zichtbaar en telbaar. Ontbreekt de sectie helemaal, dan is dát de eerste bevinding van de run — vóór welk acceptatie-item ook.

**Figma-prototypes hebben hun eigen contract**, want ze horen bij geen enkele app-repo: `references/figma-prototype-verify-pad.md` bevat de capabilities, de twee schaalslagen van het klikpunt en de gereedheidspoort. De per-bestand specifics (fileKey, startframes, de bekend-werkende ijk-hotspot) horen in de `CLAUDE.md` van de klant-repo waar dat prototype leeft.

De sectie beschrijft het pad, ze bouwt het niet. Welk gereedschap de flow aandrijft verschilt fundamenteel per platform (browser-automatisering voor web, een UI-driver voor native) en is dus een keuze op app-niveau, niet hier.

---

## Stappenplan

1. **Scope-gate** — contract aanwezig? uitvoerbaar pad aanwezig? Zo niet: meld en stop (of meld "overgeslagen" en ga eerlijk verder met wat wél kan).
2. **As kiezen** — bepaal uit het taaktype welke as(sen) gelden; benoem ze expliciet vóór je draait.
3. **Doelwit vaststellen** — waar ziet de gebruiker dit? Check op draaiende processen vóór je iets bouwt (rail 1).
4. **Uitvoeren** — wek het gedrag op. Leg de waargenomen output vast: waarde, screenshot, response, saldo. Niet de exit code.
5. **Per acceptatie-item oordelen** — `gehaald` / `gefaald` / `niet te verifiëren`, elk met zijn bewijs.
6. **Consolideren** — bundel de gefaalde items tot één P0–P3-lijst.
7. **Briefing bijwerken** — vink de gehaalde items af (`- [x]`) in het TC-EBC- of contract-bestand. Dit is de enige rol in het systeem die dat mag doen: een afgevinkt item betekent *geverifieerd*, niet *gebouwd*.
8. **Rapporteren** — inline, met bestandspad naar de briefing.

---

## Prioritering

| Niveau | Betekenis |
|--------|-----------|
| P0 | Het gedrag klopt niet op het hoofdpad — de gebruiker krijgt een fout resultaat, een lege pagina of een verkeerd bedrag. Blokkeert `gevalideerd` |
| P1 | Een acceptatie-item faalt, of een state (loading/empty/error) valt in een blanco scherm. Blokkeert `gevalideerd` |
| P2 | Randgeval of afwijking zonder gebruikersimpact op het hoofdpad — parity-verschil binnen tolerantie, trage maar correcte respons |
| P3 | Observatie voor later; geen contract-schending |

Een item dat je niet kón verifiëren is **geen** P-bevinding — het is een leemte, en die hoort in de "niet te verifiëren"-lijst. Ze stilzwijgend als gehaald tellen is de faalvorm die deze hele skill moet voorkomen.

---

## Output

Standaard **inline**, geen bestand: `verify` draait meerdere keren per bouwlus, en een rapport per iteratie is ruis. Wat wél persistent wordt: de afgevinkte acceptatie-items in de briefing (stap 7).

Toon:

1. **As + doelwit** — welke as(sen) gedraaid, op welk doelwit, en of dat het doelwit van de gebruiker was.
2. **Acceptatie-tabel** — item · oordeel · bewijs.
3. **Bevindingen** — P0→P3, elk met de waargenomen output.
4. **Niet te verifiëren** — met de reden en hoe het wél zou kunnen.
5. **Overgeslagen assen** — expliciet, met de reden. Bij de tweede keer in dezelfde app: het HANDOFF-item dat je aanmaakte.
6. **Rails-verantwoording** — één regel per rail (1–12): *nageleefd* (hoe) of *n.v.t.* (waarom). Een verify-output zonder dit blok is onaf; het blok is niet in te vullen zonder de rails te herlezen — de bescherming tegen handelen uit sessiegeheugen.

Vraagt de gebruiker om een blijvend rapport, of is dit de afsluitende verificatie van een grote briefing → schrijf ook naar `/audits/{YYYY-MM-DD}-verify-{naam}.md`.

---

## Verhouding tot de triade

`verify` is de gedrags-as van de **Beoordeel**-stap. Een openstaande **P0 of P1** blokkeert de status `gevalideerd`, net als in `code-review` en (bij backend-werk) `security-audit`. De main-agent is scheidsrechter en consolideert alle panels tot één fix-lijst.

Twee dingen die deze skill **niet** doet: hij fixt niet (dat is BOUW), en hij oordeelt niet over kwaliteit of smaak (dat is `ux-audit`). Hij stelt vast of het contract gehaald is.

Legt een gefaalde verificatie een **terugkerende faalklasse** bloot — niet deze bug, maar de soort — dan is dat een `vastleggen`-trigger. Log alleen echte skill-/principe-fouten, geen losse code-bevindingen.

---

## Bewust niet in deze skill

- **Diff-correctheid** — dat is `code-review`. Overlap is verspilling: die leest, deze draait.
- **Zelf de acceptatie-checklist schrijven** — dat is PLAN (`tc-ebc` of het taak-contract). Een oracle die je zelf verzint bewijst niets.
- **Fixen wat je vindt** — rapporteren en teruggeven aan BOUW; anders vervaagt de grens tussen bouwer en toetser binnen dezelfde iteratie.
- **Een rapport per run wegschrijven** — inline is de norm; de briefing draagt de persistente staat.
