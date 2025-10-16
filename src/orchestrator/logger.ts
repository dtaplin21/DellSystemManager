import fs from 'fs/promises';
import path from 'path';

export interface RunLoggerOptions {
  logRoot: string;
}

export class RunLogger {
  private readonly logRoot: string;

  constructor(options: RunLoggerOptions) {
    this.logRoot = options.logRoot;
  }

  async append(runId: string, entry: Record<string, unknown>): Promise<void> {
    const logPath = this.getLogPath(runId);
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    });
    await fs.appendFile(logPath, `${payload}\n`, 'utf-8');
  }

  getLogPath(runId: string): string {
    return path.join(this.logRoot, `${runId}.jsonl`);
  }
}
