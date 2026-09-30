# Deployment 1.10.0 — case index and historical integrity

This release fixes the slow case-list cold start and preserves warranty and
spare-part facts from the 2024/2025/2026 source tabs.

1. Replace `Code.gs` and `LegacyDashboardApi.gs` in the existing Apps Script
   project, save, and update the existing web-app deployment without changing
   its URL.
2. Run `auditHistoricalWarrantyData`. This is read-only. Review the returned
   `mismatches` and `skipped` counts.
3. Run `repairHistoricalWarrantyData`. It only repairs imported historical
   cases that have not subsequently been edited by a user. It also repairs the
   matching `Warranty confirmation` value in `Dữ liệu dashboard`.
4. Run `rebuildPortalCaseIndex` once. Confirm the result reports version
   `1.10.0-history-integrity`, an `indexed` count, and no exception.
5. Optionally run `warmPortalReadCache`; it now warms only the lightweight case
   index.
6. Reload the GitHub Pages application after Pages publishes cache key 63.

Expected regression check:

- `A24C2718388`, source `2025!342`: `Trong bảo hành`, part `ASG02271`.
- `A24C2718388`, source `2026!167`: `Sửa làm hàng good`, parts `BP012029`,
  `B0P01309`, `BP007144`, `B0P01333`.

The two repair cycles are matched by source row (`year!row`) so the shared
serial number and received date cannot merge them together.
