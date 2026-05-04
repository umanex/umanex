import { NextRequest, NextResponse } from 'next/server';

const IOPAINT_URL = process.env.IOPAINT_URL || 'http://localhost:8080';

// Volledige payload-schema van IOPaint /api/v1/inpaint — defaults voor LaMa
const buildPayload = (image: string, mask: string) => ({
  image,
  mask,
  ldm_steps: 20,
  ldm_sampler: 'plms',
  hd_strategy: 'Original',
  hd_strategy_crop_margin: 32,
  hd_strategy_crop_trigger_size: 2048,
  hd_strategy_resize_limit: 2048,
  prompt: '',
  negative_prompt: '',
  use_croper: false,
  croper_x: 0,
  croper_y: 0,
  croper_height: 512,
  croper_width: 512,
  use_extender: false,
  extender_x: 0,
  extender_y: 0,
  extender_height: 512,
  extender_width: 512,
  sd_scale: 1,
  sd_mask_blur: 5,
  sd_strength: 1.0,
  sd_steps: 50,
  sd_guidance_scale: 7.5,
  sd_sampler: 'uni_pc',
  sd_seed: -1,
  sd_match_histograms: false,
  sd_lcm_lora: false,
  sd_freeu: false,
  sd_freeu_config: { s1: 0.9, s2: 0.2, b1: 1.2, b2: 1.4 },
  p2p_steps: 50,
  p2p_image_guidance_scale: 1.5,
  p2p_guidance_scale: 7.5,
  controlnet_conditioning_scale: 0.4,
  controlnet_method: '',
  paint_by_example_steps: 50,
  paint_by_example_guidance_scale: 7.5,
  paint_by_example_mask_blur: 5,
  paint_by_example_seed: -1,
  paint_by_example_match_histograms: false,
  paint_by_example_example_image: null,
  enable_controlnet: false,
  powerpaint_task: 'text-guided',
  fitting_degree: 1.0,
});

export async function POST(req: NextRequest) {
  try {
    const { image, mask } = await req.json();
    if (!image || !mask) {
      return NextResponse.json(
        { error: 'image en mask zijn verplicht' },
        { status: 400 }
      );
    }

    const r = await fetch(`${IOPAINT_URL}/api/v1/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(image, mask)),
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `IOPaint ${r.status}: ${text}` },
        { status: 502 }
      );
    }

    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': r.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err.cause?.code === 'ECONNREFUSED'
            ? 'Kan geen verbinding maken met IOPaint. Draait de sidecar op poort 8080?'
            : err.message || 'Onbekende fout',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Simpele health check: ping de IOPaint server
  try {
    const r = await fetch(`${IOPAINT_URL}/api/v1/model`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const data = await r.json();
    return NextResponse.json({ ok: true, model: data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'onbereikbaar' },
      { status: 503 }
    );
  }
}

// Grote payloads (volledige foto's in base64) toelaten
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
