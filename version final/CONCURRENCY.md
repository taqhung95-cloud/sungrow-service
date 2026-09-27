# Concurrent submissions

All state-changing Apps Script operations must commit under the shared
`ScriptLock`. This prevents two users
from different Google accounts (including users in the same center) from
modifying the workbook at the same instant.

Protected operations:

- create a case (`createCase`, existing transaction lock)
- update a work order (`updateWorkOrder`)
- confirm warranty (`confirmWarranty`)
- create a transfer (`createTransfer`, existing transaction lock)
- accept a transfer (`acceptTransfer`)
- return a device to the customer (`returnToCustomer`)

New-case creation is queued by its existing transaction lock, so distinct
submissions are preserved. Mutations of existing records do not wait behind an
active writer: an overlapping request is rejected with a reload/retry message
instead of overwriting the result of the first employee.
