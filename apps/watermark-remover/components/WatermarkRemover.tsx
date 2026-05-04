'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Loader2, X, MousePointer2, Sparkles, RefreshCw, ImageIcon, Check, Archive } from 'lucide-react';
import JSZip from 'jszip';

// ─────────────────────────────────────────────────────────────
// INPAINTING ALGORITHM
// Bilinear interpolation of rectangle boundary + optional noise
// ─────────────────────────────────────────────────────────────
function inpaintRect(ctx, rect, opts = {}) {
  const { feather = 4, noise = 0.04 } = opts;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const x1 = Math.max(0, Math.floor(rect.x));
  const y1 = Math.max(0, Math.floor(rect.y));
  const x2 = Math.min(W - 1, Math.floor(rect.x + rect.w));
  const y2 = Math.min(H - 1, Math.floor(rect.y + rect.h));
  if (x2 <= x1 || y2 <= y1) return;

  const imageData = ctx.getImageData(0, 0, W, H);
  const d = imageData.data;

  // Sample boundary lines once
  const sampleY1 = Math.max(0, y1 - 1);
  const sampleY2 = Math.min(H - 1, y2 + 1);
  const sampleX1 = Math.max(0, x1 - 1);
  const sampleX2 = Math.min(W - 1, x2 + 1);

  const topRow = new Uint8ClampedArray((x2 - x1 + 1) * 3);
  const botRow = new Uint8ClampedArray((x2 - x1 + 1) * 3);
  const leftCol = new Uint8ClampedArray((y2 - y1 + 1) * 3);
  const rightCol = new Uint8ClampedArray((y2 - y1 + 1) * 3);

  for (let x = x1; x <= x2; x++) {
    const iTop = (sampleY1 * W + x) * 4;
    const iBot = (sampleY2 * W + x) * 4;
    const k = (x - x1) * 3;
    topRow[k] = d[iTop]; topRow[k + 1] = d[iTop + 1]; topRow[k + 2] = d[iTop + 2];
    botRow[k] = d[iBot]; botRow[k + 1] = d[iBot + 1]; botRow[k + 2] = d[iBot + 2];
  }
  for (let y = y1; y <= y2; y++) {
    const iL = (y * W + sampleX1) * 4;
    const iR = (y * W + sampleX2) * 4;
    const k = (y - y1) * 3;
    leftCol[k] = d[iL]; leftCol[k + 1] = d[iL + 1]; leftCol[k + 2] = d[iL + 2];
    rightCol[k] = d[iR]; rightCol[k + 1] = d[iR + 1]; rightCol[k + 2] = d[iR + 2];
  }

  const rectW = x2 - x1;
  const rectH = y2 - y1;

  // Fill with weighted bilinear boundary interpolation
  for (let y = y1; y <= y2; y++) {
    const fy = rectH === 0 ? 0.5 : (y - y1) / rectH;
    const ky = (y - y1) * 3;
    for (let x = x1; x <= x2; x++) {
      const fx = rectW === 0 ? 0.5 : (x - x1) / rectW;
      const kx = (x - x1) * 3;

      // Horizontal interpolation (left → right)
      const hR = leftCol[ky] * (1 - fx) + rightCol[ky] * fx;
      const hG = leftCol[ky + 1] * (1 - fx) + rightCol[ky + 1] * fx;
      const hB = leftCol[ky + 2] * (1 - fx) + rightCol[ky + 2] * fx;

      // Vertical interpolation (top → bottom)
      const vR = topRow[kx] * (1 - fy) + botRow[kx] * fy;
      const vG = topRow[kx + 1] * (1 - fy) + botRow[kx + 1] * fy;
      const vB = topRow[kx + 2] * (1 - fy) + botRow[kx + 2] * fy;

      // Average both directions (transfinite-style)
      let r = (hR + vR) * 0.5;
      let g = (hG + vG) * 0.5;
      let b = (hB + vB) * 0.5;

      // Add subtle noise for texture break-up
      if (noise > 0) {
        const n = (Math.random() - 0.5) * 255 * noise;
        r += n; g += n; b += n;
      }

      // Feather edges: blend with original pixels near boundary
      const distToEdge = Math.min(x - x1, x2 - x, y - y1, y2 - y);
      if (distToEdge < feather) {
        const i = (y * W + x) * 4;
        const blend = distToEdge / feather;
        r = d[i] * (1 - blend) + r * blend;
        g = d[i + 1] * (1 - blend) + g * blend;
        b = d[i + 2] * (1 - blend) + b * blend;
      }

      const i = (y * W + x) * 4;
      d[i] = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function processImage(img, normalizedRect, opts) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const rect = {
    x: normalizedRect.x * canvas.width,
    y: normalizedRect.y * canvas.height,
    w: normalizedRect.w * canvas.width,
    h: normalizedRect.h * canvas.height,
  };

  inpaintRect(ctx, rect, opts);
  return canvas;
}

// Fast preview: inpaints directly on an already-drawn canvas (no copy)
function previewInpaintOnCanvas(targetCanvas, sourceImg, normalizedRect, opts) {
  const ctx = targetCanvas.getContext('2d');
  // Redraw source image at canvas display size
  ctx.drawImage(sourceImg, 0, 0, targetCanvas.width, targetCanvas.height);
  const rect = {
    x: normalizedRect.x * targetCanvas.width,
    y: normalizedRect.y * targetCanvas.height,
    w: normalizedRect.w * targetCanvas.width,
    h: normalizedRect.h * targetCanvas.height,
  };
  if (rect.w < 2 || rect.h < 2) return;
  inpaintRect(ctx, rect, opts);
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// ─── AI helpers ──────────────────────────────────────────────
function imageToBase64PNG(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}

function createMaskBase64(width, height, normalizedRect, paddingPx) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  // White rect = area to inpaint, met optionele padding
  const x = Math.max(0, normalizedRect.x * width - paddingPx);
  const y = Math.max(0, normalizedRect.y * height - paddingPx);
  const w = Math.min(width - x, normalizedRect.w * width + paddingPx * 2);
  const h = Math.min(height - y, normalizedRect.h * height + paddingPx * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  return canvas.toDataURL('image/png').split(',')[1];
}

async function inpaintViaAI(img, normalizedRect, paddingPx) {
  const imageB64 = imageToBase64PNG(img);
  const maskB64 = createMaskBase64(
    img.naturalWidth,
    img.naturalHeight,
    normalizedRect,
    paddingPx
  );

  const r = await fetch('/api/inpaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageB64, mask: maskB64 }),
  });

  if (!r.ok) {
    let msg = `AI-fout (${r.status})`;
    try {
      const errJson = await r.json();
      msg = errJson.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const blob = await r.blob();
  return blob;
}

// ─────────────────────────────────────────────────────────────
// UI COMPONENT
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles] = useState([]);
  const [rect, setRect] = useState(null); // normalized 0-1
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [padding, setPadding] = useState(8); // mask expand in display px
  const [dragging, setDragging] = useState(false);
  const [aiStatus, setAiStatus] = useState('checking'); // checking | ready | offline
  const [aiModel, setAiModel] = useState('');

  const editCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const dragStart = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ─── AI health check ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch('/api/inpaint', { method: 'GET' });
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          setAiStatus('ready');
          setAiModel(data.model?.name || data.model?.model_name || 'lama');
        } else {
          setAiStatus('offline');
        }
      } catch {
        if (!cancelled) setAiStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ─── file loading ────────────────────────────────────────
  const loadFiles = async (list) => {
    const valid = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!valid.length) {
      alert('Geen geldige afbeeldingen geselecteerd.');
      return;
    }
    try {
      const loaded = await Promise.all(
        valid.map(
          (f) =>
            new Promise((resolve, reject) => {
              const url = URL.createObjectURL(f);
              const img = new Image();
              img.onload = () => resolve({ file: f, url, img, name: f.name });
              img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Kan ${f.name} niet laden`));
              };
              img.src = url;
            })
        )
      );
      setFiles(loaded);
      setResults([]);
      setRect(null);
    } catch (err) {
      console.error(err);
      alert(`Fout bij laden: ${err.message}`);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) loadFiles(e.dataTransfer.files);
  };

  // ─── draw base image on editor canvas ────────────────────
  useEffect(() => {
    if (!files.length) return;
    const canvas = editCanvasRef.current;
    if (!canvas) return;

    const setup = () => {
      try {
        const first = files[0].img;
        const container = containerRef.current;
        const containerW = container?.clientWidth || 800;
        const maxW = Math.min(Math.max(containerW, 300), 900);
        const scale = Math.min(1, maxW / first.naturalWidth);
        canvas.width = Math.max(1, Math.round(first.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(first.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(first, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.error('Canvas setup error:', err);
      }
    };

    // Run on next frame so layout is settled
    const rafId = requestAnimationFrame(setup);
    return () => cancelAnimationFrame(rafId);
  }, [files]);

  // ─── render overlay + preview whenever rect changes ──────
  useEffect(() => {
    if (!files.length || !rect) return;
    const canvas = editCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas || !preview) return;

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const first = files[0].img;

        // Redraw edit canvas met overlay + padding-indicator
        const ctx = canvas.getContext('2d');
        ctx.drawImage(first, 0, 0, canvas.width, canvas.height);

        const rx = rect.x * canvas.width;
        const ry = rect.y * canvas.height;
        const rw = rect.w * canvas.width;
        const rh = rect.h * canvas.height;

        // Padding indicator (buitenste stippellijn)
        if (padding > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(194, 65, 12, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(
            rx - padding,
            ry - padding,
            rw + padding * 2,
            rh + padding * 2
          );
          ctx.restore();
        }

        // Hoofd-rect
        ctx.save();
        ctx.fillStyle = 'rgba(194, 65, 12, 0.18)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.restore();

        // Fast client-side preview (bilinear) — geeft idee, niet eindresultaat
        preview.width = canvas.width;
        preview.height = canvas.height;
        const paddedRect = {
          x: Math.max(0, rect.x - padding / canvas.width),
          y: Math.max(0, rect.y - padding / canvas.height),
          w: rect.w + (padding * 2) / canvas.width,
          h: rect.h + (padding * 2) / canvas.height,
        };
        previewInpaintOnCanvas(preview, first, paddedRect, { feather: 4, noise: 0.02 });
      } catch (err) {
        console.error('Preview render error:', err);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [rect, files, padding]);

  // ─── mouse handling for rectangle ────────────────────────
  const getRel = (e) => {
    const canvas = editCanvasRef.current;
    const b = canvas.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX) - b.left;
    const cy = (e.clientY ?? e.touches?.[0]?.clientY) - b.top;
    return { x: cx / b.width, y: cy / b.height };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const p = getRel(e);
    dragStart.current = p;
    setDragging(true);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e) => {
    if (!dragging || !dragStart.current) return;
    e.preventDefault();
    const p = getRel(e);
    const s = dragStart.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onPointerUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  // ─── batch process via AI ────────────────────────────────
  const processAll = async () => {
    if (!rect || !files.length) return;
    if (rect.w < 0.001 || rect.h < 0.001) {
      alert('Teken eerst een rechthoek over het watermerk.');
      return;
    }
    if (aiStatus !== 'ready') {
      alert('IOPaint sidecar niet bereikbaar. Start hem via `./start-iopaint.sh` of `iopaint start --model=lama --device=cpu --port=8080`.');
      return;
    }

    // Converteer display-padding naar beeld-ruimte per foto gebeurt in inpaintViaAI
    // We rekenen padding uit op basis van display-canvas; schaal naar image-resolutie
    const displayCanvas = editCanvasRef.current;
    const scale = files[0].img.naturalWidth / (displayCanvas?.width || 1);
    const paddingImagePx = Math.round(padding * scale);

    setProcessing(true);
    setProgress({ done: 0, total: files.length });
    setResults([]);

    const out = [];
    const errors = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const blob = await inpaintViaAI(f.img, rect, paddingImagePx);
        if (!blob) throw new Error('Lege response');
        const url = URL.createObjectURL(blob);
        const base = f.name.replace(/\.[^.]+$/, '');
        const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        out.push({
          name: `${base}_clean.${ext}`,
          blob,
          url,
          origName: f.name,
        });
      } catch (err) {
        console.error(`Fout bij verwerken ${f.name}:`, err);
        errors.push(`${f.name}: ${err.message}`);
      }
      setProgress({ done: i + 1, total: files.length });
      await new Promise((r) => setTimeout(r, 0));
    }
    setResults(out);
    setProcessing(false);
    if (errors.length) {
      alert(`${errors.length} foto('s) niet verwerkt:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n…' : ''}`);
    }
  };

  const downloadOne = (r) => {
    const a = document.createElement('a');
    a.href = r.url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = async () => {
    if (!results.length) return;
    try {
      const zip = new JSZip();
      for (const r of results) {
        zip.file(r.name, r.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `watermark-removed-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('ZIP-fout:', err);
      alert('Kon ZIP niet maken: ' + err.message);
    }
  };

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setFiles([]);
    setResults([]);
    setRect(null);
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full" style={{ background: '#FAF7F0', fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300;1,9..144,500&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .italic-label { font-family: 'Fraunces', serif; font-style: italic; font-weight: 400; }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* ── Header ── */}
        <header className="mb-10 pb-8" style={{ borderBottom: '1px solid #E8E1D3' }}>
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <p className="italic-label text-sm mb-2" style={{ color: '#8B7A5A' }}>
                tooling · batch · AI-powered · v0.2
              </p>
              <h1 className="display text-5xl md:text-6xl font-light" style={{ color: '#1A1A1A' }}>
                Watermark <span style={{ fontStyle: 'italic', color: '#c2410c' }}>remover</span>.
              </h1>
              <p className="mt-3 text-sm max-w-lg" style={{ color: '#6B6355' }}>
                Lokale batch-tool met LaMa AI-inpainting. Teken het gebied één keer op de eerste foto,
                de AI verwerkt de hele reeks. Alles draait lokaal via IOPaint — geen cloud, geen uploads.
              </p>
            </div>
            {files.length > 0 && (
              <button
                onClick={reset}
                className="mono text-xs uppercase tracking-widest px-4 py-2 transition-all hover:opacity-60"
                style={{ color: '#6B6355' }}
              >
                <RefreshCw className="inline w-3 h-3 mr-2" />
                reset
              </button>
            )}
          </div>
        </header>

        {/* ── Drop zone ── */}
        {!files.length && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) loadFiles(e.target.files);
                e.target.value = ''; // allow re-selecting same files
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              className="block cursor-pointer transition-all"
            >
              <div
                className="border-2 border-dashed rounded-sm p-20 text-center transition-all hover:bg-white"
                style={{ borderColor: '#D4C9B2', background: '#FDFCF7' }}
              >
                <Upload className="w-8 h-8 mx-auto mb-5" strokeWidth={1.2} style={{ color: '#8B7A5A' }} />
                <p className="display text-2xl font-light mb-2" style={{ color: '#1A1A1A' }}>
                  Sleep je foto's hierheen
                </p>
                <p className="text-sm mb-6" style={{ color: '#6B6355' }}>
                  of klik om te selecteren · JPG, PNG · alle foto's met zelfde watermerk-positie
                </p>
                <p className="mono text-xs uppercase tracking-widest" style={{ color: '#A89B80' }}>
                  — browse files —
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── Editor ── */}
        {files.length > 0 && (
          <div className="space-y-8">
            {/* File count strip */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-4 h-4" style={{ color: '#8B7A5A' }} />
                <span className="mono text-xs uppercase tracking-widest" style={{ color: '#6B6355' }}>
                  {files.length} {files.length === 1 ? 'foto' : "foto's"} geladen
                </span>
              </div>
              {rect && (
                <span className="mono text-xs" style={{ color: '#8B7A5A' }}>
                  mask: {(rect.w * 100).toFixed(1)}% × {(rect.h * 100).toFixed(1)}% @ [
                  {(rect.x * 100).toFixed(1)}, {(rect.y * 100).toFixed(1)}]
                </span>
              )}
            </div>

            {/* Instructions */}
            <div className="flex items-start gap-3 p-4 rounded-sm" style={{ background: '#FDFCF7', border: '1px solid #E8E1D3' }}>
              <MousePointer2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#c2410c' }} />
              <p className="text-sm leading-relaxed" style={{ color: '#3A3630' }}>
                <span className="italic-label">Teken een rechthoek</span> over het watermerk op de eerste foto.
                Dezelfde genormaliseerde coördinaten worden op elke foto toegepast, dus ze mogen van verschillende afmetingen zijn.
              </p>
            </div>

            {/* Canvas editor + preview side by side */}
            <div className="grid md:grid-cols-2 gap-6">
              <div ref={containerRef}>
                <p className="italic-label text-sm mb-3" style={{ color: '#8B7A5A' }}>
                  — origineel · teken hier —
                </p>
                <div className="rounded-sm overflow-hidden" style={{ background: '#1A1A1A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <canvas
                    ref={editCanvasRef}
                    className="block w-full cursor-crosshair touch-none"
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                  />
                </div>
              </div>

              <div>
                <p className="italic-label text-sm mb-3" style={{ color: '#8B7A5A' }}>
                  — snelle preview · AI geeft eindresultaat —
                </p>
                <div
                  className="rounded-sm overflow-hidden flex items-center justify-center"
                  style={{
                    background: '#1A1A1A',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    minHeight: 200,
                  }}
                >
                  {rect ? (
                    <canvas ref={previewCanvasRef} className="block w-full" />
                  ) : (
                    <p className="text-sm py-20" style={{ color: '#8B7A5A' }}>
                      teken een rechthoek links
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="p-5 rounded-sm" style={{ background: '#FDFCF7', border: '1px solid #E8E1D3' }}>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="mono text-xs uppercase tracking-widest block mb-3" style={{ color: '#6B6355' }}>
                    mask padding · {padding}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={padding}
                    onChange={(e) => setPadding(Number(e.target.value))}
                    className="w-full accent-orange-700"
                  />
                  <p className="text-xs mt-1.5" style={{ color: '#8B7A5A' }}>
                    Extra marge rond het watermerk (voor schaduw/anti-aliasing)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background:
                        aiStatus === 'ready' ? '#15803d' :
                        aiStatus === 'checking' ? '#ca8a04' : '#b91c1c',
                    }}
                  />
                  <div className="flex-1">
                    <p className="mono text-xs uppercase tracking-widest" style={{ color: '#6B6355' }}>
                      {aiStatus === 'ready' && `AI ready · ${aiModel || 'lama'}`}
                      {aiStatus === 'checking' && 'AI verbinden…'}
                      {aiStatus === 'offline' && 'AI offline'}
                    </p>
                    {aiStatus === 'offline' && (
                      <p className="text-xs mt-1" style={{ color: '#8B7A5A' }}>
                        Start IOPaint in aparte terminal
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-4" style={{ borderTop: '1px solid #E8E1D3' }}>
              <p className="text-sm" style={{ color: '#6B6355' }}>
                {results.length > 0
                  ? <><Check className="inline w-4 h-4 mr-1.5" style={{ color: '#15803d' }} />{results.length} foto's verwerkt</>
                  : processing
                    ? `Bezig… ${progress.done}/${progress.total}`
                    : "Klaar om alle foto's te verwerken"}
              </p>
              <div className="flex gap-3">
                {results.length > 0 && (
                  <button
                    onClick={downloadAll}
                    className="mono text-xs uppercase tracking-widest px-5 py-3 rounded-sm transition-all flex items-center gap-2"
                    style={{ background: '#1A1A1A', color: '#FAF7F0' }}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    download zip ({results.length})
                  </button>
                )}
                <button
                  onClick={processAll}
                  disabled={!rect || processing || aiStatus !== 'ready'}
                  className="mono text-xs uppercase tracking-widest px-5 py-3 rounded-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#c2410c', color: '#FAF7F0' }}
                >
                  {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {processing ? 'AI bezig…' : 'verwerk met AI'}
                </button>
              </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div>
                <p className="italic-label text-sm mb-4 mt-4" style={{ color: '#8B7A5A' }}>
                  — resultaten —
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {results.map((r, i) => (
                    <div key={i} className="group relative rounded-sm overflow-hidden" style={{ background: '#1A1A1A' }}>
                      <img src={r.url} alt={r.name} className="block w-full aspect-square object-cover" />
                      <button
                        onClick={() => downloadOne(r)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(26, 26, 26, 0.85)' }}
                      >
                        <Download className="w-5 h-5" style={{ color: '#FAF7F0' }} />
                      </button>
                      <p className="mono text-xs p-2 truncate" style={{ color: '#FAF7F0', background: '#1A1A1A' }}>
                        {r.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 pt-6 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #E8E1D3', color: '#8B7A5A' }}>
          <span className="mono uppercase tracking-widest">lokaal · geen cloud</span>
          <span className="italic-label">LaMa via IOPaint</span>
        </footer>
      </div>
    </div>
  );
}
