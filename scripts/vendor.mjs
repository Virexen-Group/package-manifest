// Copies the manifest schema and version ranges into services that check packages (they keep their
// own copy instead of installing this package, like the module contract). Run after a release:
//   node scripts/vendor.mjs ../virexen-cms-api/src/packages
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/vendor.mjs <target folder>");
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const file of ["manifest.ts", "semver.ts"]) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  writeFileSync(join(target, file), `// Vendored from @virexen-group/package-manifest ${version} (src/${file}). Don't edit here: change it there and copy.\n${source}`);
  console.log(`wrote ${join(target, file)}`);
}
