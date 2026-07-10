import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryDir = join(root, "open-sse/providers/registry");
const indexPath = join(registryDir, "index.js");
const check = process.argv.includes("--check");

const files = (await readdir(registryDir))
  .filter((file) => file.endsWith(".js") && file !== "index.js")
  .sort();

const imports = files.map((file, index) => `import p${index} from "./${file}";`);
const entries = files.map(
  (_, index) => `  p${index}${index === files.length - 1 ? "" : ","}`
);
const output = [
  "// Auto-generated: static imports for all registry entries",
  ...imports,
  "",
  "export default [",
  ...entries,
  "];",
  "",
].join("\n");

if (check) {
  const current = await readFile(indexPath, "utf8").catch(() => "");
  if (current !== output) {
    console.error(
      `${relative(root, indexPath)} is stale. Run: npm run generate:registry`
    );
    process.exitCode = 1;
  } else {
    console.log(`Registry index is current (${files.length} providers).`);
  }
} else {
  await writeFile(indexPath, output);
  console.log(`Generated registry index with ${files.length} providers.`);
}
