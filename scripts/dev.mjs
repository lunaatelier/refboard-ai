import { spawn } from 'node:child_process';

const env = { ...process.env };

if (process.platform === 'win32' && env.NEXT_FORCE_NATIVE_SWC !== '1') {
  env.NEXT_TEST_WASM = env.NEXT_TEST_WASM || '1';
}

const child = spawn('next', ['dev'], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
