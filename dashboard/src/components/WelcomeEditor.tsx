import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Save, Loader2, Upload, X, Eye, Palette, Image as ImageIcon, MessageSquare, Mail } from 'lucide-react';
import type { WelcomeMessage, GuildDetail } from '../lib/api';

const PRESETS: Record<string, { bg: [string, string, string]; accent: string; text: string; subtext: string; count: string }> = {
  default:  { bg: ['#0f0c29', '#1a1a3e', '#24243e'], accent: '#6c72f8', text: '#ffffff', subtext: '#9999bb', count: '#666688' },
  dark:     { bg: ['#0d0d0d', '#1a1a1a', '#262626'], accent: '#8b5cf6', text: '#f5f5f5', subtext: '#a3a3a3', count: '#737373' },
  light:    { bg: ['#f8fafc', '#e2e8f0', '#cbd5e1'], accent: '#3b82f6', text: '#1e293b', subtext: '#64748b', count: '#94a3b8' },
  ocean:    { bg: ['#0c1445', '#1a237e', '#0d47a1'], accent: '#00bcd4', text: '#e0f7fa', subtext: '#80cbc4', count: '#4db6ac' },
  sunset:   { bg: ['#1a0a2e', '#3d1c56', '#5c2d82'], accent: '#ff6b6b', text: '#fff5f5', subtext: '#ffa8a8', count: '#ff8787' },
  midnight: { bg: ['#020617', '#0f172a', '#1e293b'], accent: '#a78bfa', text: '#e2e8f0', subtext: '#94a3b8', count: '#64748b' },
  forest:   { bg: ['#052e16', '#14532d', '#166534'], accent: '#4ade80', text: '#f0fdf4', subtext: '#86efac', count: '#6ee7b7' },
};

const PRESET_NAMES = Object.keys(PRESETS);

function ColorInput({ label, value, onChange, placeholder }: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value || placeholder || '#6c72f8'}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-8 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
        />
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder={placeholder || 'Inherit from theme'}
          className="h-8 text-xs font-mono"
        />
        {value && (
          <button onClick={() => onChange(null)} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ChannelSelect({ channels, value, onChange, placeholder = 'Select channel' }: {
  channels: GuildDetail['channels'];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
  const textChannels = channels.filter(c => c.type === 0 || c.type === 5);

  return (
    <Select value={value ?? '__none__'} onValueChange={v => onChange(v === '__none__' ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {categories.map(cat => {
          const children = textChannels.filter(c => c.parent_id === cat.id).sort((a, b) => a.position - b.position);
          return [
            <div key={`cat-${cat.id}`} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground select-none">
              {cat.name.toUpperCase()}
            </div>,
            ...children.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>  # {ch.name}</SelectItem>
            ))
          ];
        })}
      </SelectContent>
    </Select>
  );
}

function CardPreview({ card, showRole }: {
  card: WelcomeMessage['card'];
  showRole: boolean;
}) {
  const preset = PRESETS[card.preset || 'default'] || PRESETS.default;
  const bg1 = card.bgColor1 || preset.bg[0];
  const bg2 = card.bgColor2 || preset.bg[1];
  const bg3 = card.bgColor3 || preset.bg[2];
  const accent = card.accentColor || preset.accent;
  const textColor = card.textColor || preset.text;
  const subtextColor = card.subtextColor || preset.subtext;
  const countColor = card.countColor || preset.count;
  const greetingText = (card.greetingText || 'WELCOME').toUpperCase();
  const subtitle = card.subtitle || 'to My Server';
  const showMemberCount = card.showMemberCount !== false;

  return (
    <div
      className="relative overflow-hidden shadow-2xl"
      style={{
        width: '100%',
        maxWidth: 500,
        aspectRatio: '800/280',
        borderRadius: 4,
      }}
    >
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: card.bgImageURL
          ? `url(${card.bgImageURL}) center/cover`
          : `linear-gradient(135deg, ${bg1}, ${bg2}, ${bg3})`,
      }} />

      {/* Dark overlay for bg images */}
      {card.bgImageURL && (
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }} />
      )}

      {/* Dot pattern (only when no bg image) */}
      {!card.bgImageURL && (
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }}
        />
      )}

      {/* Accent glow behind avatar area */}
      <div className="absolute" style={{
        left: '10%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}26 0%, ${accent}00 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Top accent border */}
      <div className="absolute top-0 left-0 right-0 h-[3px] opacity-40" style={{ backgroundColor: accent }} />
      {/* Bottom accent border */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] opacity-40" style={{ backgroundColor: accent }} />

      {/* Content: avatar left, text right */}
      <div className="relative flex items-center h-full" style={{ padding: '0 5% 0 8%' }}>
        {/* Avatar with ring */}
        <div className="shrink-0" style={{ marginRight: '5%' }}>
          <div className="rounded-full" style={{
            padding: 4,
            border: `3px solid ${accent}`,
          }}>
            <img
              src="/default-avatar.png"
              alt="Avatar"
              className="rounded-full"
              style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          {/* Greeting - uppercase, accent, letter-spacing */}
          <p className="font-bold" style={{
            color: accent,
            fontSize: 9,
            letterSpacing: '4px',
            lineHeight: 1.2,
            marginBottom: 2,
          }}>
            {greetingText}
          </p>

          {/* Username */}
          <p className="font-bold truncate" style={{
            color: textColor,
            fontSize: 22,
            lineHeight: 1.3,
          }}>
            Username
          </p>

          {/* Subtitle */}
          <p style={{
            color: subtextColor,
            fontSize: 11,
            lineHeight: 1.4,
            marginTop: 1,
          }}>
            {subtitle}
          </p>

          {/* Member count */}
          {showMemberCount && (
            <p style={{
              color: countColor,
              fontSize: 9,
              lineHeight: 1.4,
              marginTop: 4,
            }}>
              Member #427
            </p>
          )}

          {/* Role */}
          {showRole && (
            <p style={{
              color: accent,
              fontSize: 8,
              lineHeight: 1.4,
              marginTop: 2,
            }}>
              Role: Member
            </p>
          )}

          {/* Separator line */}
          <div style={{
            marginTop: 8,
            width: '60%',
            maxWidth: 150,
            height: 1,
            backgroundColor: `${accent}40`,
          }} />
        </div>
      </div>
    </div>
  );
}

