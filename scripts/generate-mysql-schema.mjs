import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "prisma", "schema.prisma");
const mysqlPath = path.join(root, "prisma", "schema.mysql.prisma");
const sqlPath = path.join(root, "deployment", "mysql-schema.sql");

const jsonLists = new Map([
  ["tags", "Json                     @default(\"[]\")"],
  ["basePermissions", "Json                  @default(\"[]\")"],
  ["servicePermissions", "Json               @default(\"[]\")"],
  ["exportTags", "Json          @default(\"[]\")"],
  ["grantedScopes", "Json                   @default(\"[]\")"],
  ["channels", "Json                         @default(\"[]\")"],
]);
const longTextFields = new Set(["body", "youtubeDescription", "encryptedCredentials"]);
const textFields = new Set([
  "logoUrl", "familyNotes", "notes", "description", "lastError", "evidence",
  "rejectionReason", "sourceUrl", "youtubeThumbnailUrl", "errorMessage",
  "externalPostUrl", "href",
]);

function mysqlSchema(source) {
  const lines = source
    .replace('provider = "prisma-client-js"', 'provider      = "prisma-client-js"\n  binaryTargets = ["native", "debian-openssl-3.0.x"]')
    .replace('provider = "postgresql"', 'provider = "mysql"')
    .split("\n");
  return lines.map((line) => {
    const match = line.match(/^(\s+)(tags|basePermissions|servicePermissions|exportTags|grantedScopes|channels)\s+(?:String|ExportTag|CommunicationChannel)\[\]\s+@default\(\[\]\)$/);
    if (match) return `${match[1]}${match[2].padEnd(22)} ${jsonLists.get(match[2])}`;
    const stringField = line.match(/^(\s+)([A-Za-z][A-Za-z0-9]*)\s+(String\??)(.*)$/);
    if (!stringField) return line;
    const nativeType = longTextFields.has(stringField[2]) ? "@db.LongText" : textFields.has(stringField[2]) ? "@db.Text" : null;
    return nativeType ? `${stringField[1]}${stringField[2]} ${stringField[3]}${stringField[4]} ${nativeType}` : line;
  }).join("\n");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "mysql://schema@localhost:3306/churchadmin" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}

const source = await readFile(sourcePath, "utf8");
await mkdir(path.dirname(sqlPath), { recursive: true });
await writeFile(mysqlPath, mysqlSchema(source), "utf8");
run("npx", ["prisma", "format", "--schema", mysqlPath]);
run("npx", ["prisma", "validate", "--schema", mysqlPath]);
const sql = run("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", mysqlPath, "--script"]);
await writeFile(sqlPath, sql, "utf8");
console.log(`Generated ${path.relative(root, mysqlPath)} and ${path.relative(root, sqlPath)}.`);
