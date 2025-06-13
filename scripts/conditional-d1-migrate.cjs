// scripts/conditional-d1-migrate.cjs
const { spawnSync } = require("child_process");

const dbName = process.argv[2];
if (!dbName) {
  console.error("Usage: node scripts/conditional-d1-migrate.cjs <DB_NAME>");
  process.exit(1);
}

console.log(`Checking for D1 binding: ${dbName}...`);
const listCmd = "wrangler";
const listArgs = ["d1", "migrations", "list", dbName];
const listResult = spawnSync(listCmd, listArgs, { encoding: "utf8", shell: true });
if (listResult.status !== 0) {
  console.log(`D1 binding '${dbName}' not found.`);
  process.exit(0);
}

console.log(`Attempting to apply D1 migrations for '${dbName}'...`);
const applyCmd = "wrangler";
const applyArgs = ["d1", "migrations", "apply", dbName, "--remote"];
const applyResult = spawnSync(applyCmd, applyArgs, { stdio: "inherit", shell: true });
console.error(`'wrangler d1 migrations apply ${dbName} --remote' exited with ${applyResult.status}.`);
if (applyResult.status !== 0) {
  process.exit(1);
} else {
  process.exit(0); // Success
}