interface WelcomeEditorProps {
  settings: { welcomeMessage: WelcomeMessage; guildId: string };
  guild: GuildDetail;
  onSave: (patch: { welcomeMessage: WelcomeMessage }) => void;
  saving?: boolean;
}

export default function WelcomeEditor({ settings, guild, onSave, saving }: WelcomeEditorProps) {
  const [welcome, setWelcome] = useState(settings.welcomeMessage);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<WelcomeMessage>) => setWelcome(prev => ({ ...prev, ...patch }));
  const updateCard = (patch: Partial<WelcomeMessage['card']>) =>
    setWelcome(prev => ({ ...prev, card: { ...prev.card, ...patch } }));
  const updateEmbed = (patch: Partial<WelcomeMessage['embed']>) =>
    setWelcome(prev => ({ ...prev, embed: { ...prev.embed, ...patch } }));
  const updateDM = (patch: Partial<WelcomeMessage['dm']>) =>
    setWelcome(prev => ({ ...prev, dm: { ...prev.dm, ...patch } }));

  const handleSave = () => onSave({ welcomeMessage: welcome });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.type === 'image/gif') {
      setUploadError('GIF images are not supported. Use PNG, JPEG, or WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image too large (max 4MB)');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/guilds/${settings.guildId}/upload-bg`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(d.error);
      }

      const { url } = await res.json();
      updateCard({ bgImageURL: url });
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const currentPreset = PRESETS[welcome.card.preset || 'default'] || PRESETS.default;

  return (
    <div className="space-y-6">
      {/* - Core Settings - */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Welcome Message</CardTitle>
          <CardDescription>Greet new members when they join your server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Enabled</p>
              <p className="text-xs text-gray-400">Send a welcome message when someone joins</p>
            </div>
            <Switch checked={welcome.enabled} onCheckedChange={v => update({ enabled: v })} />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Welcome Channel</Label>
              <ChannelSelect channels={guild.channels} value={welcome.channelId} onChange={v => update({ channelId: v })} />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={welcome.trigger} onValueChange={v => update({ trigger: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="join">When they join</SelectItem>
                  <SelectItem value="role">When they get a role</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Welcome Message</Label>
            <Textarea value={welcome.message || ''} onChange={e => update({ message: e.target.value })}
              placeholder="Welcome {user} to {server}!" rows={3} />
            <p className="text-xs text-gray-500">Variables: {'{user}'} {'{server}'} {'{count}'} {'{role}'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]">
              <div>
                <p className="text-sm font-medium text-white">Welcome Card Image</p>
                <p className="text-xs text-gray-400">Attach a generated image card</p>
              </div>
              <Switch checked={welcome.imageEnabled} onCheckedChange={v => update({ imageEnabled: v })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]">
              <div>
                <p className="text-sm font-medium text-white">Show Role on Card</p>
                <p className="text-xs text-gray-400">Display highest role name</p>
              </div>
              <Switch checked={welcome.showRole} onCheckedChange={v => update({ showRole: v })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* - Card Designer - */}
      {welcome.imageEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Card Designer</CardTitle>
            <CardDescription>Customize the look of your welcome card with themes, colors, and background images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Live preview + theme picker side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Eye className="h-3.5 w-3.5" /> Live Preview
                </div>
                <CardPreview
                  card={welcome.card}
                  showRole={welcome.showRole}
                />
              </div>

              {/* Theme picker */}
              <div className="space-y-4">
                <Label>Theme</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_NAMES.map(name => {
                    const p = PRESETS[name];
                    const isSelected = (welcome.card.preset || 'default') === name;
                    return (
                      <button
                        key={name}
                        onClick={() => updateCard({ preset: name })}
                        className={`relative rounded-lg p-2 text-center transition-all border-2 ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-transparent hover:border-white/20'
                        }`}
                      >
                        {/* Color swatch */}
                        <div
                          className="h-8 rounded-md mb-1.5"
                          style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]}, ${p.bg[2]})` }}
                        />
                        {/* Accent dot */}
                        <div className="flex items-center justify-center gap-1">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.accent }} />
                          <span className="text-[10px] text-gray-400 capitalize">{name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Separator />

                {/* Greeting text */}
                <div className="space-y-2">
                  <Label>Greeting Text</Label>
                  <Input
                    value={welcome.card.greetingText || ''}
                    onChange={e => updateCard({ greetingText: e.target.value })}
                    placeholder="WELCOME"
                  />
                  <p className="text-xs text-gray-500">Shown above the username (max 30 chars). Displayed uppercase.</p>
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    value={welcome.card.subtitle || ''}
                    onChange={e => updateCard({ subtitle: e.target.value || null })}
                    placeholder="to My Server"
                  />
                  <p className="text-xs text-gray-500">Shown below the username (max 50 chars). Default: "to ServerName"</p>
                </div>

                {/* Show member count */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Show Member Count</p>
                    <p className="text-xs text-gray-400">Display "Member #N" on the card</p>
                  </div>
                  <Switch checked={welcome.card.showMemberCount} onCheckedChange={v => updateCard({ showMemberCount: v })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Background Image */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ImageIcon className="h-3.5 w-3.5" /> Background Image
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Upload Image</>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">PNG, JPEG, WebP - max 4MB</p>

                  {uploadError && (
                    <p className="text-xs text-red-400">{uploadError}</p>
                  )}

                  {/* Or paste URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Or paste an image URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={welcome.card.bgImageURL || ''}
                        onChange={e => updateCard({ bgImageURL: e.target.value || null })}
                        placeholder="https://example.com/background.png"
                        className="text-xs"
                      />
                      {welcome.card.bgImageURL && (
                        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9"
                          onClick={() => updateCard({ bgImageURL: null })}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Image preview */}
                <div className="flex items-center justify-center">
                  {welcome.card.bgImageURL ? (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 w-full" style={{ aspectRatio: '16/9' }}>
                      <img
                        src={welcome.card.bgImageURL}
                        alt="Background preview"
                        className="w-full h-full object-cover"
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 w-full text-gray-500 text-xs"
                      style={{ aspectRatio: '16/9' }}>
                      No background image set
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Custom Colors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Palette className="h-3.5 w-3.5" /> Custom Colors
                </div>
                <Badge variant="secondary" className="text-xs">Override theme defaults</Badge>
              </div>
              <p className="text-xs text-gray-500">Leave blank to use the selected theme's default colors. Set a color to override.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <ColorInput label="Background 1" value={welcome.card.bgColor1} onChange={v => updateCard({ bgColor1: v })} placeholder={currentPreset.bg[0]} />
                <ColorInput label="Background 2" value={welcome.card.bgColor2} onChange={v => updateCard({ bgColor2: v })} placeholder={currentPreset.bg[1]} />
                <ColorInput label="Background 3" value={welcome.card.bgColor3} onChange={v => updateCard({ bgColor3: v })} placeholder={currentPreset.bg[2]} />
                <ColorInput label="Accent" value={welcome.card.accentColor} onChange={v => updateCard({ accentColor: v })} placeholder={currentPreset.accent} />
                <ColorInput label="Text" value={welcome.card.textColor} onChange={v => updateCard({ textColor: v })} placeholder={currentPreset.text} />
                <ColorInput label="Subtext" value={welcome.card.subtextColor} onChange={v => updateCard({ subtextColor: v })} placeholder={currentPreset.subtext} />
                <ColorInput label="Count" value={welcome.card.countColor} onChange={v => updateCard({ countColor: v })} placeholder={currentPreset.count} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* - Embed - */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Welcome Embed</CardTitle>
          <CardDescription>Add a rich embed box below the welcome message</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Enabled</p>
              <p className="text-xs text-gray-400">Show an embed alongside the welcome message</p>
            </div>
            <Switch checked={welcome.embed.enabled} onCheckedChange={v => updateEmbed({ enabled: v })} />
          </div>
          {welcome.embed.enabled && (
            <>
              <Separator />
              {/* Embed preview bar */}
              <div className="rounded-lg overflow-hidden border border-white/10">
                <div className="flex">
                  <div className="w-1 shrink-0" style={{ backgroundColor: welcome.embed.color || '#5865F2' }} />
                  <div className="p-4 space-y-2 flex-1 bg-[hsl(var(--muted))]">
                    {welcome.embed.title && (
                      <p className="text-sm font-semibold text-white">{welcome.embed.title}</p>
                    )}
                    {welcome.embed.description && (
                      <p className="text-xs text-gray-300">{welcome.embed.description}</p>
                    )}
                    {welcome.embed.footer && (
                      <p className="text-[10px] text-gray-500 pt-1 border-t border-white/5">{welcome.embed.footer}</p>
                    )}
                    {!welcome.embed.title && !welcome.embed.description && (
                      <p className="text-xs text-gray-500 italic">Preview will appear here...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input value={welcome.embed.title || ''} onChange={e => updateEmbed({ title: e.target.value })} placeholder="Embed title" />
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={welcome.embed.color || '#5865F2'}
                        onChange={e => updateEmbed({ color: e.target.value })}
                        className="h-9 w-9 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                      />
                      <Input value={welcome.embed.color || ''} onChange={e => updateEmbed({ color: e.target.value })} placeholder="#5865F2" className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
              </div>
              <Textarea value={welcome.embed.description || ''} onChange={e => updateEmbed({ description: e.target.value })} placeholder="Embed description - supports {user}, {server}, {count}" rows={3} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input value={welcome.embed.footer || ''} onChange={e => updateEmbed({ footer: e.target.value })} placeholder="Footer text" />
                <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]">
                  <div>
                    <p className="text-sm font-medium text-white">Thumbnail</p>
                    <p className="text-xs text-gray-400">Show member avatar</p>
                  </div>
                  <Switch checked={welcome.embed.thumbnail} onCheckedChange={v => updateEmbed({ thumbnail: v })} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* - DM - */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Welcome DM</CardTitle>
          <CardDescription>Send a private message to new members when they join</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Send DM on Join</p>
              <p className="text-xs text-gray-400">Direct message each new member privately</p>
            </div>
            <Switch checked={welcome.dm.enabled} onCheckedChange={v => updateDM({ enabled: v })} />
          </div>
          {welcome.dm.enabled && (
            <>
              <Separator />
              <Textarea value={welcome.dm.message || ''} onChange={e => updateDM({ message: e.target.value })}
                placeholder="Hey {user}, welcome to {server}! Check out #rules to get started." rows={3} />
              <p className="text-xs text-gray-500">Variables: {'{user}'} {'{server}'} {'{count}'} {'{role}'}</p>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]">
                <div>
                  <p className="text-sm font-medium text-white">Include Welcome Card</p>
                  <p className="text-xs text-gray-400">Attach the welcome card image to the DM</p>
                </div>
                <Switch checked={welcome.dm.imageEnabled} onCheckedChange={v => updateDM({ imageEnabled: v })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* - Save - */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Changes</>
          )}
        </Button>
      </div>
    </div>
  );
}
