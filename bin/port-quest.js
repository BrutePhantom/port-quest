#!/usr/bin/env node
'use strict';

const { inspectPorts, normalizePorts } = require('../lib/ports');

const HELP = `
Usage: port-cleaner [ports...] [options]

Find the process listening on one or more local TCP ports.

Arguments:
  ports             Port numbers, separated by spaces or commas (default: 3000)

Options:
  -j, --json        Print machine-readable JSON
  -h, --help        Show this help message
  -v, --version     Show the installed version

Examples:
  port-cleaner
  port-cleaner 3000
  port-cleaner 3000 5173 8080
  port-cleaner 3000,4000 --json
`;

function formatResult(result) {
  if (!result.occupied) return `Port ${result.port}: available`;

  const lines = [`Port ${result.port}: occupied`];
  for (const process of result.processes) {
    const address = process.address ? ` | ${process.address}` : '';
    lines.push(`  PID ${process.pid} | ${process.command}${address}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json') || args.includes('-j');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP.trim());
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(require('../package.json').version);
    return;
  }

  const ports = args.filter((arg) => arg !== '--json' && arg !== '-j');
  const unknownOption = ports.find((arg) => arg.startsWith('-'));
  if (unknownOption) throw new TypeError(`Unknown option: ${unknownOption}`);

  const selectedPorts = ports.length ? normalizePorts(ports) : [3000];
  const results = await inspectPorts(selectedPorts);

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(results.map(formatResult).join('\n'));
  }
}

main().catch((error) => {
  console.error(`port-cleaner: ${error.message}`);
  process.exitCode = 1;
});
