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
- [Production with Docker](#production-with-docker)
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

## Production with Docker

The included stack runs PostgreSQL, the Next.js application, export and communications workers, daily backups, and Caddy HTTPS.

1. Point a public DNS record at the server.
2. Ensure inbound ports 80 and 443 reach the server.
3. Copy and edit the environment file:

   ```bash
   cp .env.example .env
   ```

4. Set at least `POSTGRES_PASSWORD`, `PASSWORD_SECRET`, `ATTENDEE_SESSION_SECRET`, `PUBLIC_HOST`, `PUBLIC_APP_URL`, `SEED_ADMIN_PASSWORD`, and `SEED_MEMBER_PASSWORD`.
5. Start the stack:

   ```bash
   docker compose up -d --build
   ```

6. For a new demonstration installation only, seed the demo church:

   ```bash
   docker compose exec app npm run db:seed:demo
   ```

7. Open `https://YOUR_PUBLIC_HOST`, sign in, and verify `https://YOUR_PUBLIC_HOST/api/health`.

Caddy obtains and renews the TLS certificate. The app container automatically applies pending Prisma migrations when it starts. Docker Compose disables in-process workers and runs dedicated `export-worker` and `communications-worker` services instead.

## Workers, storage, and backups

### Dedicated workers

When workers are not running inside the web process, start them separately:

```bash
npm run worker:exports
npm run worker:communications
```

Both processes poll for work every three seconds. Do not run duplicate worker modes accidentally: set the corresponding `*_WORKER_IN_APP` variable to `false` when using a dedicated process.

### Backups

The Docker backup service runs every day at 02:00 server time. Each backup contains:

- A PostgreSQL dump.
- Uploaded media.
- Generated exports.
- SHA-256 checksums.

Manual backup and restore:

```bash
./scripts/backup.sh
./scripts/restore.sh ./backups/YYYYMMDD-HHMMSS
```

Restoring replaces database objects and stored files. Verify the chosen backup and its checksums before restoring, and stop writes to the application during recovery.

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
