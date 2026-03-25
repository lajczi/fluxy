export {};

jest.mock('fs');

const fs = require('fs');

fs.existsSync.mockReturnValue(false);
fs.mkdirSync.mockReturnValue(undefined);
fs.writeFileSync.mockReturnValue(undefined);

let autoroleQueue: any;

beforeEach(() => {
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(false);
  jest.resetModules();
  jest.mock('fs');
  const freshFs = require('fs');
  freshFs.existsSync.mockReturnValue(false);
  freshFs.mkdirSync.mockReturnValue(undefined);
  freshFs.writeFileSync.mockReturnValue(undefined);
  autoroleQueue = require('../../src/utils/autoroleQueue');
});

describe('enqueue', () => {
  test('adds an entry to the queue and calls saveQueue (writeFileSync)', () => {
    const freshFs = require('fs');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('does not add duplicate entries (same guild + user + role)', () => {
    const freshFs = require('fs');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('adds separate entries for different roles', () => {
    const freshFs = require('fs');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    autoroleQueue.enqueue('g1', 'u1', 'r2');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  test('adds separate entries for different users', () => {
    const freshFs = require('fs');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    autoroleQueue.enqueue('g1', 'u2', 'r1');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  test('adds separate entries for different guilds', () => {
    const freshFs = require('fs');
    autoroleQueue.enqueue('g1', 'u1', 'r1');
    autoroleQueue.enqueue('g2', 'u1', 'r1');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(2);
  });
});
