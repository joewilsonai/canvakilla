#!/usr/bin/env node
import { runCli } from "../lib/cli.mjs";

runCli(process.argv.slice(2)).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "CanvaKilla CLI failed."}\n`,
  );
  process.exitCode = 1;
});
