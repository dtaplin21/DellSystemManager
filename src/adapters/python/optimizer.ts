import { spawn } from 'child_process';
import path from 'path';
import { z } from 'zod';
import { Artifact } from '../../contracts';

export interface PythonOptimizerOptions {
  pythonPath?: string;
  timeoutMs?: number;
  workingDirectory?: string;
  onStdErr?: (line: string) => void;
}

const OptimizerRequestSchema = z.object({
  siteConfig: z.record(z.any()),
  panels: z.array(
    z.object({
      id: z.string(),
      width: z.number(),
      length: z.number()
    }).passthrough()
  ),
  strategy: z.enum(['balanced', 'material', 'labor']).default('balanced')
});

const OptimizerResponseSchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  data: z.any().optional(),
  error: z
    .object({
      message: z.string(),
      trace: z.string().optional()
    })
    .optional()
});

export type OptimizerRequest = z.infer<typeof OptimizerRequestSchema>;
export type OptimizerResponse = z.infer<typeof OptimizerResponseSchema>;

const PYTHON_BRIDGE = `
import json
import sys
import traceback
from backend.services.panel_optimizer import PanelOptimizer

def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)
    site_config = payload.get('siteConfig', {})
    panels = payload.get('panels', [])
    strategy = payload.get('strategy', 'balanced')
    optimizer = PanelOptimizer(site_config, panels, strategy)
    result = optimizer.optimize()
    print(json.dumps({"status": "PASS", "data": result}))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({
            "status": "FAIL",
            "error": {
                "message": str(exc),
                "trace": traceback.format_exc()
            }
        }))
        sys.exit(1)
`;

export const runPanelOptimizer = async (
  request: OptimizerRequest,
  options: PythonOptimizerOptions = {}
): Promise<{
  response: OptimizerResponse;
  artifact: Artifact;
  durationMs: number;
  stderr: string[];
}> => {
  const payload = OptimizerRequestSchema.parse(request);
  const pythonPath = options.pythonPath ?? 'python3';
  const cwd = options.workingDirectory ?? process.cwd();
  const stderrLines: string[] = [];

  const child = spawn(pythonPath, ['-c', PYTHON_BRIDGE], {
    cwd,
    env: {
      ...process.env,
      PYTHONPATH: `${process.env.PYTHONPATH ?? ''}${path.delimiter}${path.join(cwd, 'backend')}`
    }
  });

  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  const stdoutChunks: Buffer[] = [];

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    stderrLines.push(line);
    if (options.onStdErr) {
      options.onStdErr(line);
    }
  });

  const start = Date.now();

  const exitCode: number = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Python optimizer timed out'));
    }, options.timeoutMs ?? 60_000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      resolve(code ?? 0);
    });
  });

  const durationMs = Date.now() - start;
  const stdout = Buffer.concat(stdoutChunks).toString();

  if (exitCode !== 0 && stdout.trim().length === 0) {
    throw new Error(
      `Python optimizer failed with exit code ${exitCode}: ${stderrLines.join('')}`
    );
  }

  let parsed: OptimizerResponse;
  try {
    parsed = OptimizerResponseSchema.parse(JSON.parse(stdout || '{}'));
  } catch (error) {
    throw new Error(
      `Failed to parse optimizer response: ${
        error instanceof Error ? error.message : 'unknown error'
      }\nRaw output: ${stdout}`
    );
  }

  if (parsed.status === 'FAIL') {
    const message = parsed.error?.message ?? 'Optimizer returned failure status';
    throw new Error(message);
  }

  const artifact: Artifact = {
    id: `layout.optimized.${Date.now()}`,
    type: 'layout.proposed',
    status: 'PASS' as const,
    schemaVersion: '1.0.0',
    producedBy: 'python.optimizer',
    producedAt: new Date().toISOString(),
    data: parsed.data,
    metadata: {
      stderr: stderrLines.filter(Boolean).map((line) => line.trim())
    }
  };

  return {
    response: parsed,
    artifact,
    durationMs,
    stderr: stderrLines
  };
};
