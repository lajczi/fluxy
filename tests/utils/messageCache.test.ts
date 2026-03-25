describe('messageCache - basic operations', () => {
  let messageCache: typeof import('../../src/utils/messageCache');

  beforeAll(() => {
    jest.resetModules();
    messageCache = require('../../src/utils/messageCache');
  });

  test('get returns null for unknown messageId', () => {
    expect(messageCache.get('nonexistent')).toBeNull();
  });

  test('store and get round-trips content', () => {
    messageCache.store('msg1', 'hello world');
    expect(messageCache.get('msg1')).toBe('hello world');
  });

  test('store overwrites existing content for same messageId', () => {
    messageCache.store('msg2', 'first');
    messageCache.store('msg2', 'second');
    expect(messageCache.get('msg2')).toBe('second');
  });

  test('remove deletes the entry', () => {
    messageCache.store('msg3', 'to be removed');
    messageCache.remove('msg3');
    expect(messageCache.get('msg3')).toBeNull();
  });

  test('remove on unknown id is a no-op', () => {
    expect(() => messageCache.remove('nope')).not.toThrow();
  });
});

describe('messageCache - null/falsy guard in store', () => {
  let messageCache: typeof import('../../src/utils/messageCache');

  beforeAll(() => {
    jest.resetModules();
    messageCache = require('../../src/utils/messageCache');
  });

  test('store ignores null messageId', () => {
    messageCache.store(null as any, 'content');
    expect(messageCache.get(null as any)).toBeNull();
  });

  test('store ignores undefined messageId', () => {
    messageCache.store(undefined as any, 'content');
    expect(messageCache.get(undefined as any)).toBeNull();
  });

  test('store ignores falsy content', () => {
    messageCache.store('msg_empty', '');
    expect(messageCache.get('msg_empty')).toBeNull();
  });

  test('store ignores null content', () => {
    messageCache.store('msg_null_content', null as any);
    expect(messageCache.get('msg_null_content')).toBeNull();
  });
});

describe('messageCache - MAX_SIZE eviction', () => {
  test('evicts oldest entry when at capacity (MAX_SIZE = 5000)', () => {
    jest.resetModules();
    const mc: typeof import('../../src/utils/messageCache') = require('../../src/utils/messageCache');

    for (let i = 0; i < 5000; i++) {
      mc.store(`fill_${i}`, `content_${i}`);
    }

    expect(mc.get('fill_0')).toBe('content_0');

    mc.store('overflow', 'overflow_content');

    expect(mc.get('fill_0')).toBeNull();
    expect(mc.get('overflow')).toBe('overflow_content');
    expect(mc.get('fill_1')).toBe('content_1');
    expect(mc.get('fill_4999')).toBe('content_4999');
  });
});
