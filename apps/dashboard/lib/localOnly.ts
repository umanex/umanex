import { NextResponse } from 'next/server';

/**
 * Deze routes voeren shell-commando's uit. De server bindt op 127.0.0.1 (zie het
 * dev-script), maar dat is één regel in een package.json die iemand kan wegnemen.
 * Deze controle is de tweede sluis: een Host-header die geen loopback is, wordt
 * geweigerd — ook als de bind ooit verslapt.
 */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function weigerNietLokaal(request: Request): NextResponse | null {
  const host = request.headers.get('host') ?? '';
  if (LOOPBACK.test(host)) return null;
  return NextResponse.json(
    { ok: false, bericht: `alleen bereikbaar via loopback, niet via '${host}'` },
    { status: 403 }
  );
}
