import { spawn } from 'node:child_process';

const testFiles = [
  'tests/phase2.analysis.test.mjs',
  'tests/phase2.application.test.mjs',
  'tests/phase2.domain.test.mjs',
  'tests/phase2.mcp-handlers.test.mjs',
  'tests/security.test.mjs',
];

for (const testFile of testFiles) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', testFile], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) process.exit(code);
}
