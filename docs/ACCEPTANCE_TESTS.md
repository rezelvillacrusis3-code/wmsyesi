# IT acceptance checklist

Use a separate Google test deployment. Record the outcome, tester, date and environment for each item. Automated tests are not a substitute for this live checklist.

## Connection and access

- [ ] setupWms creates every schema tab and the first administrator without creating warehouse example records.
- [ ] Unconfigured frontend shows setup instructions and provides no warehouse bypass.
- [ ] An approved Google account signs in on the exact Netlify origin.
- [ ] An unlisted or inactive account is rejected.
- [ ] Viewer cannot call a write action even if constructing a direct HTTP request.
- [ ] Wrong-origin requests and invalid/expired Google tokens are rejected.
- [ ] GATEWAY_SECRET appears only in Apps Script properties and Netlify function settings.
- [ ] Google Drive document folder is private; uploaded files are not shared publicly.

## Receiving and stock

- [ ] Create a test client, location and quantity product, then post 10 units.
- [ ] Dashboard and Current Stock show the new movements and 10 units.
- [ ] Retry the same request after a simulated timeout; quantity is not duplicated.
- [ ] Reusing a posted receipt reference is rejected.
- [ ] A batch with one invalid row posts no rows from that batch.
- [ ] Serialized product requires a serial and quantity 1; duplicate serial inbound is rejected.
- [ ] Client/location mismatches, missing batch/expiry and expired stock are rejected.
- [ ] Stock adjustment cannot reduce the balance below already reserved quantities.
- [ ] Location transfer preserves total quantity and cannot transfer reserved stock or cross client-assigned locations.

## Fulfillment

- [ ] Import an order for 3 units, allocate it and verify on-hand stays 10 while available becomes 7.
- [ ] Earlier valid expiry is allocated before later expiry.
- [ ] Unapproved assemblies and missing products are blocked.
- [ ] Incorrect scan and excess scan quantity are rejected.
- [ ] Packing requires the correct order tracking label as well as the correct item.
- [ ] Packing before picking is rejected.
- [ ] Picking and packing produce persistent scan records.
- [ ] Manifest contains the selected client/order/tracking/article/quantity fields.
- [ ] Dispatch creates outbound ledger movements only after all units are packed.
- [ ] Dispatch retry does not deduct stock twice.
- [ ] Cancelling an unshipped order releases reserved quantities.
- [ ] A return cannot exceed the originally shipped quantity; damaged returns remain quarantined.

## Finance and documents

- [ ] Create receivable and payable invoices with approved test tax rates.
- [ ] Confirm totals against independent calculations, including rounding.
- [ ] Payment reduces the correct invoice balance and overpayment is rejected.
- [ ] Duplicate invoice/payment references are rejected as specified.
- [ ] Different currencies remain separate.
- [ ] Non-finance staff cannot read invoices, payments or invoice attachments.
- [ ] Upload a real small test PDF for each of two clients and confirm download bytes match the originals.
- [ ] Cross-client invoice/shipment document linkage is rejected.
- [ ] Print invoice and verify the company-specific legal fields after IT/Finance customizes them.

## Recovery and workload

- [ ] Test a CSV larger than 200 rows and confirm batch progress and receipt part references.
- [ ] Force a later import batch to fail, correct it and retry without reposting earlier completed batches.
- [ ] Test the expected largest shipment and verify manifest-part creation and dispatch.
- [ ] Test realistic concurrent staff writes and confirm no negative or duplicated stock.
- [ ] Interrupt a prepared transaction in a test spreadsheet; retry and confirm journal recovery.
- [ ] Measure function duration and payload size under expected peak workloads.
- [ ] Run backupWms, restore to separate resources and verify stock, invoices and documents.
- [ ] Warehouse, Finance and IT approve the tested configuration before production use.
