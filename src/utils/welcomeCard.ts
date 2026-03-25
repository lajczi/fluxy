import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import * as bgImageCache from './bgImageCache';
import type { IWelcomeCard } from '../types';

const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts');
let fontReady = false;
const FONT_FAMILY = 'WelcomeFont';
const FALLBACK    = 'sans-serif'; // i want you to know, if you are reading this, sans-serif is my favorite font. 

interface ThemeColors {
  bg: [string, string, string];
  accent: string;
  text: string;
  subtext: string;
  count: string;
}

async function ensureFont(): Promise<void> {
  if (fontReady) return;

  const dest = join(FONTS_DIR, 'Poppins-Bold.ttf');

  if (existsSync(dest)) {
    GlobalFonts.registerFromPath(dest, FONT_FAMILY);
  } else {
    const url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf'; // poppins bold is too though
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(FONTS_DIR, { recursive: true });
      writeFileSync(dest, buf);
      GlobalFonts.registerFromPath(dest, FONT_FAMILY);
      console.log('[welcomeCard] Downloaded and registered Poppins-Bold font');
    } catch (err: any) {
      console.warn(`[welcomeCard] Font download failed (${err.message}), using system fallback`);
    }
  }

  const emojiFont = join(__dirname, '..', 'assets/fonts/', 'NotoColorEmoji-Regular.ttf');
  if (existsSync(emojiFont)) {
    GlobalFonts.registerFromPath(emojiFont, 'Noto Color Emoji');
    console.log('[welcomeCard] Registered NotoColorEmoji font');
  } else {
    console.warn('[welcomeCard] NotoColorEmoji-Regular.ttf not found, emoji may not render on card');
  }

  fontReady = true;
}

function font(weight: string, size: number): string {
  const family = GlobalFonts.families.some((f: any) => f.family === FONT_FAMILY)
    ? FONT_FAMILY : FALLBACK;
  return `${weight} ${size}px "${family}", "Noto Color Emoji"`;
}

export const PRESETS: Record<string, ThemeColors> = {
  default: {
    bg: ['#0f0c29', '#1a1a3e', '#24243e'],
    accent: '#6c72f8',
    text: '#ffffff',
    subtext: '#9999bb',
    count: '#666688',
  },
  dark: {
    bg: ['#0d0d0d', '#1a1a1a', '#262626'],
    accent: '#8b5cf6',
    text: '#f5f5f5',
    subtext: '#a3a3a3',
    count: '#737373',
  },
  light: {
    bg: ['#f8fafc', '#e2e8f0', '#cbd5e1'],
    accent: '#3b82f6',
    text: '#1e293b',
    subtext: '#64748b',
    count: '#94a3b8',
  },
  ocean: {
    bg: ['#0c1445', '#1a237e', '#0d47a1'],
    accent: '#00bcd4',
    text: '#e0f7fa',
    subtext: '#80cbc4',
    count: '#4db6ac',
  },
  sunset: {
    bg: ['#1a0a2e', '#3d1c56', '#5c2d82'],
    accent: '#ff6b6b',
    text: '#fff5f5',
    subtext: '#ffa8a8',
    count: '#ff8787',
  },
  midnight: {
    bg: ['#020617', '#0f172a', '#1e293b'],
    accent: '#a78bfa',
    text: '#e2e8f0',
    subtext: '#94a3b8',
    count: '#64748b',
  },
  forest: {
    bg: ['#052e16', '#14532d', '#166534'],
    accent: '#4ade80',
    text: '#f0fdf4',
    subtext: '#86efac',
    count: '#6ee7b7',
  },
};

function resolveTheme(card: IWelcomeCard | null | undefined): ThemeColors {
  const base = PRESETS.default;
  const preset = card?.preset && PRESETS[card.preset] ? PRESETS[card.preset] : base;

  return {
    bg: [
      card?.bgColor1 || preset.bg[0],
      card?.bgColor2 || preset.bg[1],
      card?.bgColor3 || preset.bg[2],
    ],
    accent:  card?.accentColor  || preset.accent,
    text:    card?.textColor    || preset.text,
    subtext: card?.subtextColor || preset.subtext,
    count:   card?.countColor   || preset.count,
  };
}

