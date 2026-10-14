# Daily operating guide

## Master data

Admin and Manager maintain Clients, Locations and Products. A product article is unique within a client; the same article can exist under another client. Location codes must exist before stock is posted. An assigned-client location cannot receive another client's stock.

Serialized products require one serial or IMEI in the serial column and qty 1 per inbound row. UPC/barcode is a product scan code; it is not a substitute for the unique serial on serialized items. For expiry-managed products, enable Require batch and expiry and supply both fields.

Assembly mappings list an assembly article, component product and units per assembly. Add one mapping per component and approve it before order import. Approved mapping quantities multiply the imported order quantity. If no mapping exists, the importer looks for a direct client product article.

## Receiving and inbound

Receiving records expected, physical and damaged quantities. Short, excess and damaged records stay visible. Recording an inspection alone does not post stock.

Inbound posting accepts CSV with headers `article,qty,location,batch,expiry,serial`. Select the client and give a unique receipt reference. Dates use YYYY-MM-DD. Keep article, barcode and serial identifiers as text when editing in Excel; save the file as UTF-8 CSV. Replace all values with actual master-data references. The packaged CSV templates contain headers only.

Posting validates every row in its batch before preparing the transaction. A successful batch creates INBOUND ledger records and a POSTED receipt. Current Stock updates from that ledger. A failed validation batch does not post partial stock. A CSV with more than 200 rows is processed in multiple batches. Earlier successful batches remain committed if a later batch fails. Fix the failure and retry the same file/reference in the same browser session to resume using the stored batch progress.

If a network failure leaves the outcome unknown, use Retry rather than changing the data/reference and sending it as a new receipt. The gateway reuses the same request ID and reconciles prepared writes. The app also blocks a duplicate posted receipt reference.

## Orders and assembly

Orders CSV uses `orderNo,tracking,article,qty`. Select the client. Imports expand approved assembly components or match a direct warehouse article. Duplicate order/product lines are blocked. Shipments must keep one client per manifest part.

Allocate each NEW order line, or select a client and choose Allocate new lines for up to 200 lines per action. FEFO selects the earliest non-expired stock first. Allocations reserve stock; Current Stock shows on-hand, reserved and available quantities separately.

## Picking, packing and dispatch

Pickers open allocated tasks and scan the serial/IMEI for serialized positions or the warehouse article/barcode for quantity positions. Enter only the units physically picked. Assigned tasks can be confirmed by the assigned picker or management.

Packers scan the order tracking label and confirm the units already picked, using the same position-specific item matching. The app rejects a wrong tracking label, incorrect item code, excess quantity, expired/quarantined stock or packing before picking.

Dispatch creates a shipment from PACKED order lines, recording a carrier, shipment/container reference and optional shipment tracking or bill of lading. Selections over 200 lines become numbered manifest parts. Export each manifest for the shipment documentation. Dispatch each READY part after its checks; it records outbound stock movements and closes its pick tasks. Re-dispatch is rejected. This edition does not buy courier labels or transmit electronic customs declarations.

## Returns and stock adjustments

Returns reference a shipped pick task. Returned quantity cannot exceed the shipped quantity minus prior returns. Good returns go back to stock; damaged returns go into a quarantined ledger position. They cannot be allocated. Credit notes/refunds are not automatically issued; Finance must manage them through its approved accounting process.

Managers can enter stock adjustments with a reason. A negative adjustment cannot consume reserved units. Adjustments and all other actions appear in the audit trail.

Use Transfer on a stock position to move unreserved goods to another active location. Inbound staff and management can transfer stock. The app records matching TRANSFER_OUT and TRANSFER_IN movements, preserving total quantity. A transfer cannot use stock already reserved for orders or a location assigned to a different client.

## Client accounts, invoices and payments

Finance selects client receivable or supplier payable, invoice number, currency, issue/due dates and invoice lines. The CSV input columns are `description,qty,unitPrice,taxRate`. Prices and tax rates come from approved company billing data. Each line's net and tax amount is rounded to minor currency units, then totaled. Payments must use no more than two decimal places and cannot exceed the remaining balance.

Invoice numbers must be unique for the same client and account direction. Record payment references and methods. Outstanding balances are displayed by currency; different currencies are never added as if they were the same unit.

Use Print invoice to open the invoice for browser printing or Save as PDF. The current print layout contains invoice and client identifiers; your IT/Finance team should extend it with company tax-registration/address details required for your actual invoices.

## Documents

Upload PDF, PNG, JPEG or XLSX up to 4 MB each. Choose the client and optionally connect an invoice or shipment. Related records must belong to the same client. Invoice attachments require a Finance, Manager or Admin role. Files remain in the private configured Drive folder. The app downloads through the authenticated gateway; it does not make public Drive links.

## Exports and reports

Export CSV uses the visible search and client filters. Current Stock and Movements support quantity reconciliation. Finance exports contain balances and payment records. Audit exports are available to Admin/Manager. Store exports according to company information-handling procedures.
