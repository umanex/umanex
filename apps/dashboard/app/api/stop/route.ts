import { NextResponse } from 'next/server';
import { stopApp } from '../../../lib/launch';
import { weigerNietLokaal } from '../../../lib/localOnly';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const geweigerd = weigerNietLokaal(request);
  if (geweigerd) return geweigerd;

  const { app } = (await request.json()) as { app?: string };
  if (!app) return NextResponse.json({ ok: false, bericht: 'geen app opgegeven' }, { status: 400 });

  // Geen guard nodig: stopApp raakt per constructie alleen een pid die dit dashboard
  // zelf noteerde. Een PM2-proces of een externe dev-server heeft hier geen pidbestand.
  return NextResponse.json(stopApp(app));
}
