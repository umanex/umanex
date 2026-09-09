// ---------------------------------------------------------------------------
// Wikkel om figma/builder.js, met voortgang en uitkomst in pluginData op de root.
//
// WAAROM NIET GEWOON DE RETURNWAARDE. `figma_execute` heeft een WACHTlimiet van 30 s, geen
// uitvoerlimiet: de plugin bouwt door nadat de tool-call is afgekapt, maar de returnwaarde is
// dan weg. Twee dingen die dat verergeren, allebei gemeten op 2026-09-08:
//
//  · Zonder marker weet je niet DAT hij nog bezig is, en start een tweede aanroep een tweede
//    builder in dezelfde pagina's. Twee overlappende runs lieten `Chip` en `PrBadge` leeg
//    achter en gaven `KpiSingle` twee componenten.
//  · Een POST naar de lokale server ná de wachtlimiet komt niet meer aan. De serverlog toont
//    de GET's van spec en builder, en daarna niets — terwijl het document wél gebouwd was.
//    `fetch` sterft met de tool-call mee; `setPluginData` niet.
//
// Contract: vuur deze wikkel af, en lees daarna in een korte call
// `figma.root.getPluginData('bouwresultaat')`. Zolang `bouwbezig` niet leeg is, loopt er nog
// een batch — dan NIET een volgende starten.
// ---------------------------------------------------------------------------
if (figma.fileKey !== 'QkRgMc7Quqtbow71DiYa1n') return { fout: 'verkeerde file: ' + figma.fileKey };
if (figma.root.getPluginData('bouwbezig'))
  return { fout: 'er loopt nog een batch: ' + figma.root.getPluginData('bouwbezig') };

const POORT = 9229;
figma.root.setPluginData('bouwbezig', BATCH.join(','));
figma.root.setPluginData('bouwresultaat', '');

let uitkomst;
try {
  const min = await (await fetch(`http://localhost:${POORT}/build-spec.min.json`)).json();
  const alle = { ...min.componenten, ...min.schermen };
  const ontbreekt = BATCH.filter(n => !alle[n]);
  if (ontbreekt.length) throw new Error('onbekende component(en): ' + ontbreekt.join(', '));

  const SPEC = Object.fromEntries(BATCH.map(n => [n, alle[n]]));
  SPEC.__stamp = STAMP;
  // __force is de ENIGE uitweg langs de publicatiepoort, en hij logt zichzelf per pagina
  // ("GEFORCEERD OVERSCHREVEN"). Zet hem alleen wanneer je gemeten hebt wat een herbouw kost —
  // 2026-09-08: 793 instances in RowTrack - Design, waarvan 0 uit de library, dus nul ontkoppeling.
  SPEC.__force = typeof FORCE !== 'undefined' && FORCE === true;
  const bron = await (await fetch(`http://localhost:${POORT}/builder.js`)).text();
  const F = Object.getPrototypeOf(async function () {}).constructor;
  const r = await (new F('SPEC', 'figma', bron))(SPEC, figma);
  uitkomst = {
    batch: BATCH, fout: null,
    geweigerd: r.geweigerd, aantalMeldingen: r.aantalMeldingen, meldingen: (r.meldingen ?? []).slice(0, 8),
    // De sizing-telling hoort in de uitkomst: `rekTeruggedraaid` is de enige plek waar
    // zichtbaar wordt dat een FILL de gemeten maat NIET reproduceerde. Zonder dit getal is
    // 'auto-layout aan' een bewering in plaats van een meting.
    rek: { gezet: r.rekGezet, teruggedraaid: r.rekTeruggedraaid, geweigerd: r.rekGeweigerd },
    // Hoeveel component-/variant-nodes hun key hielden. 0 = elke instance is ontkoppeld en
    // de library moet opnieuw gepubliceerd worden; dat was tot 2026-09-09 elke ronde zo.
    hergebruikt: r.hergebruikt,
    gebouwd: (r.gebouwd ?? []).map(g => ({ component: g.component, type: g.type, nodes: g.nodes,
      slots: g.slots ? Object.keys(g.slots) : null, publishStatus: g.publishStatus })),
  };
} catch (e) {
  uitkomst = { batch: BATCH, fout: e.message, gebouwd: [] };
}
figma.root.setPluginData('bouwresultaat', JSON.stringify(uitkomst));
figma.root.setPluginData('bouwbezig', '');
return uitkomst;
