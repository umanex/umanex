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
  const bib = await (await fetch(`http://localhost:${POORT}/library-keys.json`)).json();
  const ontbreekt = SCHERMEN.filter(n => !min.schermen[n]);
  if (ontbreekt.length) throw new Error('onbekend scherm: ' + ontbreekt.join(', '));
  // FRAMES filtert tot één frame per aanroep. Zie de opmerking bij `doelX` in builder.js:
  // een netwerk-import overleeft de wachtlimiet niet, dus elke bouw moet erbinnen passen.
  const kies = (d) => (typeof FRAMES === 'undefined' || !FRAMES.length)
    ? d : { ...d, frames: d.frames.filter(f => FRAMES.includes(f.naam)) };

  /**
   * WAAR ZIT ELK SLOT IN DE BOOM?
   *
   * De slot-markering (`slot` op een tekstnode) komt uit `markeerSlots`, en die draait op de
   * STORY-args van het component zelf. Een schermnode heeft ze dus niet: daar zijn de args die
   * van het scherm. Gemeten 2026-09-09: alle zes de KpiRow-instances in het eerste
   * schermframe kwamen met hun library-default ("Split / 1:52") in beeld.
   *
   * Wat wél overdraagbaar is, is de PLAATS. Dezelfde code rendert dezelfde boomvorm, met
   * andere data; het pad naar de slot-tekstnode geldt dus ook in het scherm. Per variant, want
   * varianten kunnen van vorm verschillen (een spinner in plaats van een waarde).
   */
  const slotPaden = (boom, naam) => {
    // Vanaf de COMPONENTWORTEL, niet vanaf de boomwortel: een story mag een decorator hebben
    // (KpiRow zit in een `<View style={{width:382}}>`), en dan is de gemeten wortel die
    // wrapper. De grens die het component zelf declareert wijst de juiste node aan — gemeten
    // 2026-09-09: zonder deze afdaling stonden alle paden één niveau te hoog en werd geen
    // enkel slot gezet.
    let wortel = null;
    (function zoek(n) { if (wortel) return; if (n.component === naam) { wortel = n; return; } (n.k ?? []).forEach(zoek); })(boom);
    if (!wortel) return {};
    const uit = {};
    (function loop(n, pad) {
      if (n.slot && n.t) uit[n.slot] = pad;
      (n.k ?? []).forEach((k, i) => loop(k, pad === '' ? String(i) : pad + '>' + i));
    })(wortel, '');
    return uit;
  };

  const instanties = {};
  for (const [naam, c] of Object.entries(keys.componenten)) {
    if (c.status === 'UNPUBLISHED') continue;   // niet importeerbaar; de builder meldt het
    const eigen = min.componenten[naam];
    const perVariant = {};
    if (c.varianten && eigen) {
      for (const [vNaam, vKey] of Object.entries(c.varianten)) {
        const v = eigen.varianten.find(x => x.naam === vNaam);
        perVariant[vNaam] = { key: vKey, slotPaden: v ? slotPaden(v.boom, naam) : {} };
      }
    }
    // Hoe diep zit de componentgrens in zijn eigen gemeten boom? Nul zonder story-decorator,
    // één met. Plus de wrapper die de builder eromheen zet: dat is het aantal stappen van de
    // instance-wortel naar de node die de layout draagt — en dus naar de node waarop een
    // override hoort te landen.
    let grensDiepte = 0;
    if (eigen) {
      const zoek = (n, k) => { if (n.component === naam) return k;
        for (const x of n.k ?? []) { const r = zoek(x, k + 1); if (r !== null) return r; } return null; };
      grensDiepte = zoek(eigen.varianten[0].boom, 0) ?? 0;
    }
    // PORTALEERT DIT COMPONENT ZIJN INHOUD? Dan is de library-component een lege wrapper met de
    // inhoud als zuster-overlay, en is één instance niet de goede vorm: gemeten 2026-09-09 gaven
    // MotivationalToast en DeviceSelectionModal 0,01 hoog met nul kinderen in het scherm.
    const portaleert = !!(eigen && eigen.varianten.some(v => (v.overlays ?? []).length));
    instanties[naam] = {
      key: c.key,
      varianten: c.varianten ? perVariant : null,
      slotPaden: c.varianten ? null : (eigen ? slotPaden(eigen.varianten[0].boom, naam) : {}),
      slots: c.slots,
      diepte: grensDiepte,
      portaleert,
    };
  }

  const SPEC = Object.fromEntries(SCHERMEN.map(n => [n, kies(min.schermen[n])]));
  SPEC.__stamp = STAMP;
  SPEC.__doelPagina = 'Screens v2';
  SPEC.__instanties = instanties;
  SPEC.__bibliotheek = bib;

  const bron = await (await fetch(`http://localhost:${POORT}/builder.js`)).text();
  const F = Object.getPrototypeOf(async function () {}).constructor;
  const r = await (new F('SPEC', 'figma', bron))(SPEC, figma);
  uitkomst = {
    schermen: SCHERMEN, fout: null,
    bibliotheek: { totaal: Object.keys(keys.componenten).length, bruikbaar: Object.keys(instanties).length },
    geweigerd: r.geweigerd, vervangen: r.vervangen, aantalMeldingen: r.aantalMeldingen,
    meldingen: (r.meldingen ?? []).slice(0, 12),
    gebouwd: (r.gebouwd ?? []).map(g => ({ component: g.component, type: g.type, nodes: g.nodes })),
  };
} catch (e) {
  uitkomst = { schermen: SCHERMEN, fout: e.message, gebouwd: [] };
}
figma.root.setPluginData('bouwresultaat', JSON.stringify(uitkomst));
figma.root.setPluginData('bouwbezig', '');
return uitkomst;
