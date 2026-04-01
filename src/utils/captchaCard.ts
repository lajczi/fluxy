import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';

const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts');
let fontReady = false;
const FONT_FAMILY = 'CaptchaFont';

const WIDTH = 420;
const HEIGHT = 140;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O to avoid confusion, it may be hard to tell for some ppeeps.

async function ensureFont(): Promise<void> {
  if (fontReady) return;

  const dest = join(FONTS_DIR, 'Poppins-Bold.ttf');

  if (existsSync(dest)) {
    GlobalFonts.registerFromPath(dest, FONT_FAMILY);
  } else {
    const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf';
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(FONTS_DIR, { recursive: true });
      writeFileSync(dest, buf);
      GlobalFonts.registerFromPath(dest, FONT_FAMILY);
      console.log('[captchaCard] Downloaded and registered Poppins-Bold font');
    } catch (err: any) {
      console.warn(`[captchaCard] Font download failed (${err.message}), using system fallback`);
    }
  }
  fontReady = true;
}

function randomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function randomLetterColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const sat = 70 + Math.floor(Math.random() * 30); // 70-100%
  const light = 60 + Math.floor(Math.random() * 20); // 60-80%
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export interface CaptchaResult {
  code: string;
  image: Buffer;
}

export async function generateCaptcha(): Promise<CaptchaResult> {
  await ensureFont();

  const code = randomCode(6);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, '#0f0c29');
  grad.addColorStop(0.5, '#1a1a3e');
  grad.addColorStop(1, '#24243e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const fontFamily = GlobalFonts.families.some((f: any) => f.family === FONT_FAMILY)
    ? FONT_FAMILY : 'sans-serif';
  const fontSize = 52;
  const letterSpacing = 52;
  const startX = (WIDTH - (code.length * letterSpacing)) / 2 + letterSpacing / 2;
  const centerY = HEIGHT / 2;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = startX + i * letterSpacing;
    const y = centerY + (Math.random() - 0.5) * 20; // random vertical jitter ±10px
    const rotation = (Math.random() - 0.5) * 0.5;   // ±~14 degrees

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = randomLetterColor();
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 0, 0);

    ctx.restore();
  }

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `hsla(${Math.random() * 360}, 65%, 55%, 0.38)`;
    ctx.lineWidth = 1.2 + Math.random() * 2.2;
    ctx.beginPath();

    const startX = Math.random() * WIDTH * 0.15;
    const startY = Math.random() * HEIGHT;
    ctx.moveTo(startX, startY);

    const segments = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segments; s++) {
      const cpX = startX + ((s + 0.5) / segments) * WIDTH;
      const cpY = Math.random() * HEIGHT;
      const endX = startX + ((s + 1) / segments) * WIDTH;
      const endY = Math.random() * HEIGHT;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const r = Math.random() * 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(108, 114, 248, 0.4)';
  ctx.lineWidth = 2;
  const borderRadius = 12;
  ctx.beginPath();
  ctx.roundRect(1, 1, WIDTH - 2, HEIGHT - 2, borderRadius);
  ctx.stroke();

  const image = await canvas.encode('png') as unknown as Buffer;
  return { code, image };
}
