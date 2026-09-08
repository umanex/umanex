import { NextResponse } from 'next/server';
import { startApp } from '../../../lib/launch';
import { weigerNietLokaal } from '../../../lib/localOnly';
import { beoordeel } from '../../../lib/requestContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const geweigerd = weigerNietLokaal(request);
  if (geweigerd) return geweigerd;

  const { app } = (await request.json()) as { app?: string };
  if (!app) return NextResponse.json({ ok: false, bericht: 'geen app opgegeven' }, { status: 400 });

  const { poortBezet, geblokkeerd } = beoordeel(app, 'start');
  if (geblokkeerd) return NextResponse.json({ ok: false, bericht: geblokkeerd }, { status: 409 });

  return NextResponse.json(startApp(app, poortBezet));
}
