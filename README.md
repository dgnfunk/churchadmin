# ChurchAdmin

ChurchAdmin manages people, attendance, weekly service plans, media, branded exports, and ProPresenter 7 packages.

## Local development

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `PASSWORD_SECRET`, and `ATTENDEE_SESSION_SECRET`.
2. Run `npm install`.
3. Run `npx prisma migrate deploy` and `npm run db:seed:demo`.
4. Run `npm run dev` and open `http://localhost:3000`.

For development migrations, create a migration explicitly with:

```bash
npm run db:migrate -- --name describe_the_change
```

Uploaded media is private and stored under `MEDIA_STORAGE_PATH`. Large uploads use resumable TUS transfers and are validated from their file signature. Generated packages are stored under `EXPORT_STORAGE_PATH` and expire after seven days. The default media limit is 2 GB per file.

In local development, `EXPORT_WORKER_IN_APP=true` runs the export worker inside Next.js. In production, set it to `false` and run the independent process with `npm run worker:exports`; Docker Compose already does this. `/api/health` verifies PostgreSQL and both storage volumes.

Attendance provides Check-in, History, and Trends. Monthly reports show each service, while semester and annual reports aggregate by month. All periods use the church time zone and can be exported to CSV.

## Demo data

`npm run db:seed:demo` creates a complete, relative-to-today demonstration scenario for **Iglesia Comunidad de Gracia**:

- Ten completed weekly services covering more than two months and one published upcoming service.
- 24 members, 8 recurring visitors, ministry eligibility, primary assignments, and backups.
- Text-only service plans and a small reusable content library. No media records or binary files are created.
- Closed attendance sessions with varying member and visitor totals, plus an open session for the upcoming service.
- Accounts for an administrator, pastor, worship leader, and presenter.

The administrator signs in as `elena@grace.example`. Member accounts use `samuel@grace.example`, `marco@grace.example`, or `andres@grace.example`. Passwords come from `SEED_ADMIN_PASSWORD` and `SEED_MEMBER_PASSWORD`.

The demo seed is intentionally destructive only for the church with slug `grace-community`; running it again replaces that church's records so screenshots and demonstrations remain repeatable. It does not delete other churches. In a production container the ordinary `db:seed` command is blocked; use the explicit `db:seed:demo` command when rebuilding a demo instance.

## QR check-in and PWA

Each attendance session has a unique QR. On the first scan, a member identifies with an exact email or phone; a first-time visitor provides a name and contact. ChurchAdmin stores a separate 180-day attendee cookie so later service QR scans can check in automatically. This cookie cannot access the admin application and can be revoked with **Not me** or **Forget this device**.

The PWA requires HTTPS outside localhost. Set `PUBLIC_APP_URL` to the canonical HTTPS origin, `PUBLIC_HOST` to the matching DNS hostname, and `ATTENDEE_SESSION_SECRET` to a different random secret than `PASSWORD_SECRET`. Rotating `ATTENDEE_SESSION_SECRET` signs out every remembered attendee device. The PWA shell is installable, but attendance confirmation always requires a live connection to PostgreSQL.

## ProPresenter 7 Windows

Build a package from Services. Import each numbered TXT through **File > Import > File**, select `//` as the custom slide delimiter, apply the church Theme, and add the files to the playlist in manifest order. PNG preserves the exact ChurchAdmin design; PPTX is included as a complementary format and may import as images in ProPresenter 7 Windows.

## Production with Docker

Point a public DNS record at the server and set `POSTGRES_PASSWORD`, `PASSWORD_SECRET`, `ATTENDEE_SESSION_SECRET`, `PUBLIC_HOST`, `PUBLIC_APP_URL`, `SEED_ADMIN_PASSWORD`, and `SEED_MEMBER_PASSWORD` in `.env`, then run:

```bash
docker compose up -d --build
docker compose exec app npm run db:seed:demo
```

After seeding, open `https://$PUBLIC_HOST`, sign in with the configured administrator password, and verify `/api/health`. Re-running the second command resets the demo church, so do not use it after replacing the demonstration data with real operational records.

Caddy obtains and renews a public HTTPS certificate automatically. Ports 80 and 443 must reach the server and `PUBLIC_HOST` must resolve to it.

Docker creates a backup every day at 02:00 and retains 30 days. Set `BACKUP_STORAGE_PATH` to a separate disk or NAS path and configure `BACKUP_RETENTION_DAYS` when a different policy is required. Manual backups remain available with `./scripts/backup.sh`; restore a selected backup with `./scripts/restore.sh ./backups/<timestamp>` and verify `SHA256SUMS` first.

## Official communications

The `/communications` module uses the YouTube Data API and Meta Graph API. WhatsApp is limited to the official WhatsApp Business Platform Cloud API; it does not automate WhatsApp Web or ordinary groups.

1. Create a Meta Business app and add WhatsApp.
2. Configure `YOUTUBE_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `SOCIAL_CREDENTIALS_KEY`.
3. Register `https://YOUR_DOMAIN/api/integrations/whatsapp/webhook` for WhatsApp message and status webhooks.
4. Run `npx prisma migrate deploy` and `npm run worker:communications`.
5. In Communications > Connections, register the WABA ID, Phone Number ID, and a system-user access token.

Recipients must have `OPTED_IN` consent. Business-initiated WhatsApp campaigns require a template synchronized as `APPROVED` by Meta.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
