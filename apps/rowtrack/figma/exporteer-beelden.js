// ---------------------------------------------------------------------------
// Exporteert Figma-nodes als PNG naar schijf, via de lokale server.
//
// WAAROM DIT BESTAAT. `parity` vergelijkt geometrie en kan per constructie drie dingen niet
// zien: kleurwaarde, icoonvorm en `text-transform`. Dat laatste is bewezen misleidend — de
// browser rendert "500M" waar `textContent` "500m" is, over 42 nodes in 12 componenten. Op
// 2026-09-09 bleek bovendien dat een instance 390 breed kon zijn met inhoud van 224 terwijl
// dertien guard-assen groen stonden en parity nul verschillen gaf. Alleen een beeld vond dat.
//
// WAAROM exportAsync EN NIET EEN SCREENSHOT. `figma_capture_screenshot` legt het canvas vast:
// zoomniveau, selectie-randen en het raster zitten erin, en de maat hangt af van het venster.
// `exportAsync` levert de node zelf, op een gekozen schaal, deterministisch. Gemeten
// 2026-09-09: 43 ms en 24 KB voor een frame van 430x932.
//
// WAAROM VIA DE SERVER EN NIET ALS RETURNWAARDE. De bytes overleven de tool-call niet — en de
// 30 s van `figma_execute` is een WACHTlimiet, geen uitvoerlimiet, dus een `fetch` ná die
// grens komt niet meer aan. Kleine batches dus, en de uitkomst in pluginData.
//
// De server (`scripts/figma-serve.mjs`) decodeert base64 zodra het pad op `.png` eindigt.
// Binair door een plugin-fetch sturen is niet gegarandeerd; tekst wel.
// ---------------------------------------------------------------------------
const POORT = 9229;

/** Base64 zonder btoa/Buffer — die bestaan geen van beide in de plugin-sandbox. */
function base64(bytes) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    s += T[a >> 2] + T[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (b === undefined ? '=' : T[((b & 15) << 2) | ((c ?? 0) >> 6)])
      + (c === undefined ? '=' : T[c & 63]);
  }
  return s;
}

const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

await figma.loadAllPagesAsync();
const uit = [], fouten = [];

if (DOEL === 'schermen') {
  if (figma.fileKey !== 'T1bGrvIzSNeLyh5CbarATZ') return { fout: 'schermen staan in RowTrack - Design, niet in ' + figma.fileKey };
  const p = figma.root.children.find((x) => x.name === 'Screens v2');
  if (!p) return { fout: 'geen pagina Screens v2' };
  for (const f of p.children) {
    const scherm = f.getPluginData('scherm'), frame = f.getPluginData('frame');
    if (!scherm || !frame) continue;
    if (FILTER.length && !FILTER.includes(scherm)) continue;
    try {
      const bytes = await f.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: SCHAAL } });
      const naam = `${slug(scherm)}__${slug(frame)}.figma.png`;
      const r = await fetch(`http://localhost:${POORT}/beelden/${naam}`, { method: 'POST', body: base64(bytes) });
      uit.push({ naam, bytes: bytes.length, breedte: Math.round(f.width), hoogte: Math.round(f.height), ok: r.ok });
    } catch (e) { fouten.push(`${scherm}/${frame}: ${e.message}`); }
  }
} else {
  if (figma.fileKey !== 'QkRgMc7Quqtbow71DiYa1n') return { fout: 'componenten staan in RowTrack -  Design System, niet in ' + figma.fileKey };
  for (const p of figma.root.children) {
    if (FILTER.length && !FILTER.includes(p.name)) continue;
    const set = p.children.find((c) => c.type === 'COMPONENT_SET') ?? p.children.find((c) => c.type === 'COMPONENT');
    if (!set) continue;
    for (const v of set.type === 'COMPONENT_SET' ? set.children : [set]) {
      try {
        const bytes = await v.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: SCHAAL } });
        const naam = `${slug(p.name)}__${slug(v.name)}.figma.png`;
        const r = await fetch(`http://localhost:${POORT}/beelden/${naam}`, { method: 'POST', body: base64(bytes) });
        uit.push({ naam, bytes: bytes.length, breedte: Math.round(v.width), hoogte: Math.round(v.height), ok: r.ok });
      } catch (e) { fouten.push(`${p.name}/${v.name}: ${e.message}`); }
    }
  }
}

const resultaat = { doel: DOEL, schaal: SCHAAL, geexporteerd: uit.length,
  totaalBytes: uit.reduce((a, u) => a + u.bytes, 0), mislukt: uit.filter((u) => !u.ok).length, fouten };
figma.root.setPluginData('beeldresultaat', JSON.stringify(resultaat));
return resultaat;
