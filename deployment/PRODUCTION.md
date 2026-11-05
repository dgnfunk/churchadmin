# Production deployment guide

Use this guide alongside the [README](../README.md#choosing-a-production-host). It describes the repository's current deployment paths. A host must support an always-on Node.js backend, the selected database, writable persistent storage, and HTTPS. Uploading the source to a PHP or static hosting directory does not start the application.

## Docker Compose

Follow the [README Docker installation](../README.md#production-with-docker) for a new Linux server. Compose supplies the database, web process, two workers, backup process, and HTTPS proxy. Keep the repository in the same directory between deployments because `./data` contains persistent state.

| Path/service | What to preserve or monitor |
| --- | --- |
| `data/postgres` | Live PostgreSQL data; use `pg_dump` backups rather than copying this directory while the database is running. |
| `data/media` | Private uploads shared by the app and export worker. |
| `data/exports` | Generated downloads shared by the app and export worker. |
| `data/caddy`, `data/caddy-config` | Caddy certificate/configuration state. |
| `BACKUP_STORAGE_PATH` | Backup archives; defaults to `./backups`. Copy off-server. |
| `.env` | Installation-specific credentials and secrets. Securely back up separately. |
| `app`, `export-worker`, `communications-worker`, `backup`, `caddy`, `db` | Check `docker compose ps` and service logs for restarts/errors. |

Compose reads `.env` for variable substitution and explicitly passes configured values to each container. Adding an arbitrary new variable to `.env` does not pass it through automatically; also add it to the relevant service's `environment` mapping. Do not run `docker compose config` without `--quiet` when collecting public support logs: resolved configuration contains secrets.

The database password is embedded in a connection URL. Use a generated hex password for the included stack. Outside Compose, percent-encode reserved characters in database usernames/passwords according to the connection URL format. Changing `POSTGRES_PASSWORD` after the database has been initialized does not change the existing database user's password; coordinate the database password change and application configuration.

### Existing reverse proxy

The included Caddy service binds ports 80/443. If an existing proxy uses those ports, adapt Compose: remove the included Caddy service and route the existing proxy to the app on a private network or a loopback-only published port. Preserve the original `Host` and forwarded HTTPS information. `PUBLIC_APP_URL` must be the browser's HTTPS origin.

Server Actions compare request origins with the host. If an intentional proxy topology uses different hosts, configure only the required additional host in `experimental.serverActions.allowedOrigins` in `next.config.mjs`, then rebuild. The existing development host entries do not prevent matching production origins from working. Avoid wildcard origin access.

Set upload limits and timeouts on every proxy to accommodate your workload. `MAX_MEDIA_BYTES` defaults to 2 GiB, and the included Caddy configuration limits request bodies to 2 GB; resumable uploads use smaller requests. An upstream proxy may enforce a lower limit. Never cache authenticated pages, check-in submissions, or private media responses as public content.

## Node.js without Docker

This path uses PostgreSQL and a full repository checkout. Use Node.js 22 to match the Docker runtime and the `--env-file` examples below, plus npm, Git, a reachable PostgreSQL database, a persistent disk, and a provider proxy with HTTPS. Native dependencies such as Prisma and Sharp must support the host's OS/CPU. Install dependencies and build on the target platform; do not copy a macOS `node_modules` directory onto Linux.

### Install and configure

The commands below assume `/srv/churchadmin` is owned by a dedicated deployment user. Have the server administrator create that directory and user first, or substitute your hosting panel's application directory everywhere below.

```bash
git clone https://github.com/dgnfunk/churchadmin.git /srv/churchadmin
cd /srv/churchadmin
npm ci
cp .env.example .env
chmod 600 .env
mkdir -p storage/media storage/exports
```

Create an empty PostgreSQL database and a database user that can create/alter application tables during migrations. Configure a TLS connection when required by your database host. Edit `.env`:

- Set `DATABASE_URL` to the actual database connection URL. `POSTGRES_PASSWORD` and `PUBLIC_HOST` are only used by the included Compose stack.
- Set independent `PASSWORD_SECRET` and `ATTENDEE_SESSION_SECRET` values, and a separate `SOCIAL_CREDENTIALS_KEY` if using social integrations.
- Set `PUBLIC_APP_URL` to the HTTPS origin, such as `https://admin.your-church.example`.
- Set absolute `MEDIA_STORAGE_PATH=/srv/churchadmin/storage/media` and `EXPORT_STORAGE_PATH=/srv/churchadmin/storage/exports`. If a host replaces the release directory on deployment, use a disk mounted outside that directory instead.
- Set `EXPORT_WORKER_IN_APP=false` and `COMMUNICATIONS_WORKER_IN_APP=false` for dedicated workers. For a simple single-process installation, use `true` and omit the dedicated worker processes; jobs will depend on that web process remaining active.
- Set `CHURCH_SLUG` to the church record you provision. The included PostgreSQL demo seed always uses `grace-community`.
- Configure optional SMTP and communications variables as needed.

Use the hosting panel's secret/environment manager instead of `.env` if it provides one. Supply the same relevant values to migrations, the web process, and workers. Commands run directly with Node/tsx do not receive Next.js's automatic `.env` loading, so these examples explicitly load it through Node.js 22. Keep this file in dotenv format; do not source it as a shell script.

### Migrate, build, and initialize

```bash
npm run db:generate
NODE_ENV=production npx prisma migrate deploy
NODE_ENV=production npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

Prisma and Next.js load the repository's `.env` for these commands. If building in CI, supply the required environment there too.

The project enables Next.js standalone output. Start its generated `server.js` as shown below. Copying `public` and `.next/static` is required for images and browser assets. Keep the full repository and `node_modules` for the separate worker, migration, and maintenance commands; `npm ci --omit=dev` would remove `tsx`, which workers need.

**First-install limitation:** migrations only create the schema. The PostgreSQL repository currently offers a demo seed, with sample people/services and multiple accounts, rather than a clean production initializer. For a fresh evaluation database only, configure both seed passwords, use `CHURCH_SLUG=grace-community`, and run:

```bash
NODE_ENV=production npm run db:seed:demo
```

Sign in at `/login` as `elena@grace.example` using `SEED_ADMIN_PASSWORD`. Never run this as part of a deployment/update pipeline. For an empty real congregation, provision the church, theme, and administrator through a separately reviewed initializer before opening access, or use the existing [MySQL package](SHARED_HOSTING.md), which generates those initial records. There is currently no PostgreSQL command for that clean setup.

### Run and supervise processes

From `/srv/churchadmin`, these are the three process commands. Run each under a supervisor that restarts it after failures and starts it on boot:

```bash
# Web process; the hosting panel may supply PORT instead.
NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 node --env-file=/srv/churchadmin/.env .next/standalone/server.js

# Dedicated workers; omit if their corresponding in-app flag is true.
NODE_ENV=production node --env-file=/srv/churchadmin/.env --import=tsx scripts/export-worker.ts
NODE_ENV=production node --env-file=/srv/churchadmin/.env --import=tsx scripts/communications-worker.ts
```

Do not rely on keeping an SSH terminal open. On a Linux server using systemd, this is an example `/etc/systemd/system/churchadmin-web.service`. Adjust the deployment user and Node executable location for your host:

```ini
[Unit]
Description=ChurchAdmin web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=churchadmin
WorkingDirectory=/srv/churchadmin
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node --env-file=/srv/churchadmin/.env /srv/churchadmin/.next/standalone/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

Create `churchadmin-exports.service` and `churchadmin-communications.service` with the same working directory, environment loading, and restart policy. Replace `Description` and `ExecStart` respectively with:

```ini
Description=ChurchAdmin exports
ExecStart=/usr/bin/node --env-file=/srv/churchadmin/.env --import=tsx /srv/churchadmin/scripts/export-worker.ts
```

```ini
Description=ChurchAdmin communications
ExecStart=/usr/bin/node --env-file=/srv/churchadmin/.env --import=tsx /srv/churchadmin/scripts/communications-worker.ts
```

After creating all three files, a server administrator can enable them:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now churchadmin-web churchadmin-exports churchadmin-communications
sudo systemctl status churchadmin-web churchadmin-exports churchadmin-communications
```

Place the host's HTTPS reverse proxy in front of `127.0.0.1:3000`, preserve the public host and forwarded HTTPS headers, and keep port 3000 private. For a managed Node.js panel, configure the equivalent supervised web/worker commands, environment, and persistent volumes using its controls. A panel that only accepts a startup filename can use `.next/standalone/server.js` for the web process; supply its environment explicitly and confirm that the required assets are copied.

Apply the [README verification steps](../README.md#5-verify-before-handing-over). Configure database and file backups yourself; the repository's backup/restore shell scripts depend on Docker Compose and do not apply to this path.

### Managed Node.js panel checklist

Use this when Docker and systemd access are unavailable but the hosting panel can supervise Node.js. For a PostgreSQL source deployment, complete the install/build steps above using SSH or the panel's terminal/build controls. If the plan offers neither a build environment nor a way to upload a compatible prebuilt application, those capabilities must be resolved with the provider before using this path. The separate [MySQL package workflow](SHARED_HOSTING.md) prepares the application outside the hosting panel.

| Panel setting | PostgreSQL source deployment | Prepared MySQL package |
| --- | --- | --- |
| Node.js version | 22 | 22 |
| Application directory | Repository root containing `.next/standalone` | Extracted package root containing `server.js` |
| Startup file | `.next/standalone/server.js` | `server.js` |
| Environment | `NODE_ENV=production` plus the configured installation variables | `NODE_ENV=production` plus the package's configured variables |
| Port/binding | Use the panel's assigned `PORT` and required binding; avoid a fixed port unless instructed by the host | Same |
| Workers when only one process is available | Both `*_WORKER_IN_APP=true`; keep the web process always on | Both flags are enabled in the package template; keep the web process always on |
| Persistent storage | Absolute paths on persistent writable disk | Persistent writable `storage/media` and `storage/exports`, or equivalent absolute paths |
| Domain | Attach the public domain and enable the panel's HTTPS proxy/certificate | Same |
| Restart policy | Automatic restart after failure/reboot; no idle suspension | Same |

Set environment variables for the Node.js process through the panel, rather than leaving only an `.env.example` file on disk. The generated standalone server runs from its own output directory, so do not assume it will find a repository-root `.env` without the explicit environment-loading command. Keep the application directory outside a directly served static document root so configuration and installation files are not exposed as downloads.

Start the application with the panel's controls, inspect its application/error logs, and verify `/api/health`, `/login`, uploads, and exports. If the panel stops the process when idle, background work is not reliable under the in-app worker mode. Confirm always-on execution with the provider before scheduling communications.

## Updating an existing installation

Keep the last working commit/release identifier. Review schema and environment changes before upgrading, and do not overwrite `.env` with the example file.

For Compose, run commands in the original checkout. Allow a maintenance window: stop the web process and workers so the database and media can be captured consistently. The database must stay running for the manual backup:

```bash
docker compose stop caddy app export-worker communications-worker backup
./scripts/backup.sh /absolute/path/to/backup-disk
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app export-worker communications-worker backup
```

Substitute your backup directory. Copy that backup and the existing environment/secrets to secure off-server storage. If a backup or build fails, resolve it before proceeding; the stopped application remains unavailable. Migrations run automatically when the app starts. Repeat the login, upload, export, and health checks. Never run `db:seed:demo`, `db:reset`, or `prisma migrate dev` during an upgrade.

For non-Docker Node.js, stop all three supervised processes, back up the database and files, fetch the intended release, run `npm ci`, `npm run db:generate`, `NODE_ENV=production npx prisma migrate deploy`, and `NODE_ENV=production npm run build`. Repeat the standalone asset-copy commands, then restart the services and verify. Build failures may require rebuilding the previous release before restarting.

Returning to an old image or commit does not undo a database migration. A rollback must account for schema compatibility; if the old release cannot use the new schema, restore its matching database/files backup and secrets together. MySQL hosting packages need a separately planned schema upgrade: do not import the initial schema or initial data over an existing installation.

## Backups and recovery

The scheduled Compose backup stores a PostgreSQL dump, media archive, export archive, and SHA-256 manifest. Its first run targets the following calendar day at 02:00 in the backup container's time zone (UTC by default). It then repeats daily while running. Monitor `docker compose logs backup`; verify that new backup directories actually appear. Retention defaults to 30 days. This is a local backup until you copy it off-server.

`./scripts/backup.sh /path/to/destination` creates the same three data archives immediately but does not generate a checksum manifest or apply retention. Both backup methods need the database running and `data/media` and `data/exports` present. Stop the app and workers for a consistent database/files snapshot. Live scheduled backups do not pause writes.

To recover a Compose installation:

1. Keep an untouched copy of the selected backup. Use a backup of this deployment and its corresponding secrets. Test recovery on an isolated server before a real incident.
2. Ensure the target uses compatible application/PostgreSQL versions. Configure `.env`, preserve or restore its `PASSWORD_SECRET` and `SOCIAL_CREDENTIALS_KEY`, and start only the database with `docker compose up -d db`.
3. If the backup has `SHA256SUMS`, verify it. The scheduled manifest records container paths; on a Linux host, the following rewrites each entry to its basename before checking it:

   ```bash
   cd /absolute/path/to/selected-backup
   awk '{n=split($2,p,"/"); print $1 "  " p[n]}' SHA256SUMS | sha256sum -c -
   ```

4. Return to the repository root. Stop all writers and the backup process. Save a manual backup of the current state if recovering an existing installation. Move existing media/exports aside so extraction does not leave files from the failed deployment:

   ```bash
   cd /absolute/path/to/churchadmin
   docker compose stop caddy app export-worker communications-worker backup
   # For an existing installation, take a current-state backup before continuing.
   # Use a unique suffix; do not overwrite a previous recovery copy.
   mv data/media data/media.before-recovery
   mv data/exports data/exports.before-recovery
   ./scripts/restore.sh /absolute/path/to/selected-backup
   ```

   On a fresh server, omit each `mv` if that directory does not exist. The restore script replaces database objects and extracts files; it does not verify checksums or remove old files. It is not an atomic operation. Review its output and verify the database and archives before reopening access.

5. Start the matching application release with `docker compose up -d --build`. Repeat the health, login, media, and export checks. Keep the old directories until recovery is verified.

The archives do not contain the environment file or Caddy state. Losing the password-hashing secret prevents existing password hashes from validating; losing the social credential key prevents decrypting stored provider tokens. Keep those secrets securely backed up with the deployment's recovery information.

## MySQL shared hosting

Follow [SHARED_HOSTING.md](SHARED_HOSTING.md) for Node.js panel compatibility, package creation, SQL import, environment configuration, initial credentials, and limitations. It is a separate build with a MySQL Prisma client. Changing `DATABASE_URL` on a PostgreSQL build does not convert it to MySQL.

## Customization and sharing

Share the source repository and its example configuration, with each installer generating their own secrets and database. Do not share your working `.env`, database, media, backups, or generated installation credentials. Each generated MySQL package has its own initial church/password secret and temporary administrator; create a separate package per installation and transfer it privately.

Configure church identity, time zone, phone region, colors, and logos under **Apariencia** after signing in. Review `app/layout.tsx` if you also need to change the application title or metadata, and rebuild after changing source files.
