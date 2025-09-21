# Operations Runbooks (MVP)

This document captures the operational runbooks for the Simple‑MVP (Nostr off). Nostr publisher/ingestion pipelines are disabled and will be documented post‑MVP.

## API Health

The FastAPI service exposes `/health`. Configure uptime checks against this endpoint.

Recommended basic telemetry:

- Request latency and error rate by route.
- Database connection pool saturation and slow queries.
- Storage (S3/R2) errors and presign latency.

## Purchase Flow Issues

Symptoms:

- Users cannot generate invoices.
- Invoices never transition to PAID.
- Download does not unlock after payment.

Runbook steps:

1. Validate payment provider env:
   - `LN_PROVIDER=lnbits` and `LNBITS_*` vars present and correct.
2. Inspect provider status page/logs; test issuing an invoice directly via provider API.
3. Check API logs around `POST /v1/games/:id/invoices` for validation errors.
4. If paid but not unlocked, verify webhook/polling logic for invoice status and DB `download_granted` updates.

## Storage & Downloads

- Ensure `S3_*` env is configured. Validate presign works by requesting a download URL.
- Watch for 403/404 errors from the object store; verify object ACLs and bucket/endpoint.

## Moderation & Abuse

- Admin routes allow hide/unhide of comments and reviews.
- Consider rate limits for comment/review creation per IP/user.
