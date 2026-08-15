import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const expected = process.env.RELEASE_VERSION?.replace(/^v/, "");
if (expected && expected !== pkg.version) {
  throw new Error(`RELEASE_VERSION ${expected} does not match package.json version ${pkg.version}`);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const run = (args) => execFileSync(pnpm, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  // Windows batch launchers such as pnpm.cmd require a shell when spawned from Node.
  shell: process.platform === "win32",
});

run(["install", "--frozen-lockfile"]);
run(["check"]);
run(["test"]);
run(["build"]);
if (!existsSync(resolve(root, "dist"))) throw new Error("dist directory was not produced");
run(["exec", "electron-builder", "--win", "nsis", "portable", "--publish", "never"]);
console.log(`Windows artifacts for PipeFlow Pro ${pkg.version} are available under dist/`);
