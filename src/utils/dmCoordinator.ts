const pending = new Map<string, { resolve: (granted: boolean) => void; timeout: NodeJS.Timeout }>();

function initListener(): void {
  if (typeof process.send !== 'function') return;
  process.on('message', (msg: any) => {
    if (msg?.type !== 'dmProcessResponse') return;
    const p = pending.get(msg.messageId);
    if (p) {
      clearTimeout(p.timeout);
      pending.delete(msg.messageId);
      p.resolve(!!msg.granted);
    }
  });
}

let inited = false;

export async function requestDMProcess(messageId: string): Promise<boolean> {
  if (typeof process.send !== 'function') return true;

  if (!inited) {
    inited = true;
    initListener();
  }

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      if (pending.delete(messageId)) resolve(false);
    }, 3000);

    pending.set(messageId, { resolve, timeout });
    try {
      process.send!({ type: 'requestDMProcess', messageId });
    } catch {
      pending.delete(messageId);
      clearTimeout(timeout);
      resolve(false);
    }
  });
}
