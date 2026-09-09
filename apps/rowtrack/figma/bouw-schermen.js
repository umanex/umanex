// ---------------------------------------------------------------------------
// Bouwt de SCHERMEN in RowTrack - Design, op de pagina Screens v2.
//
// Anders dan `bouw-batch.js` op twee punten:
//  · doelbestand — dit draait in T1bGrvIzSNeLyh5CbarATZ, niet in de library;
//  · instances — elke gedeclareerde componentgrens wordt een library-instance in plaats van
//    een nagebouwde subboom. Dat vraagt GEPUBLICEERDE componenten: een ongepubliceerde key
//    gaf op 2026-09-09 "Could not find a published component with the key".
//
// Zelfde handshake als de batch: `figma_execute` heeft een WACHTlimiet van 30 s en geen
// uitvoerlimiet, dus het resultaat gaat naar pluginData en niet naar de returnwaarde.
// ---------------------------------------------------------------------------
if (figma.fileKey !== 'T1bGrvIzSNeLyh5CbarATZ') return { fout: 'verkeerde file: ' + figma.fileKey };
if (figma.root.getPluginData('bouwbezig'))
  return { fout: 'er loopt nog een batch: ' + figma.root.getPluginData('bouwbezig') };

const POORT = 9229;
figma.root.setPluginData('bouwbezig', SCHERMEN.join(','));
figma.root.setPluginData('bouwresultaat', '');

let uitkomst;
try {
  const min = await (await fetch(`http://localhost:${POORT}/build-spec.min.json`)).json();
  const keys = await (await fetch(`http://localhost:${POORT}/library-component-keys.json`)).json();
  const ontbreekt = SCHERMEN.filter(n => !min.schermen[n]);
  if (ontbreekt.length) throw new Error('onbekend scherm: ' + ontbreekt.join(', '));
  // FRAMES filtert tot één frame per aanroep. Zie de opmerking bij `doelX` in builder.js:
  // een netwerk-import overleeft de wachtlimiet niet, dus elke bouw moet erbinnen passen.
  const kies = (d) => (typeof FRAMES === 'undefined' || !FRAMES.length)
    ? d : { ...d, frames: d.frames.filter(f => FRAMES.includes(f.naam)) };

  const instanties = {};
  for (const [naam, c] of Object.entries(keys.componenten)) {
    if (c.status === 'UNPUBLISHED') continue;   // niet importeerbaar; de builder meldt het
    instanties[naam] = { key: c.key, varianten: c.varianten, slots: c.slots };
  }

  const SPEC = Object.fromEntries(SCHERMEN.map(n => [n, kies(min.schermen[n])]));
  SPEC.__stamp = STAMP;
  SPEC.__doelPagina = 'Screens v2';
  SPEC.__instanties = instanties;

  const bron = await (await fetch(`http://localhost:${POORT}/builder.js`)).text();
  const F = Object.getPrototypeOf(async function () {}).constructor;
  const r = await (new F('SPEC', 'figma', bron))(SPEC, figma);
  uitkomst = {
    schermen: SCHERMEN, fout: null,
    bibliotheek: { totaal: Object.keys(keys.componenten).length, bruikbaar: Object.keys(instanties).length },
    geweigerd: r.geweigerd, aantalMeldingen: r.aantalMeldingen,
    meldingen: (r.meldingen ?? []).slice(0, 12),
    gebouwd: (r.gebouwd ?? []).map(g => ({ component: g.component, type: g.type, nodes: g.nodes })),
  };
} catch (e) {
  uitkomst = { schermen: SCHERMEN, fout: e.message, gebouwd: [] };
}
figma.root.setPluginData('bouwresultaat', JSON.stringify(uitkomst));
figma.root.setPluginData('bouwbezig', '');
return uitkomst;
