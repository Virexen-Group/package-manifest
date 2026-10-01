#!/usr/bin/env node
// virexen-package check [--tag vX.Y.Z]: checks ./package.json's Silverline manifest before a release.
// In GitHub Actions the tag defaults to GITHUB_REF_NAME when it's a release tag (v…).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPackage } from "./manifest.js";

const [command, ...args] = process.argv.slice(2);
if (command !== "check") {
  console.error("Usage: virexen-package check [--tag vX.Y.Z] [--dir path]");
  process.exit(2);
}
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dir = option("--dir") ?? process.cwd();
const ref = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
const tag = option("--tag") ?? (ref?.startsWith("v") ? ref : undefined);
const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
const result = checkPackage(packageJson, { tag });
const errors = result.ok ? [] : [...result.errors];
if (result.ok && result.manifest.type === "template") {
  // The runtime build must be in the package
  const { root, entry, style } = result.manifest.runtime;
  for (const file of [entry, style].filter((value): value is string => Boolean(value))) {
    if (!existsSync(join(dir, root, file))) errors.push(`virexen.runtime: ${root}/${file} doesn't exist (build the runtime first)`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exit(1);
}
if (result.ok) console.log(`✓ ${result.name}@${result.version} (${result.manifest.type} "${result.manifest.id}")${tag ? `, tag ${tag}` : ""}`);
