# Deployment 1.6.4 — verified mutations and reduced polling

Update the existing Apps Script project's Code.gs from this directory, save,
and update the existing web-app deployment to a new version. Keep its existing
deployment URL. The GitHub frontend requires getCreationStatus before creation;
until this backend is deployed it will show an update-required message.

No database reset or reconciliation is required for this release. The request-ID
column is added automatically. Existing case and attachment data are preserved.

Frontend checks revisions every 60–75 seconds; full background refresh is every
five minutes and is suspended while using the data-entry portal. Manual refresh
remains available. Read retries are reduced to one with a random delay.

Creation has a persistent request ID and an upload receipt. Drive upload runs
outside the shared database write lock. If upload completion is uncertain, the
receipt is deliberately retained and duplicate uploads are blocked. An operator
must inspect the actual Drive folder and source case before resolving such a
receipt; do not blindly delete CREATE_UPLOAD_ properties or resubmit a new draft.
Receipts are removed after the case and work order are written successfully.

Automated local tests cover syntax, existing role/KPI checks, repeated creation,
request-status owner isolation, and Drive upload lock isolation. They do not
establish production throughput or the cause of the reported HTTP 404.

Production acceptance still required: ten signed-in sessions reading concurrently;
one controlled test case with a small ZIP; verify upload, case/work IDs, retry
recovery, cancellation, and absence from both portal and dashboard after reload.
Do not use real customer cases for destructive tests.
