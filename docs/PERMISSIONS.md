# Staff roles

| Role | Write permissions |
|---|---|
| ADMIN | All actions and staff permissions |
| MANAGER | Master data, assemblies, receiving, stock, orders, fulfillment, shipments, billing and documents; no staff permission changes |
| INBOUND | Receiving inspections, inbound posting, unreserved stock transfers, returns and non-invoice documents |
| PICKER | Pick confirmation; assigned tasks are enforced |
| PACKER | Packing scans |
| DISPATCH | Shipment creation/dispatch and non-invoice documents |
| FINANCE | Invoices, payments and documents including invoice attachments |
| VIEWER | Operational records and permitted general documents; no writes |

Only Admin sees the Users records. Active picker names/emails are exposed as an assignment directory. Admin/Manager can see the audit trail. Invoice/payment data and invoice-classified documents are restricted to Admin, Manager and Finance.

These roles apply to staff within one company. The package is not a multi-tenant client-login portal. Staff who can read warehouse records can read operational records for the company's clients; selected client filters are display filters, not separate access boundaries.

Google tokens are kept in browser memory. Pending request IDs and resumable import progress are stored in sessionStorage. No Google password or gateway secret is stored in the browser. Sign-in must be repeated after expiry/reload as required by Google.
