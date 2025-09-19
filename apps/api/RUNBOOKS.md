# Observability runbooks

This document captures the operational runbooks required for the launch-time
release note publisher and ingestion pipeline.

## Release note publisher failures

The FastAPI service emits the following telemetry when publishing release notes
via the `ReleaseNotePublisher` service:

* `nostr.publisher.publish.attempts` counter (tag `status`) — tracks the overall
  outcome for each publish attempt (`success`, `partial`, or `failed`).
* `nostr.publisher.publish.latency_ms` distribution — captures end-to-end
  latency for a publish attempt.
* `nostr.publisher.relay.success`/`nostr.publisher.relay.failures` counters
  keyed by `relay` — track per-relay success and failure rates.
* `nostr.publisher.relay.latency_ms` distribution — measures per-relay request
  latency and exposes status tags (`success`, `error`, `skipped`).
* `nostr.publisher.queue.backlog` gauge — records the depth of
  `release_note_publish_queue` rows after each attempt.

Runbook steps:

1. **Alert triggers** — alerts fire when
   `nostr.publisher.relay.failures` spikes or when the backlog gauge exceeds 25
   entries. Review the alert payload for the failing relay URLs.
2. **Inspect logs** — search application logs for `relay.publish.failed` or
   `relay.skip.backoff` entries to confirm if failures are transient (HTTP
   5xx/timeout) or due to repeated backoff.
3. **Check queue depth** — use `select count(*) from release_note_publish_queue`
   in the database to confirm how many jobs are outstanding and inspect the
   `last_error` column for context.
4. **Mitigation** —
   * For transient relay issues: allow backoff to continue and monitor for a
     backlog decrease.
   * For persistent failures on specific relays: temporarily remove the relay
     from `NOSTR_RELAYS` and redeploy, then requeue affected games with
     `update release_note_publish_queue set next_attempt_at = now()`.
   * For signing errors (very rare): rotate the platform signing key and
     redeploy.
5. **Resolution check** — confirm `nostr.publisher.relay.success` counts start
   increasing and the backlog gauge returns below the 25 threshold.

## Release note ingestion stalls

The ingestion worker exposes:

* `nostr.replies.ingestion.backlog` gauge — tracks queued ingestion jobs.
* `nostr.replies.ingestion.relay_success`/`relay_failures` counters — show per
  relay success/failure counts.
* `nostr.replies.ingestion.relay_latency_ms` distribution — provides per-relay
  latency with status tags.
* `nostr.replies.ingestion.failures` counter — includes tagged reasons such as
  `query` and `parse`.

Runbook steps:

1. **Alert triggers** — alerts fire when
   `nostr.replies.ingestion.backlog` exceeds 100 jobs or sustained
   `relay_failures` occur on all relays.
2. **Inspect worker logs** — search for
   `release_note_ingest.relay_failed` entries to identify relays returning
   errors, or `release_note_ingest.backlog_high` when the queue length is above
   threshold.
3. **Validate queue health** — query the ingestion queue implementation for
   stuck jobs and confirm shard workers are running (check process manager or
   container logs).
4. **Mitigation** —
   * Restart stalled workers to release locks on queue rows.
   * Temporarily reduce `total_shards` so a healthy worker can drain backlog.
   * Investigate parse failures (`nostr.replies.ingestion.failures` tagged with
     `parse`) for malformed relay events and consider filtering the offending
     relay until the payload normalises.
5. **Resolution check** — backlog gauge returns below 100 and
   `relay_success` counters increase.

## Zap ingestion anomalies

Zap receipt handlers emit `nostr.zaps.parse_errors` metrics tagged with the
`source` (`receipt` or `ledger`) and `reason` (for example `missing_amount`,
`invalid_signature`, or `unsupported_target`). These counters power alerts for
unexpected parsing spikes.

* Use logs (`zap.receipt.invalid` or `zap_ledger_parse_error`) to isolate the
  failing event IDs.
* For repeated invalid receipts from a specific integration, contact the
  partner to validate their payload format.
