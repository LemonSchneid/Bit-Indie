# Operations Runbooks (MVP)

This document captures the operational runbooks for the Simple‑MVP (Nostr off). Nostr publisher/ingestion pipelines are disabled and will be documented post‑MVP.

## API Health

The FastAPI service exposes `/health`. Configure uptime checks against this endpoint.

Recommended basic telemetry:

- Request latency and error rate by route.
- Database connection pool saturation and slow queries.
- Storage (S3/R2) errors and presign latency.
- Structured logs stream as JSON and embed the correlation header (`X-Request-ID` by default). Use this identifier to stitch
  together reverse-proxy access logs, application traces, and payment provider webhooks. Override the header name via
  `REQUEST_ID_HEADER` when the edge terminates a different key.

## Purchase Flow Issues

Symptoms:

- Users cannot generate invoices.
- Invoices never transition to PAID.
- Download does not unlock after payment.

Runbook steps:

1. Validate payment provider env:
   - `LN_PROVIDER=opennode` and `OPENNODE_*` vars present and correct.
2. Inspect provider status page/logs; test issuing an invoice directly via provider API.
3. Check API logs around `POST /v1/games/:id/invoices` for validation errors.
4. If paid but not unlocked, verify webhook/polling logic for invoice status and DB `download_granted` updates.

## Storage & Downloads

- Ensure `S3_*` env is configured. Validate presign works by requesting a download URL.
- Watch for 403/404 errors from the object store; verify object ACLs and bucket/endpoint.

## Catalog Media Seeding

The MVP ships with curated cover, hero, and receipt art for seeded games. To upload the bundled assets to your storage bucket:

1. Configure the S3/MinIO variables (`S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`).
2. Run `python -m bit_indie_api.scripts.seed_media_assets` from `apps/api`. The script uploads the SVG assets in `apps/api/assets/media/` and updates the corresponding database rows with public URLs.
3. Execute `python -m bit_indie_api.scripts.seed_simple_mvp` afterward to ensure catalog metadata references the generated URLs.
4. Verify the uploads by visiting `/v1/games` and `/v1/purchases/:id/receipt` through the API or the web app.

## Moderation & Abuse

- Admin routes allow hide/unhide of comments and reviews.
- Consider rate limits for comment/review creation per IP/user.
