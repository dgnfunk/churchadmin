# ChurchAdmin

ChurchAdmin is a Spanish-language church operations platform for managing people, attendance, weekly services, volunteer assignments, media, presentation exports, and official communications.

It is built with Next.js, React, Prisma, and PostgreSQL. The application includes role-based access, QR check-in, an installable PWA shell, background workers, and a Docker production stack with HTTPS and backups.

## Contents

- [What the app manages](#what-the-app-manages)
- [How to navigate the app](#how-to-navigate-the-app)
- [Recommended first-time workflow](#recommended-first-time-workflow)
- [Local development](#local-development)
- [Demo accounts and data](#demo-accounts-and-data)
- [Environment variables](#environment-variables)
- [Core workflows](#core-workflows)
- [Permissions and access](#permissions-and-access)
- [Choosing a production host](#choosing-a-production-host)
- [Production with Docker](#production-with-docker)
- [Production without Docker](#production-without-docker)
- [Workers, storage, and backups](#workers-storage-and-backups)
- [Communications integrations](#communications-integrations)
- [ProPresenter 7 exports](#propresenter-7-exports)
- [Useful commands](#useful-commands)
- [Troubleshooting](#troubleshooting)

## What the app manages

- Members, visitors, contact details, tags, follow-up status, and CSV import/export.
- Weekly service plans, service content, team positions, assignments, and volunteer responses.
- Attendance sessions, QR and manual check-in, history, trends, and CSV reports.
- Media uploads with resumable transfers, file-signature validation, and duplicate detection.
- Branded slide themes and service packages containing PNG, PPTX, TXT, PDF, and manifest files.
- Ministry roles, permanent permissions, assignment-scoped permissions, and reusable position templates.
- User accounts, temporary passwords, session revocation, and self-service password changes.
- Official WhatsApp, Facebook, and Instagram communication campaigns with templates, audiences, consent, scheduling, and approval.

## How to navigate the app

The interface is in Spanish. On desktop, use the left sidebar. On mobile, open the same navigation with the menu button in the top-left corner. Items are hidden when the signed-in user does not have the required permission.

| UI label | Route | Purpose |
| --- | --- | --- |
| **Inicio** | `/` | Dashboard for the next service, team readiness, attendance, and pending work. |
| **Servicios** | `/services` | View the calendar, service list, or **Mis servicios**; create and manage service plans. |
| **Asistencia** | `/attendance` | Open check-in, review history, view trends, and export attendance reports. |
| **Personas** | `/people` | Search, add, update, import, and export members and visitors. |
| **Multimedia** | `/media` | Search uploaded media, preview files, and reuse assets in another service item. |
| **Comunicaciones** | `/communications` | Manage the editorial calendar, campaigns, templates, audiences, consent, and social connections. |
| **Ministerios** | `/ministry` | Define ministry roles, member eligibility, permissions, and recurring position templates. |
| **Usuarios** | `/users` | Create and manage login accounts, reset passwords, and revoke sessions. |
| **Apariencia** | `/theme` | Configure church identity, time zone, phone region, colors, logos, and slide themes. |
| **Mi cuenta** | `/account` | Review the current profile and change the account password. |

### Service workspace

Opening a service displays five tabs:

| Tab | Use |
| --- | --- |
| **Resumen** | Review service status, content duration, staffing, attendance, and export readiness. |
| **Equipo** | Apply position templates, assign primary and backup volunteers, review proposals, and track confirmations. |
| **Contenido** | Add songs, scripture, announcements, prayers, sermon notes, custom text, and media. Reuse saved library content and arrange the service order. |
| **Asistencia** | Create or open the attendance session associated with the service. |
| **Exportaciones** | Queue and download run sheets, text packs, slide archives, and ProPresenter packages. |

### Attendance workspace

- **Check-in** opens or closes a session, displays its QR and manual code, registers existing people, and creates new visitors.
- **Historial** lists past sessions with member, visitor, QR, and manual totals.
- **Tendencias** reports monthly, semester, or annual attendance in the church time zone and exports CSV.

### Communications workspace

- **Calendario** shows scheduled campaigns.
- **Campañas** creates, edits, schedules, approves, cancels, and reviews delivery results.
- **Plantillas** manages reusable channel content and WhatsApp templates submitted to Meta.
- **Audiencias** creates reusable segments and records WhatsApp consent.
- **Conexiones** stores encrypted credentials for official provider accounts.

## Recommended first-time workflow

After signing in as an administrator:

1. Open **Apariencia** and confirm the church name, time zone, phone region, colors, logo, and slide settings.
2. Open **Ministerios > Cargos** and create the operational roles used by the church.
3. Open **Ministerios > Miembros** and mark which members are eligible for each role.
4. Open **Ministerios > Plantillas de puestos** and create the positions normally needed each week.
5. Import or create the congregation in **Personas**.
6. Create login accounts in **Usuarios** and link each member account to the corresponding person.
7. Create the next event in **Servicios**, prepare its content, assign the team, and publish it.
8. Create an attendance session from the service, display the QR, and close the session after the event.
9. Use **Exportaciones** to prepare presentation and run-sheet files.
10. Configure **Comunicaciones** only after the required provider credentials and consent process are ready.

## Local development

### Requirements

- Node.js 20.9 or newer. The Docker image uses Node.js 22.
- npm.
- PostgreSQL with a database and user available to the application.

### Setup

```bash
git clone https://github.com/dgnfunk/churchadmin.git
cd churchadmin
npm ci
cp .env.example .env
```

Edit `.env` before continuing. At minimum:

- Make `DATABASE_URL` match the local PostgreSQL database.
- Replace `PASSWORD_SECRET` and `ATTENDEE_SESSION_SECRET` with different random values.
- Set `SEED_ADMIN_PASSWORD` and `SEED_MEMBER_PASSWORD` to passwords you will use for the demo accounts.
- Use `PUBLIC_APP_URL=http://localhost:3000` for local development.

Generate secrets with a password manager or a command such as:

```bash
openssl rand -hex 32
```

Prepare and seed the database:

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed:demo
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a demo account.

> Never commit `.env`. It is ignored by Git and must remain local to each environment.

## Demo accounts and data

`npm run db:seed:demo` creates a relative-to-today demonstration church named **Iglesia Comunidad de Gracia** with:

- 10 completed services and one upcoming published service.
- 24 members and 8 recurring visitors.
- Ministry roles, member eligibility, service positions, and assignments.
- Attendance history and an open session for the upcoming service.
- Sample service content and communication data without binary media.

| Account | Email | Password source |
| --- | --- | --- |
| Administrator | `elena@grace.example` | `SEED_ADMIN_PASSWORD` |
| Pastor | `samuel@grace.example` | `SEED_MEMBER_PASSWORD` |
| Worship member | `marco@grace.example` | `SEED_MEMBER_PASSWORD` |
| Presenter | `andres@grace.example` | `SEED_MEMBER_PASSWORD` |

The seed is destructive only for the church whose slug is `grace-community`: running it again replaces that demo church and its related records. It does not delete other churches. Do not rerun it after replacing the demo data with real information.

Production seeding is blocked unless the explicit `db:seed:demo` command is used and both seed passwords are configured.

## Environment variables

Start from `.env.example`. Empty integration values may remain empty when the related feature is not used.

### Database, identity, and security

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes outside Docker Compose | Prisma connection URL. The main schema uses PostgreSQL. |
| `POSTGRES_PASSWORD` | Yes with Docker Compose | Password used by the Compose PostgreSQL service and all application containers. |
| `CHURCH_SLUG` | Yes | Selects the church used for login, branding, public check-in, and app state. The demo slug is `grace-community`. |
| `PASSWORD_SECRET` | Yes | Server-side secret added to password hashing. Use a long random value. Changing it invalidates existing password hashes, so accounts must be reset or reseeded. |
| `ATTENDEE_SESSION_SECRET` | Yes in production | Signs remembered attendee identities. It must differ from `PASSWORD_SECRET`. Rotating it forgets attendee devices. |
| `PUBLIC_APP_URL` | Yes in production | Canonical origin used in QR codes and communication links, for example `https://church.example.com`. HTTPS is required in production. |
| `PUBLIC_HOST` | Docker production | Hostname used by Caddy, without the protocol. DNS must point to the server. |

### Demo seed

| Variable | Required | Description |
| --- | --- | --- |
| `SEED_ADMIN_PASSWORD` | Demo seed | Password assigned to the demo administrator. |
| `SEED_MEMBER_PASSWORD` | Demo seed | Shared password assigned to demo member accounts. |

### Storage and workers

| Variable | Default | Description |
| --- | --- | --- |
| `MEDIA_STORAGE_PATH` | `./.tmp/media` | Private uploaded-media directory. It must be writable and persistent in production. |
| `EXPORT_STORAGE_PATH` | `./.tmp/exports` | Generated export directory. Completed exports expire after seven days. |
| `MAX_MEDIA_BYTES` | `2147483648` | Maximum uploaded file size in bytes; the example value is 2 GiB. |
| `BACKUP_STORAGE_PATH` | `./backups` | Docker backup destination. Prefer a separate disk or NAS. |
| `BACKUP_RETENTION_DAYS` | `30` | Number of days Docker backups are retained. |
| `EXPORT_WORKER_IN_APP` | `true` | Runs export jobs inside the web process. Use `true` for simple local development and `false` when a dedicated worker is running. |
| `COMMUNICATIONS_WORKER_IN_APP` | `true` | Runs communication deliveries inside the web process. Use `false` when a dedicated worker is running. |

### Communications

| Variable | Required for | Description |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | YouTube campaign creation | Reads and validates public YouTube video metadata. |
| `META_APP_ID` | Meta integrations | Meta application identifier. |
| `META_APP_SECRET` | Meta integrations and webhooks | Validates Meta webhook signatures and supports official API operations. |
| `META_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook setup | Private verification token entered in both Meta and ChurchAdmin. |
| `META_GRAPH_API_VERSION` | Meta integrations | Graph API version; the current default is `v25.0`. |
| `SOCIAL_CREDENTIALS_KEY` | Saving social connections | At least 32 characters. Encrypts provider access tokens stored in the database. Rotating it requires reconnecting saved accounts. |
| `SMTP_HOST` | Operational email | SMTP server hostname. Leave empty to disable email notifications. |
| `SMTP_PORT` | Operational email | SMTP port; defaults to `587`. |
| `SMTP_USER` | Authenticated SMTP | SMTP username. |
| `SMTP_PASSWORD` | Authenticated SMTP | SMTP password. |
| `SMTP_FROM` | Operational email | Sender address. Email is disabled when either `SMTP_HOST` or `SMTP_FROM` is empty. |

## Core workflows

### Service lifecycle

1. Create a service in **Servicios**. New services begin as **Borrador** (`DRAFT`).
2. Add the normal positions from ministry templates and assign eligible primary or backup volunteers.
3. Add service content, media, notes, durations, and export tags.
4. Publish the service. Confirmed primary assignments can now grant their service-scoped permissions.
5. Create and operate attendance, then generate the required exports.
6. Mark the service complete. Completion immediately revokes assignment-scoped permissions.

Services may also be cancelled from draft or published status.

### QR check-in and PWA

Each attendance session has a unique public QR URL and manual code.

- On a first QR scan, a member identifies with an exact email or phone number. A new visitor can provide a name and contact.
- The attendee can choose to remain recognized on that device for 180 days.
- The attendee cookie is separate from administrative login and cannot access the private application.
- **No soy yo** or **Olvidar este dispositivo** removes the remembered identity.
- The PWA shell can be installed, but submitting attendance still requires a live database connection.

Outside localhost, QR check-in and PWA features require HTTPS and the correct `PUBLIC_APP_URL`.

### Media

Supported uploads include MP4, QuickTime, WebM, MP3, WAV, M4A/MP4 audio, PNG, JPEG, and WebP. The server validates file contents rather than trusting the filename. Large service-media uploads use resumable TUS transfers.

Media is private and served through authenticated application routes. Persist `MEDIA_STORAGE_PATH`; database backups alone do not contain the uploaded files.

## Permissions and access

Administrators can access every module. Member accounts receive access through ministry roles:

- **Permanent permissions** are active whenever the member has that ministry role.
- **Service permissions** become active only for a confirmed primary assignment on a published service.
- Backup assignments do not grant the role's service permissions.
- Completing or cancelling the service revokes temporary access.

This allows, for example, a presenter to export one assigned service without receiving permanent access to every service or administrative module.

## Choosing a production host

ChurchAdmin needs a running backend, a database, and persistent file storage. It cannot run on every hosting plan.

| Hosting capability | Deployment path |
| --- | --- |
| Linux server with Docker Compose and control over ports 80/443 | Use [Production with Docker](#production-with-docker). This is the most complete included stack. |
| Always-on Node.js process, PostgreSQL, persistent disk, and an HTTPS proxy | Use [Production without Docker](#production-without-docker). Manage restarts, workers, and backups yourself. |
| Shared hosting with Node.js, MySQL 8, persistent disk, and HTTPS | Use the [MySQL package guide](deployment/SHARED_HOSTING.md). Confirm runtime and native dependency compatibility first. |
| PHP-only, WordPress-only, or static file hosting | Cannot run the ChurchAdmin backend. |
| Serverless functions, temporary disk, or processes that sleep when idle | Requires infrastructure/code changes for persistent media and reliable background jobs. There is no complete deployment recipe for this configuration in this repository. |

Start with one web instance and one worker per queue on one server. Multiple web instances require additional coordination and shared storage; this guide does not configure that topology. Each church should use its own deployment, database, secrets, and storage.

## Production with Docker

The included stack runs PostgreSQL 16, the Next.js application, dedicated export and communications workers, scheduled backups, and Caddy HTTPS. Run the following commands on the server, from the repository root. For updates, recovery, proxy settings, and managed Node.js hosting, see the [production deployment guide](deployment/PRODUCTION.md).

### 1. Prepare the server and domain

Use a Linux server with Git, Docker Engine, and the Docker Compose v2 plugin installed. Confirm `docker --version` and `docker compose version` work for the deployment user. Ensure enough disk space for the database, uploads, exports, backups, and image builds; storage and memory needs depend on your media and export workload.

Point the domain's DNS A record at the server's public IPv4 address. Only add an AAAA record if IPv6 also reaches this server. Allow inbound TCP ports 80 and 443 through the server and hosting-provider firewalls. These ports must be available for Caddy. Keep database port 5432 and application port 3000 private; Compose does not publish them.

```bash
git clone https://github.com/dgnfunk/churchadmin.git
cd churchadmin
cp .env.example .env
chmod 600 .env
```

### 2. Configure this installation

Edit `.env` with a text editor. Set:

- `PUBLIC_HOST=admin.your-church.example` (hostname only) and `PUBLIC_APP_URL=https://admin.your-church.example` (HTTPS origin, no path suffix).
- `POSTGRES_PASSWORD`, `PASSWORD_SECRET`, and `ATTENDEE_SESSION_SECRET` to different random values. Run `openssl rand -hex 32` separately for each. Hex avoids database URL escaping issues.
- `CHURCH_SLUG=grace-community` if using the included demo initializer below. Setting a different slug does not create a church.
- `SEED_ADMIN_PASSWORD` and `SEED_MEMBER_PASSWORD` to strong, different passwords if initializing the demo.
- `SOCIAL_CREDENTIALS_KEY` to a separate random value if saving social accounts.
- `BACKUP_STORAGE_PATH` to a persistent backup directory, preferably on a separate disk. Keep an off-server copy as well.

Compose supplies its own internal `DATABASE_URL` and storage paths; the localhost URL and worker flags in `.env` do not override those container settings. Set SMTP values if using email. Never share your real `.env` with other installers.

### 3. Build and start

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app export-worker communications-worker caddy
```

The app applies committed Prisma migrations before starting. Workers wait for the app's health check before starting. Caddy obtains and renews the TLS certificate when DNS and ports are correct. The first build and startup can take several minutes.

### 4. Initialize the church and first login

**Current PostgreSQL limitation:** migrations create tables, but there is no clean production church/admin initializer or signup screen. The included initializer creates the demonstration church, sample congregation, and demo accounts. Use it only in a fresh database for evaluation:

```bash
docker compose exec app npm run db:seed:demo
```

Open `https://YOUR_PUBLIC_HOST/login`, sign in as `elena@grace.example` with `SEED_ADMIN_PASSWORD`, then follow the [first-time workflow](#recommended-first-time-workflow).

For a real congregation starting with no sample data, the [MySQL hosting package](deployment/SHARED_HOSTING.md) already generates a clean church and temporary administrator. The standard PostgreSQL path needs a separate production initializer before it can offer the same experience. Do not treat the demo seed as a production provisioning or upgrade command; rerunning it deletes and recreates the demo church's records.

### 5. Verify before handing over

```bash
curl --fail --show-error https://YOUR_PUBLIC_HOST/api/health
```

Expect HTTP 200 and `{"status":"ok"}`. This checks database connectivity and storage access, but not church initialization or worker delivery. Also sign in at `/login`, create a service, upload a small media file, and queue/download an export. Confirm the file remains after restarting the app. If configured, test a controlled communications delivery and its operational email notifications. Complete and copy a backup off-server, and test recovery in an isolated installation.

## Production without Docker

Docker is optional. The host must still support a persistent Node.js application, a compatible database, HTTPS, and writable storage that survives deployments. Choose the path that matches your database:

- **Node.js + PostgreSQL:** deploy from the source repository using Option A below.
- **Node.js + MySQL 8:** use the prepared hosting package in Option B below, including when the hosting panel has no SSH access.
- **PHP/WordPress/static hosting without Node.js:** the full application cannot run on that plan. Ask the provider whether an always-on Node.js application is available.

### Option A: Node.js hosting with PostgreSQL

#### 1. Confirm the hosting requirements

Use Node.js 22 and npm. Confirm that the provider lets you run a persistent web process, set environment variables, connect a domain with HTTPS, and keep private uploaded files on persistent storage. If using SSH, check:

```bash
node --version
npm --version
```

The application must restart after failures and server reboots. For a managed hosting panel, confirm that it offers an application start/restart control. For a server you administer, use the [systemd service example](deployment/PRODUCTION.md#run-and-supervise-processes).

#### 2. Install the source and create a database

Run these commands in the directory assigned to your Node.js application:

```bash
git clone https://github.com/dgnfunk/churchadmin.git
cd churchadmin
npm ci
cp .env.example .env
chmod 600 .env
mkdir -p storage/media storage/exports
```

Create an empty PostgreSQL database and a user with permission to create and update its tables, using the hosting panel or database administrator. Keep the connection URL for the next step. Install/build on the target platform so Prisma and Sharp use compatible native dependencies.

#### 3. Set environment variables

Edit `.env`, or enter its values in the hosting panel's environment manager. At minimum, configure:

| Variable | Value for this deployment |
| --- | --- |
| `DATABASE_URL` | Your PostgreSQL connection URL, with TLS settings if required by the database host. |
| `PUBLIC_APP_URL` | Your public HTTPS origin, for example `https://admin.your-church.example`, without a path suffix. |
| `PASSWORD_SECRET` | A new random value; generate with `openssl rand -hex 32`. |
| `ATTENDEE_SESSION_SECRET` | A different random value, generated separately. |
| `CHURCH_SLUG` | The existing church's slug, or `grace-community` for the fresh demo installation below. |
| `MEDIA_STORAGE_PATH` | An absolute persistent directory, such as `/srv/churchadmin/storage/media`. Replace this with your actual application/storage directory. |
| `EXPORT_STORAGE_PATH` | An absolute persistent directory, such as `/srv/churchadmin/storage/exports`. |
| `EXPORT_WORKER_IN_APP` | `true` for a single persistent web process. |
| `COMMUNICATIONS_WORKER_IN_APP` | `true` for a single persistent web process. |

Give the application user read/write access to both storage directories. Keep them outside disposable release directories. Configure optional SMTP and social integration settings as needed. `PUBLIC_HOST`, `POSTGRES_PASSWORD`, and the automatic backup service belong to the Compose setup and are not used by this path.

#### 4. Apply migrations and build

```bash
npm run db:generate
NODE_ENV=production npx prisma migrate deploy
NODE_ENV=production npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

The asset-copy commands are required by the standalone server. Keep the full checkout and dependencies for future migrations and maintenance. Supply the required environment to both build and runtime.

#### 5. Prepare the first account

Migrations create tables, but **the PostgreSQL path currently has no clean church/admin setup command**. For a fresh evaluation database only, set `SEED_ADMIN_PASSWORD` and `SEED_MEMBER_PASSWORD`, keep `CHURCH_SLUG=grace-community`, and run:

```bash
NODE_ENV=production npm run db:seed:demo
```

This creates sample data and demo accounts. Never run it on an installation containing real congregation data. For an empty production church, a separate initializer is still needed; the MySQL package in Option B already provides clean initial records.

#### 6. Configure the application startup and HTTPS

For an SSH-managed server, the web command from the repository root is:

```bash
NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3000 node --env-file=.env .next/standalone/server.js
```

Configure that command under a process supervisor using your application's working directory; running it in a terminal is only a startup check. Route the domain's HTTPS reverse proxy to `127.0.0.1:3000`, preserve the public host/forwarded HTTPS headers, and keep port 3000 private.

For a managed Node.js panel, set the startup file to `.next/standalone/server.js`, configure `NODE_ENV=production`, and enter the variables from step 3 in the panel. Use the panel's assigned `PORT` and network binding requirements. A startup filename alone does not apply the `--env-file` flag, so configure the process environment explicitly. See the [hosting-panel checklist](deployment/PRODUCTION.md#managed-nodejs-panel-checklist) for the settings to confirm.

With both in-app worker flags set to `true`, no separate worker commands are needed. Keep the web process running continuously so jobs can execute. If the provider supports dedicated worker processes, use the [worker setup](deployment/PRODUCTION.md#run-and-supervise-processes) and set those flags to `false`.

#### 7. Verify and configure backups

Open `https://YOUR_DOMAIN/api/health` and expect HTTP 200 with `{"status":"ok"}`. Sign in at `https://YOUR_DOMAIN/login`; for the demo, use `elena@grace.example` with `SEED_ADMIN_PASSWORD`. Test a media upload and an export, then restart the application and confirm the uploaded file remains available.

Schedule PostgreSQL backups through your database provider or server tools, back up both storage directories, and securely back up the environment/secrets separately. Keep an off-server copy and test restoration. The repository's Docker backup/restore scripts do not apply to this deployment. Follow the [update procedure](deployment/PRODUCTION.md#updating-an-existing-installation) for later releases.

### Option B: Node.js hosting with MySQL, including panels without SSH

1. Confirm the hosting panel supports persistent Node.js 22, MySQL 8, HTTPS, environment variables, and writable persistent storage. The package currently targets Linux x64/glibc with compatible Prisma/OpenSSL libraries; check the [compatibility requirements](deployment/SHARED_HOSTING.md).
2. On the computer preparing the package, run `npm ci`, then generate a separate package for the installation:

   ```bash
   PACKAGE_CHURCH_NAME="My Church" \
   PACKAGE_CHURCH_SLUG="my-church" \
   PACKAGE_ADMIN_EMAIL="admin@your-church.example" \
   npm run package:mysql
   ```

3. Transfer `dist-hosting/churchadmin-mysql.zip` privately and extract it into the panel's Node.js application directory. Create a new empty MySQL database and import `mysql-schema.sql`, followed by `mysql-initial-data.sql`, using phpMyAdmin or the panel's database tool.
4. Set the startup file to `server.js` and `NODE_ENV=production`. Copy the package's `.env.example` values into the panel's environment manager, replacing `DATABASE_URL` and `PUBLIC_APP_URL`. Preserve the generated `PASSWORD_SECRET` and `CHURCH_SLUG`, which match the initial account and church records. Keep `storage/media` and `storage/exports` writable and persistent. Start/restart the application through the panel and enable HTTPS for its domain.
5. Open `/login`, use the temporary credentials in `INSTALLATION-CREDENTIALS.txt`, and change the password when prompted. Remove that credentials file from the hosting and working copies. Verify `/api/health`, an upload, an export, and persistence after restart. Configure MySQL/file backups through the hosting provider.

The [complete shared-hosting guide](deployment/SHARED_HOSTING.md) includes compatibility checks, installation details, backup requirements, and update limitations. The PostgreSQL migrations cannot be applied to the MySQL package. PHP and MySQL support without Node.js is insufficient.

## Workers, storage, and backups

### Dedicated workers

When workers are not running inside the web process, start them separately:

```bash
npm run worker:exports
npm run worker:communications
```

Both processes poll for work every three seconds. Do not run duplicate worker modes accidentally: set the corresponding `*_WORKER_IN_APP` variable to `false` when using a dedicated process.

Outside Docker, worker commands do not automatically load `.env` through Next.js. Export their environment through your process manager, or use the explicit Node.js 22 environment-loading commands in the [deployment guide](deployment/PRODUCTION.md#nodejs-without-docker).

### Backups

The Docker backup service targets 02:00 in the backup container's time zone (UTC by default), beginning on the next calendar day after startup. Each scheduled backup contains:

- A PostgreSQL dump.
- Uploaded media.
- Generated exports.
- SHA-256 checksums.

Manual backup (run from the repository root):

```bash
./scripts/backup.sh
```

The manual script defaults to `./backups`, independently of `BACKUP_STORAGE_PATH`; pass a destination as its first argument to use another directory. Manual backups do not generate checksums. These scripts and the scheduled backup service are for Docker/PostgreSQL only.

`restore.sh` replaces database objects and extracts file archives over the current directories; it does not remove extra files or verify checksums. Follow the [backup and recovery procedure](deployment/PRODUCTION.md#backups-and-recovery) to stop all writers and move existing media/exports aside before restoring. Keep the deployment's secrets in a secure separate backup: they are not included in the database/media archives.

## Communications integrations

ChurchAdmin uses official provider APIs only. It does not automate WhatsApp Web or ordinary WhatsApp groups.

For WhatsApp:

1. Create a Meta Business app and add the WhatsApp product.
2. Set `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `SOCIAL_CREDENTIALS_KEY`.
3. Register `https://YOUR_DOMAIN/api/integrations/whatsapp/webhook` in Meta.
4. In **Comunicaciones > Conexiones**, save the WABA ID, Phone Number ID, and system-user access token.
5. Create a WhatsApp template and submit it to Meta.
6. Wait until the template is synchronized as **Aprobada**.
7. Record explicit **Autorizado** (`OPTED_IN`) consent for recipients before sending campaigns.

Business-initiated WhatsApp campaigns require an approved template. Facebook and Instagram publishing also require an appropriate connected Meta account and permissions.

To create campaigns from YouTube links, configure `YOUTUBE_API_KEY`. To receive operational failure notifications, configure SMTP.

## ProPresenter 7 exports

The ProPresenter package is a ZIP containing:

- Editable numbered TXT files using `//` as the slide delimiter.
- Rendered PNG slides that preserve the exact ChurchAdmin design.
- PPTX files as a visual alternative.
- Theme backgrounds and previews.
- `run-sheet.pdf` and `text-pack.pdf`.
- JSON and CSV manifests describing order, resolution, and theme use.

For ProPresenter 7 on Windows:

1. Import the numbered TXT files through **File > Import > File**.
2. Select `//` as the custom slide delimiter.
3. Apply the theme named in `manifest.csv`.
4. Add the imported files to the playlist in manifest order.

PNG is the most faithful visual output. ProPresenter may import PPTX pages as images. ChurchAdmin does not generate proprietary ProPresenter Theme files.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production Next.js build. |
| `npm run start` | Start a previously built production server. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate -- --name describe_the_change` | Create and apply a development migration. |
| `npx prisma migrate deploy` | Apply committed migrations without creating new ones. |
| `npm run db:seed:demo` | Replace the demo church with fresh sample data. |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run storage:cleanup` | Remove expired generated exports. |
| `npm run db:mysql:schema` | Regenerate the optional MySQL schema artifacts. |
| `npm run package:mysql` | Build the optional managed-hosting MySQL package. |
| `npm run typecheck` | Run TypeScript checking. |
| `npm run lint` | Run ESLint with zero warnings allowed. |
| `npm test` | Run the Vitest test suite. |

## Troubleshooting

### The app says the church configuration was not found

Apply migrations, run the demo seed for a new installation, and confirm that `CHURCH_SLUG` matches a church record.

### Demo login does not work

Use the password currently set in `SEED_ADMIN_PASSWORD` or `SEED_MEMBER_PASSWORD`. If the demo was seeded with different values, update the environment and reseed. Do not change `PASSWORD_SECRET` after creating real accounts unless you are prepared to reset every password.

### QR codes point to localhost or the wrong domain

Set `PUBLIC_APP_URL` to the exact public HTTPS origin and restart the application. `PUBLIC_HOST` configures Caddy; `PUBLIC_APP_URL` configures links generated by the app.

### Exports stay pending

For local development, set `EXPORT_WORKER_IN_APP=true`. For a dedicated worker, set it to `false` and run `npm run worker:exports`. Confirm that `EXPORT_STORAGE_PATH` is writable.

### Campaigns do not publish

Confirm that the communications worker is running, the provider connection is active, credentials can still be decrypted, the campaign has been approved when required, and WhatsApp recipients have opted in.

### Uploaded files disappear after a deployment

The database stores metadata, not the binary file. Mount persistent storage at `MEDIA_STORAGE_PATH` and keep that storage in the backup plan.

### Docker Compose reports that `POSTGRES_PASSWORD` is required

Add a strong `POSTGRES_PASSWORD` to `.env`. The Compose stack intentionally has no default database password.

## Verification before contributing

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Keep `.env`, database files, uploaded media, generated exports, backups, and packaged distributions out of Git.
