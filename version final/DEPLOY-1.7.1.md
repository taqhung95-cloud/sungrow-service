# Deployment 1.7.1 — resilient synchronization

This release supersedes 1.7.0.

1. Replace `Code.gs` and `LegacyDashboardApi.gs` in the existing Apps Script
   project, save, and update the existing web-app deployment without changing
   its URL.
2. Run `warmPortalReadCache` once in the Apps Script editor. Confirm the returned
   version is `1.7.1-resilient-sync`.
3. Reload the GitHub Pages application after Pages publishes cache key 62.

The case list now loads only cases, work-order summaries and transfers. Detailed
issue, spare-part and SLA-hold tables are loaded only for explicit operational
searches. During a new-revision cache build, concurrent requests receive the
last valid snapshot immediately instead of waiting or failing. If the refresh
fails transiently, the last valid snapshot remains available and later revision
polls retry automatically.

No database reset, reconciliation or deletion is required.
