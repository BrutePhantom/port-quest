'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

/**
 * Turn CLI or API port input into unique, validated port numbers.
 * @param {Array<string | number>} values
 * @returns {number[]}
 */
function normalizePorts(values) {
  const ports = [];

  for (const value of values) {
    for (const item of String(value).split(',')) {
      const candidate = item.trim();
      if (!/^\d+$/.test(candidate)) {
        throw new TypeError(`\"${item}\" is not a valid port number.`);
      }

      const port = Number(candidate);
      if (port < 1 || port > 65535) {
        throw new RangeError(`Port ${port} must be between 1 and 65535.`);
      }

      if (!ports.includes(port)) ports.push(port);
    }
  }

  return ports;
}

async function runCommand(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { windowsHide: true });
    return stdout;
  } catch (error) {
    // lsof returns status 1 when no matching sockets exist.
    if (error.code === 1 && error.stdout) return error.stdout;
    if (error.code === 1 && !error.stderr) return '';

    if (error.code === 'ENOENT') {
      throw new Error(`Unable to inspect ports because \"${command}\" is not installed.`);
    }

    throw error;
  }
}

/**
 * Parse `lsof -Fpcn` output into process records.
 * @param {string} output
 * @returns {Array<{pid: number, command: string, address: string}>}
 */
function parseLsof(output) {
  const processes = [];
  let current = {};

  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const field = line[0];
    const value = line.slice(1);

    if (field === 'p') {
      if (current.pid) processes.push(current);
      current = { pid: Number(value), command: 'unknown', address: '' };
    } else if (field === 'c' && current.pid) {
      current.command = value || 'unknown';
    } else if (field === 'n' && current.pid) {
      current.address = value;
    }
  }

  if (current.pid) processes.push(current);
  return processes;
}

/**
 * Parse `netstat -ano -p tcp` output and return listeners for a port.
 * @param {string} output
 * @param {number} port
 * @returns {Array<{pid: number, address: string}>}
 */
function parseWindowsNetstat(output, port) {
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5 || fields[0].toUpperCase() !== 'TCP') continue;

    const [protocol, localAddress, , state, pid] = fields;
    const portMatch = localAddress.match(/:(\d+)$/);
    if (state.toUpperCase() === 'LISTENING' && portMatch && Number(portMatch[1]) === port) {
      listeners.push({ pid: Number(pid), address: localAddress });
    }
  }

  return listeners;
}

async function findUnixPort(port) {
  const output = await runCommand('lsof', [
    '-nP',
    `-iTCP:${port}`,
    '-sTCP:LISTEN',
    '-Fpcn'
  ]);
  return parseLsof(output);
}

async function windowsProcessName(pid) {
  const output = await runCommand('tasklist', [
    '/FI',
    `PID eq ${pid}`,
    '/FO',
    'CSV',
    '/NH'
  ]);
  const match = output.match(/^"([^"]+)"/m);
  return match ? match[1] : 'unknown';
}

async function findWindowsPort(port) {
  const output = await runCommand('netstat', ['-ano', '-p', 'tcp']);
  const listeners = parseWindowsNetstat(output, port);
  return Promise.all(listeners.map(async (listener) => ({
    ...listener,
    command: await windowsProcessName(listener.pid)
  })));
}

/**
 * Find the processes listening on one local TCP port.
 * @param {number | string} port
 * @returns {Promise<{port: number, occupied: boolean, processes: Array<{pid: number, command: string, address: string}>}>}
 */
async function inspectPort(port) {
  const [normalizedPort] = normalizePorts([port]);
  const processes = process.platform === 'win32'
    ? await findWindowsPort(normalizedPort)
    : await findUnixPort(normalizedPort);

  return {
    port: normalizedPort,
    occupied: processes.length > 0,
    processes
  };
}

/**
 * Find processes listening on several local TCP ports.
 * @param {Array<number | string>} ports
 */
async function inspectPorts(ports) {
  const normalizedPorts = normalizePorts(ports);
  return Promise.all(normalizedPorts.map(inspectPort));
}

module.exports = {
  inspectPort,
  inspectPorts,
  normalizePorts,
  parseLsof,
  parseWindowsNetstat
};
