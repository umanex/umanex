import { NextResponse } from 'next/server';
import { runScript } from '../../../lib/launch';
import { weigerNietLokaal } from '../../../lib/localOnly';
import { beoordeel } from '../../../lib/requestContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const geweigerd = weigerNietLokaal(request);
  if (geweigerd) return geweigerd;

  const { app, script } = (await request.json()) as { app?: string; script?: string };
  if (!app || !script) {
    return NextResponse.json({ ok: false, bericht: 'app en script zijn verplicht' }, { status: 400 });
  }

  const { geblokkeerd } = beoordeel(app, script);
  if (geblokkeerd) return NextResponse.json({ ok: false, bericht: geblokkeerd }, { status: 409 });

  // runScript weigert zelf elk script dat niet in de config van die app staat — de
  // request bepaalt wélk script, nooit wát er draait.
  return NextResponse.json(runScript(app, script));
}
