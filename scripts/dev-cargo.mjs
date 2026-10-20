import { statfsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const disk = statfsSync(process.cwd());
const free = (Number(disk.bavail) * Number(disk.bsize)) / 1024 ** 3;
if (free < 30)
  throw new Error(`Build stopped: ${free.toFixed(1)} GiB free; 30 required`);
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
const result = spawnSync("cargo", args, { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
