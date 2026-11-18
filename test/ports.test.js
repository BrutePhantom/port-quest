'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePorts,
  parseLsof,
  parseWindowsNetstat
} = require('../lib/ports');

test('normalizes unique port arguments and comma-separated input', () => {
  assert.deepEqual(normalizePorts(['3000, 5173', 8080, '3000']), [3000, 5173, 8080]);
});

test('rejects invalid port arguments', () => {
  assert.throws(() => normalizePorts(['abc']), /not a valid port/);
  assert.throws(() => normalizePorts(['0']), /between 1 and 65535/);
  assert.throws(() => normalizePorts(['65536']), /between 1 and 65535/);
});

test('parses lsof listener data', () => {
  const output = 'p1234\ncnode\nn*:3000\np5678\ncpnpm\nn127.0.0.1:3000\n';
  assert.deepEqual(parseLsof(output), [
    { pid: 1234, command: 'node', address: '*:3000' },
    { pid: 5678, command: 'pnpm', address: '127.0.0.1:3000' }
  ]);
});

test('parses Windows listeners for the requested port', () => {
  const output = [
    '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4321',
    '  TCP    [::1]:5173             [::]:0                 LISTENING       6789'
  ].join('\r\n');
  assert.deepEqual(parseWindowsNetstat(output, 3000), [
    { pid: 4321, address: '0.0.0.0:3000' }
  ]);
});
