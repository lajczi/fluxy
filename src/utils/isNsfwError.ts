// potentially deprecated but i'm not sure so i'm leaving it in
export default function isNsfwError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'NSFW_CONTENT_AGE_RESTRICTED') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('nsfw') && msg.includes('age restricted');
}
