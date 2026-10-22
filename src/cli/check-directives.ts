#!/usr/bin/env node
// Usage: metz-check-directives [options] <path>...   (see USAGE in main.ts)
// Exit 0: clean. Exit 1: forbidden directives found. Exit 2: usage error or unreadable path.
// The logic is main() in main.ts; this bin only hands it the real argv and console. It sets the
// exit code rather than calling process.exit, which can cut a long report short on a pipe.
import { main } from './main.ts';

process.exitCode = main(process.argv.slice(2), { out: console.log, err: console.error });
