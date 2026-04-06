/**
in memory cache i am tired here's a little ascii dog to make up for it

       /^-^\
      / o o \
     /   Y   \
     V \ v / V
       / - \
      /    |
(    /     |
 ===/___) ||

 */

const MAX_SIZE = 5000;

const cache = new Map<string, string>();

export function store(messageId: string, content: string): void {
  if (!messageId || !content) return;

  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value!);
  }

  cache.set(messageId, content);
}

export function get(messageId: string): string | null {
  return cache.get(messageId) ?? null;
}

export function remove(messageId: string): void {
  cache.delete(messageId);
}

// im sure there is a better way to do this but im tired and it works so
