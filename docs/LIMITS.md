# Capacity and known boundaries

The code supports real Sheets/Drive connections once configured. It does not emulate a live integration when those resources are missing.

- CSV import batches: up to 200 input rows per transaction.
- Bulk allocation: up to 200 order lines per action.
- Manifest parts: up to 200 order lines per part. Larger shipment selections produce multiple parts; dispatch is performed per part.
- Invoice creation: up to 100 lines.
- File upload/download: 4 MB per file. PDF, PNG, JPEG and XLSX are accepted as documents.
- Bulk stock/order data input: UTF-8 CSV or pasted CSV, with the provided header layouts. PDF order extraction and XLSX stock import are not implemented in this edition.
- Snapshot guard: the gateway stops serving datasets with more than 100,000 movement records. Google/Netlify response-size or execution limits can be reached before that number, depending on record sizes. This is a guard, not a benchmark or guaranteed operating capacity.
- Full snapshots read the sheets and compute balances. IT must load-test realistic dataset sizes and concurrent users. For high-volume multi-warehouse operations, preserve the API/business engine but replace the Sheets storage adapter with a transactional SQL database, with Sheets used for reporting.
- Apps Script has daily and per-execution quotas. Writes hold a script lock and a browser-to-server operation has a 25-second proxy timeout. Journal recovery protects prepared writes but does not remove those capacity limits.
- A CSV import is atomic per batch, not across the whole file. A large shipment is dispatched per manifest part, not as one multi-part atomic dispatch.
- Direct edits to Sheets bypass the ledger controls and audit. Spreadsheet editing is reserved for IT-controlled maintenance.
- Billing implements invoice and payment balances, not a full accounting general ledger, exchange-rate conversion or statutory tax reporting.
- Documents are stored, linked and downloaded; invoice OCR/data extraction, automatic VAT identification and digital signatures are not implemented.
- Real shipping label purchase, customs filing and carrier integrations require separate service integrations.
- Automated test fixtures simulate warehouse data and Google service responses solely during tests. They are never loaded into the deployed WMS.

Do not delete historical movements to reduce the sheet size: stock balances depend on the ledger. Any archival/migration must carry audited opening balances and preserve the source history in a backup.

Google quota reference: https://developers.google.com/apps-script/guides/services/quotas
Google lock reference: https://developers.google.com/apps-script/reference/lock/lock-service
