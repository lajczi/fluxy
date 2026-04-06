export interface LogEntry {
  level: string;
  tag: string;
  message: string;
  timestamp: number;
}

const MAX_SIZE = 500;

class LogBuffer {
  private buffer: LogEntry[] = [];

  push(level: string, tag: string, message: string): void {
    if (this.buffer.length >= MAX_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push({ level, tag, message, timestamp: Date.now() });
  }

  getAll(): LogEntry[] {
    return [...this.buffer];
  }

  getRecent(count = 50): LogEntry[] {
    return this.buffer.slice(-count);
  }

  getSince(timestamp: number): LogEntry[] {
    return this.buffer.filter((e) => e.timestamp >= timestamp);
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }
}

const logBuffer = new LogBuffer();
export default logBuffer;
