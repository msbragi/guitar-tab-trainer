import { spawn } from 'node:child_process';

const commands = [
  ['--filter', '@guitar-practice/core', 'watch'],
  ['--filter', '@guitar-practice/audio-engine', 'watch'],
  ['--filter', '@guitar-practice/study-project', 'watch'],
  ['--filter', '@guitar-practice/alphatab-adapter', 'watch'],
  ['--filter', '@guitar-practice/web', 'dev'],
];
const children = commands.map((args) => spawn(process.execPath, [process.env.npm_execpath, ...args], {
  stdio: 'inherit',
}));
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach((child) => {
  child.on('error', (error) => { console.error(error); stop(1); });
  child.on('exit', (code) => stop(code ?? 0));
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