function fitText(ctx: any, text: string, maxWidth: number, startSize: number, weight: string): number {
  let size = startSize;
  while (size > 12) {
    ctx.font = font(weight, size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawDots(ctx: any, width: number, height: number, isLight: boolean): void {
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = isLight ? '#000000' : '#ffffff';
  const spacing = 30;
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function drawGradientBg(ctx: any, theme: ThemeColors, width: number, height: number): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(0.5, theme.bg[1]);
  grad.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function isLightTheme(theme: ThemeColors): boolean { // i have no idea if this even works, i should probably test it with some extreme colors at some point. but it seems to do the job for now.
  const [r, g, b] = hexToRgb(theme.bg[1]);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
}

const WIDTH  = 800;
const HEIGHT = 280;
const AVATAR_SIZE = 150;
const AVATAR_X = 135;
const AVATAR_Y = HEIGHT / 2;
const RADIUS = AVATAR_SIZE / 2;

interface WelcomeCardOptions {
  username: string;
  avatarURL: string;
  serverName: string;
  memberCount: number;
  card?: IWelcomeCard | null;
  roleName?: string | null;
}

export async function generateWelcomeCard({ username, avatarURL, serverName, memberCount, card, roleName }: WelcomeCardOptions): Promise<Buffer> {
  await ensureFont();

  const theme = resolveTheme(card);
  const light = isLightTheme(theme);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  let usedBgImage = false;
  if (card?.bgImageURL) {
    const bgPath = bgImageCache.getCachedPath(card.bgImageURL);
    if (bgPath) {
      try {
        const bgImg = await loadImage(bgPath);
        const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
        const drawW = bgImg.width * scale;
        const drawH = bgImg.height * scale;
        ctx.drawImage(bgImg, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
// yea
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        usedBgImage = true;
      } catch {
        drawGradientBg(ctx, theme, WIDTH, HEIGHT);
      }
    } else {
      drawGradientBg(ctx, theme, WIDTH, HEIGHT);
    }
  } else {
    drawGradientBg(ctx, theme, WIDTH, HEIGHT);
  }

  if (!usedBgImage) {
    drawDots(ctx, WIDTH, HEIGHT, light);
  }

  // glowy, taken STRAIGHT from stack fuckin overflow
  const [ar, ag, ab] = hexToRgb(theme.accent);
  const glowGrad = ctx.createRadialGradient(AVATAR_X, AVATAR_Y, 10, AVATAR_X, AVATAR_Y, 160);
  glowGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.15)`);
  glowGrad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // top and bottom accents
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, 1.5);
  ctx.lineTo(WIDTH, 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 1.5);
  ctx.lineTo(WIDTH, HEIGHT - 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  let avatar: any;
  try {
    avatar = await loadImage(avatarURL);
  } catch {
    avatar = null;
  }

  // da ring
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(AVATAR_X, AVATAR_Y, RADIUS + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR_X, AVATAR_Y, RADIUS, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatar) {
    ctx.drawImage(avatar, AVATAR_X - RADIUS, AVATAR_Y - RADIUS, AVATAR_SIZE, AVATAR_SIZE);
  } else {
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(AVATAR_X - RADIUS, AVATAR_Y - RADIUS, AVATAR_SIZE, AVATAR_SIZE);
    ctx.fillStyle = theme.text;
    ctx.font = font('bold', 64);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), AVATAR_X, AVATAR_Y);
  }
  ctx.restore();

  const textX = AVATAR_X + RADIUS + 45;
  const maxTextW = WIDTH - textX - 30;

  const greeting = card?.greetingText || 'WELCOME';
  ctx.fillStyle = theme.accent;
  ctx.font = font('bold', 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '6px';
  ctx.fillText(greeting.toUpperCase(), textX, AVATAR_Y - 65);
  ctx.letterSpacing = '0px';

  const userSize = fitText(ctx, username, maxTextW, 38, 'bold');
  ctx.font = font('bold', userSize);
  ctx.fillStyle = theme.text;
  ctx.fillText(username, textX, AVATAR_Y - 38);

  const serverLabel = card?.subtitle || `to ${serverName}`;
  fitText(ctx, serverLabel, maxTextW, 20, 'normal');
  ctx.fillStyle = theme.subtext;
  ctx.fillText(serverLabel, textX, AVATAR_Y + 10);

  if (card?.showMemberCount !== false) {
    ctx.font = font('normal', 16);
    ctx.fillStyle = theme.count;
    ctx.fillText(`Member #${memberCount.toLocaleString()}`, textX, AVATAR_Y + 44);
  }

  let separatorY = AVATAR_Y + 72;
  if (roleName) {
    ctx.font = font('normal', 14);
    ctx.fillStyle = theme.accent;
    ctx.fillText(`Role: ${roleName}`, textX, AVATAR_Y + 66);
    separatorY = AVATAR_Y + 90;
  }

  const [sr, sg, sb] = hexToRgb(theme.accent);
  ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, 0.25)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, separatorY);
  ctx.lineTo(textX + Math.min(maxTextW, 250), separatorY);
  ctx.stroke();

  return canvas.encode('png') as unknown as Buffer;
}
