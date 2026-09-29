# Deployment 1.7.0 — shared read cache and concurrent access

## Required deployment

1. Replace both `Code.gs` and `LegacyDashboardApi.gs` in the existing Apps
   Script project.
2. Save, then update the existing web-app deployment to a new version while
   keeping the current deployment URL.
3. In the Apps Script editor, select and run `warmPortalReadCache` once. The
   expected result contains version `1.7.0-shared-read-cache`, six table counts,
   a revision, and `elapsedMs`. It contains no customer data.
4. Reload the GitHub Pages application after its deployment completes.

## What changed

- Operational tables are cached once per database revision and shared by users
  with authorization applied after the cache read.
- A short cache-building lease prevents simultaneous requests from reading the
  same Google Sheet tab repeatedly. Sheet I/O does not hold the write lock.
- Cached tables use a compact header-plus-matrix representation and chunking to
  remain below Apps Script CacheService item limits.
- Authentication results are cached for five minutes instead of thirty seconds.
- Dashboard responses are shared between users with the same role and center
  scope; the current actor identity is restored after a cache hit.
- The case list automatically retries transient failures after 3, 7, 15, and 30
  seconds and remains usable with the last in-memory result.
- Frontend polling remains staggered and full dashboard refresh stays suspended
  while the data-entry portal is active.

## Acceptance test

Open ten signed-in browser sessions. First confirm all sessions can load the case
list, change pages and search without reloading the whole page. Then create one
controlled test case and verify that all sessions see the revision change. Run
one cancellation test only with a disposable case and confirm it disappears from
both lists. Review Apps Script Executions for failures and compare elapsed times
before and after the cache is warm.

Local automated tests verify syntax, role boundaries, cache chunk integrity,
single Sheet read across ten same-revision requests, contention hand-off, stale
revision detection, creation idempotency, and upload lock isolation. This is not
a substitute for the ten-session production acceptance test.
