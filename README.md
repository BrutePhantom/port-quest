# port-cleaner

Find the process listening on a local TCP port. It is a quick way to see why a development server cannot start on port `3000` (or any other port).

## Install

```bash
npm install -g port-cleaner
```

Or run it without installing:

```bash
npx port-cleaner 3000
```

## CLI

Checking no argument checks port `3000`:

```bash
port-cleaner
# Port 3000: occupied
#   PID 48120 | node | *:3000
```

Check several ports with spaces or commas:

```bash
port-cleaner 3000 5173 8080
port-cleaner 3000,5173,8080
```

Print JSON for scripts:

```bash
port-cleaner 3000 5173 --json
```

The tool reports listeners only; it never stops a process.

## Programmatic usage

```js
const { inspectPort, inspectPorts } = require('port-cleaner');

const port = await inspectPort(3000);
// { port: 3000, occupied: true, processes: [{ pid, command, address }] }

const ports = await inspectPorts([3000, 5173]);
```

## Platform support

- macOS and Linux: uses `lsof`
- Windows: uses `netstat` and `tasklist`

## Development

```bash
npm test
```

## License

[MIT](LICENSE)
