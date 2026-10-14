# IT setup and commissioning

This guide is for the IT employee who will review and install the project later. It does not authorize an automatic deployment.

## 1. Review the ZIP

Extract the project folder and open it in VS Code. Install Node.js 22 or later on the IT workstation if needed. Run `npm.cmd run verify`. This executes tests and generates `dist/` and `google-apps-script/Engine.gs`. There are no third-party npm dependencies to install for the package build.

Keep the package in your company repository with restricted access. Set a code owner and a backup/restore owner before enabling live users.

## 2. Create the new Google records store

Use a company-controlled Google Workspace account. Create a standalone project at https://script.google.com/.

Copy the package's `google-apps-script/Code.gs` into Code.gs. Add an Engine script file and copy `Engine.gs`. In Apps Script settings, enable visibility of appsscript.json and replace it with the packaged manifest.

Add these Script Properties:

| Property | Value |
|---|---|
| `ADMIN_EMAIL` | The company Google account that will administer the WMS |
| `GATEWAY_SECRET` | A random secret with at least 32 characters; use the same value in Netlify |
| `SPREADSHEET_ID` | Optional. Omit it to create a new spreadsheet on the first setup |
| `DOCUMENTS_FOLDER_ID` | Optional. Omit it to create a new private Drive folder |

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Transfer it through your organization's secret-management process. Never paste it into a client CSV, the browser configuration or a public repository.

Run `setupWms` from the Apps Script editor and authorize its Sheets and Drive scopes. It creates the tabs listed in `SHEET_SCHEMA.md`, the document folder and one staff account for ADMIN_EMAIL. It does not create warehouse sample data. The spreadsheet URL is shown in the execution log; the IDs are retained in Script Properties. A separate staff account can be the WMS administrator, but the Google owner must retain administrative control of the Script and Drive resources.

Do not rename sheet tabs or headers. Staff should use the app for business changes. Give direct Sheet editing access only to the designated IT/data owner. Direct spreadsheet edits bypass app validation and its audit trail, so they are not a supported warehouse workflow. Keep the document folder restricted; do not enable public link sharing.

## 3. Deploy the signed gateway

In Apps Script, choose Deploy → New deployment → Web app.

- Execute as: the project owner.
- Who has access: Anyone.

The endpoint must be reachable by Netlify without a browser login. It returns only a public service description for GET requests. Data requests require a valid HMAC signature from Netlify, an unexpired timestamp and an active staff email. Google Workspace policy may prohibit this deployment mode; if so, this architecture cannot be deployed under that policy without changing the server connection.

Copy the deployment URL ending in `/exec`. Updating Code.gs or Engine.gs requires updating the web-app deployment to a new version. If the file structure changes, back up existing data and review migration needs rather than rerunning setup blindly.

## 4. Configure Google sign-in

In Google Cloud Console, configure the OAuth consent screen and create an OAuth client with type Web application. Add the exact production origin, such as `https://your-company-wms.netlify.app`, under Authorized JavaScript origins. Configure the allowed users/organization according to company policy. No Google password is handled by this application.

Use the client ID ending in `.apps.googleusercontent.com`. This public ID identifies the app; it is not the gateway secret. The server validates the Google token signature, audience, issuer, expiry and verified email, and the Sheets Users tab separately determines access and role.

Official setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## 5. Prepare Netlify

Connect the reviewed repository or configure your approved Netlify deployment process. The package's netlify.toml sets build command `npm run build`, publish directory `dist`, and functions directory `netlify/functions`.

Set these Netlify environment variables:

- `APP_ORIGIN`: exact HTTPS site origin, without a trailing slash.
- `GOOGLE_CLIENT_ID`: the OAuth web client ID. It is needed in both build and function scopes.
- `APPS_SCRIPT_URL`: deployed `/exec` gateway URL, needed only in the function runtime.
- `GATEWAY_SECRET`: identical to the Script Property, needed only in the function runtime.

Do not deploy just the dist folder using drag-and-drop: this WMS also requires its Netlify function. Use a repository deployment or the approved Netlify CLI workflow that includes functions. The review build has an empty public client ID and correctly prevents access until configured. Rebuild after setting GOOGLE_CLIENT_ID.

Ensure the Netlify plan permits the function runtime and timeout used by the gateway. A gateway call has a 25-second application timeout; test write batches under realistic load. Quotas and execution limits vary by hosting plan and may change.

## 6. Commission a test environment

Sign in with ADMIN_EMAIL. Add staff via Staff & permissions. Create the real client/product/location master data only after validating it against company records. Complete the acceptance checklist using a separate test client and stock. Tests create actual test ledger movements and payment records, so never run the checklist against real inventory without a test-data plan.

Finance must review currency, tax rates, invoice details and client billing processes. The app calculates tax from entered line rates; it does not select legally required rates or replace accounting advice.

## 7. Backups and handover

Run `backupWms` once from the Script editor and verify its output. It creates a private spreadsheet copy in a backup folder. IT can add a daily time-based trigger for backupWms. This copies the Sheet records, not the uploaded document files; maintain a separate Google Drive backup and retention policy for those files.

Restore to separate test resources first. Update SPREADSHEET_ID and DOCUMENTS_FOLDER_ID deliberately; a restored Sheet may refer to Drive file IDs in the original folder. Test document downloads and balances before changing production connections.

Record ownership, Google client ID, deployment IDs, change history, backups and the results of acceptance/load tests in your IT handover. Keep secret values outside that document.
