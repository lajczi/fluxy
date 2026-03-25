// im such a fat fucking chud

export default function formatDuration(ms: number): string {
  if (!ms || typeof ms !== 'number' || ms < 0) return '0 seconds';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  
  const parts: string[] = [];
  
  if (weeks > 0) {
    parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
  }
  
  if (days % 7 > 0) {
    parts.push(`${days % 7} day${days % 7 > 1 ? 's' : ''}`);
  }
  
  if (hours % 24 > 0) {
    parts.push(`${hours % 24} hour${hours % 24 > 1 ? 's' : ''}`);
  }
  
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''}`);
  }
  
  if (seconds % 60 > 0 && parts.length === 0) {
    parts.push(`${seconds % 60} second${seconds % 60 > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ') || '0 seconds';
}
