# Google Sheets structure

`setupWms` creates these tabs automatically. Column names are generated from SCHEMA in Code.gs; they must remain unchanged. Records are stored in readable columns rather than a single opaque database field. JSON arrays are used for invoice items and shipment order IDs.

| Tab | Record purpose | Principal fields |
|---|---|---|
| Users | Staff Google accounts and roles | id, email, name, role, active |
| Clients | Client/vendor accounts | id, name, contact, currency, active |
| Locations | Warehouse zones and assignments | id, zone, clientId, active |
| Products | Warehouse article and scan rules | id, clientId, article, description, barcode, serialized, expiryRequired, active |
| Mappings | Assembly-to-component relationships | id, clientId, assemblyArticle, productId, units, approved |
| Receiving | Physical checks and posted receipt summaries | id, clientId, reference, expected, received, damaged, status, at, by |
| Movements | Source ledger for Current Stock | id, stockKey, clientId, productId, article, location, batch, expiry, serial, blocked, qty, type, reference, at, by |
| Orders | Fulfillment order lines | id, clientId, orderNo, tracking, productId, article, qty, status, at, shipmentId, reason |
| Picks | Stock allocations and scan progress | id, orderId, stockKey, clientId, article, qty, pickedQty, packedQty, status, assignedTo, location, at |
| Scans | Pick/pack verification events | id, pickId, orderId, tracking, code, qty, stage, at, by |
| Shipments | Carrier/container manifest parts | id, clientId, reference, carrier, tracking, orderIds, status, at, by, shippedAt |
| Returns | Returned shipped units | id, pickId, clientId, qty, damaged, reason, at, by |
| Invoices | Receivables and payables | id, clientId, direction, invoiceNo, currency, issuedDate, dueDate, items, subtotalMinor, taxMinor, totalMinor, status, at, by |
| Payments | Invoice payments | id, invoiceId, clientId, amountMinor, currency, direction, reference, method, date, at, by |
| Documents | Private Drive file metadata | id, clientId, invoiceId, shipmentId, kind, name, fileId, mime, size, at, by |
| Audit | Staff action trail | id, action, by, role, at, requestId, records |
| Transactions | Idempotency and prepared-write journal | id, status, hash, result, parts, at |
| TransactionParts | Chunked operation plans | id, transactionId, content |

Current Stock is calculated by grouping the Movements ledger by stockKey, then subtracting active pick reservations to obtain available quantity. There is no editable Current Stock balance tab; changing a balance requires an audited movement through the app.

Currency values in subtotalMinor, taxMinor, totalMinor and amountMinor are integers in the currency's minor unit (for AED, fils). This edition assumes a two-decimal currency. It is not suitable for currencies with a different minor-unit scale without changing the finance engine.

Invoice items contain arrays of description, qty, unitPrice, taxRate, lineMinor and lineTax. Shipment orderIds is an array of internal order-line IDs. at/shippedAt are ISO timestamps. Invoice/payment calendar dates use YYYY-MM-DD.

New sheets start without warehouse sample records. Only the configured administrator is provisioned at setup. Numeric and Boolean cells are written as typed values; identifiers remain text. Formula-like input strings are escaped before spreadsheet writes.

Transactions and TransactionParts must never be manually deleted while a transaction is PREPARED. Recovery replays prepared operations by record ID before serving another request. A committed journal also supplies the original result when the same request ID is retried.
