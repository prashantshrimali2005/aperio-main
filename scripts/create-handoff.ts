import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function run(command: string, args: string[]) {
  try { return execFileSync(command, args, { encoding: "utf8" }).trim(); }
  catch (error) { return `Unable to read ${command} ${args.join(" ")}: ${String(error)}`; }
}

const root = resolve(".");
const status = run("git", ["status", "--short"]);
const diff = run("git", ["diff", "--stat"]);
const branch = run("git", ["branch", "--show-current"]);
const generatedAt = new Date().toISOString();
const body = [
  "# Aperio handoff snapshot",
  "",
  `Generated: ${generatedAt}`,
  `Branch: ${branch}`,
  "",
  "## Working tree",
  "",
  "```text",
  status || "clean",
  "```",
  "",
  "## Tracked diff summary",
  "",
  "```text",
  diff || "No tracked diff summary available.",
  "```",
  "",
  "## Resume point",
  "",
  "Read `AI_COORDINATION.md` for invariants and the safe handoff prompt. Continue from the current working tree; do not reset it. Run the smallest relevant validation first, then update this file again with `npm run ai:handoff` before handing off.",
  "",
].join("\n");
mkdirSync(resolve(root, ".ai"), { recursive: true });
writeFileSync(resolve(root, ".ai/HANDOFF.md"), body, "utf8");
console.log("Wrote .ai/HANDOFF.md");
