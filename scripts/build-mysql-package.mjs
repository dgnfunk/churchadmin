import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { ZipArchive } from "archiver";
import { randomBytes, scryptSync } from "node:crypto";

const root = process.cwd();
const outputRoot = path.join(root, "dist-hosting");
const appRoot = path.join(outputRoot, "churchadmin-mysql");
const zipPath = path.join(outputRoot, "churchadmin-mysql.zip");
const linuxDependenciesRoot = path.join(root, ".build-linux-dependencies");

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function zipDirectory(source, destination) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}

const randomSecret = (bytes = 32) => randomBytes(bytes).toString("hex");
const sqlValue = (value) => `'${String(value).replaceAll("'", "''")}'`;

function passwordHash(password, secret) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(`${password}:${secret}`, salt, 64).toString("hex")}`;
}

await rm(outputRoot, { recursive: true, force: true });
await rm(linuxDependenciesRoot, { recursive: true, force: true });
await mkdir(appRoot, { recursive: true });

run("node", ["scripts/generate-mysql-schema.mjs"]);

try {
  run("npx", ["prisma", "generate", "--schema", "prisma/schema.mysql.prisma"]);
  run("npm", ["run", "build"], { DATABASE_PROVIDER: "mysql" });

  await cp(path.join(root, ".next", "standalone"), appRoot, { recursive: true });
  await Promise.all([".env", ".env.local", ".env.production", ".env.production.local"].map((name) => rm(path.join(appRoot, name), { force: true })));
  await mkdir(path.join(appRoot, ".next"), { recursive: true });
  await cp(path.join(root, ".next", "static"), path.join(appRoot, ".next", "static"), { recursive: true });
  await cp(path.join(root, "public"), path.join(appRoot, "public"), { recursive: true });
  run("npm", ["install", "--prefix", linuxDependenciesRoot, "--force", "--os=linux", "--cpu=x64", "--libc=glibc", "--no-save", "@img/sharp-linux-x64@0.35.3", "@img/sharp-libvips-linux-x64@1.3.2"]);
  await mkdir(path.join(appRoot, "node_modules", "@img"), { recursive: true });
  await cp(path.join(linuxDependenciesRoot, "node_modules", "@img", "sharp-linux-x64"), path.join(appRoot, "node_modules", "@img", "sharp-linux-x64"), { recursive: true });
  await cp(path.join(linuxDependenciesRoot, "node_modules", "@img", "sharp-libvips-linux-x64"), path.join(appRoot, "node_modules", "@img", "sharp-libvips-linux-x64"), { recursive: true });
  await cp(path.join(root, "deployment", "mysql-schema.sql"), path.join(appRoot, "mysql-schema.sql"));
  await cp(path.join(root, "deployment", "SHARED_HOSTING.md"), path.join(appRoot, "LEEME.md"));
  const churchName = process.env.PACKAGE_CHURCH_NAME || "Mi Iglesia";
  const churchSlug = process.env.PACKAGE_CHURCH_SLUG || "mi-iglesia";
  const adminEmail = process.env.PACKAGE_ADMIN_EMAIL || "admin@church.local";
  const adminPassword = process.env.PACKAGE_ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const passwordSecret = process.env.PACKAGE_PASSWORD_SECRET || randomSecret();
  const envTemplate = await readFile(path.join(root, "deployment", "mysql.env.example"), "utf8");
  const configuredEnv = envTemplate
    .replace("CHURCH_SLUG=grace-community", `CHURCH_SLUG=${churchSlug}`)
    .replace("SESSION_SECRET=replace-with-at-least-32-random-characters", `SESSION_SECRET=${randomSecret()}`)
    .replace("PASSWORD_SECRET=replace-with-at-least-32-random-characters", `PASSWORD_SECRET=${passwordSecret}`)
    .replace("ATTENDEE_SESSION_SECRET=replace-with-at-least-32-random-characters", `ATTENDEE_SESSION_SECRET=${randomSecret()}`)
    .replace("SOCIAL_CREDENTIALS_KEY=replace-with-64-hex-characters", `SOCIAL_CREDENTIALS_KEY=${randomSecret()}`);
  await writeFile(path.join(appRoot, ".env.example"), configuredEnv);

  const initialSql = `-- Datos iniciales generados por npm run package:mysql\nSTART TRANSACTION;\nINSERT INTO \`Church\` (\`id\`, \`name\`, \`slug\`, \`timeZone\`, \`defaultPhoneRegion\`, \`createdAt\`, \`updatedAt\`) VALUES ('church-initial', ${sqlValue(churchName)}, ${sqlValue(churchSlug)}, 'America/Monterrey', 'MX', NOW(3), NOW(3));\nINSERT INTO \`ThemeSettings\` (\`id\`, \`churchId\`, \`primaryColor\`, \`accentColor\`, \`mode\`, \`headingStyle\`, \`exportHeader\`, \`slideTemplate\`, \`songLinesPerSlide\`, \`textLinesPerSlide\`, \`maxCharactersPerSlide\`, \`defaultSlideWidth\`, \`defaultSlideHeight\`, \`createdAt\`, \`updatedAt\`) VALUES ('theme-initial', 'church-initial', '#0f766e', '#d69e2e', 'light', 'classic', 'branded', 'centered', 2, 4, 180, 1920, 1080, NOW(3), NOW(3));\nINSERT INTO \`User\` (\`id\`, \`churchId\`, \`name\`, \`email\`, \`passwordHash\`, \`role\`, \`isActive\`, \`mustChangePassword\`, \`createdAt\`, \`updatedAt\`) VALUES ('user-initial-admin', 'church-initial', 'Administrador', ${sqlValue(adminEmail.toLowerCase())}, ${sqlValue(passwordHash(adminPassword, passwordSecret))}, 'ADMIN', true, true, NOW(3), NOW(3));\nCOMMIT;\n`;
  await writeFile(path.join(appRoot, "mysql-initial-data.sql"), initialSql);
  await writeFile(path.join(appRoot, "INSTALLATION-CREDENTIALS.txt"), `CHURCH_SLUG=${churchSlug}\nADMIN_EMAIL=${adminEmail.toLowerCase()}\nTEMPORARY_PASSWORD=${adminPassword}\n\nConfigure the values from .env.example in the hosting panel. Delete this file after the first successful login.\n`);
  await mkdir(path.join(appRoot, "storage", "media"), { recursive: true });
  await mkdir(path.join(appRoot, "storage", "exports"), { recursive: true });

  const packageJsonPath = path.join(appRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.scripts = { start: "node server.js" };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await zipDirectory(appRoot, zipPath);
} finally {
  await rm(linuxDependenciesRoot, { recursive: true, force: true });
  run("npx", ["prisma", "generate", "--schema", "prisma/schema.prisma"]);
}

console.log(`Hosting package: ${path.relative(root, zipPath)}`);
