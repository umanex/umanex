import { NextResponse } from 'next/server';
import { weigerNietLokaal } from '../../../lib/localOnly';
import { buildStatus } from '../../../lib/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const geweigerd = weigerNietLokaal(request);
  if (geweigerd) return geweigerd;
  return NextResponse.json(buildStatus());
}
