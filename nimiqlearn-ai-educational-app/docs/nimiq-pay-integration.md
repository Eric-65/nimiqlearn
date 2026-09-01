# NimiqLearn — Nimiq Pay Integration

This document is the audit and reference for the real wallet, authentication,
and payment integration in `src/services/nimiqWalletService.js` and its
consumers. It was written the same way as `docs/learning-engine.md`: by
reading the actual installed SDK and its upstream source first, then writing
code and docs against that ground truth — never against remembered examples
or invented method names. Where the real SDK genuinely doesn't support
something (a balance query, USDT), that's stated plainly below rather than
worked around with a fabricated value.

## Verification trail

Every claim about the real provider API in this document and in
`nimiqWalletService.js` was checked against two sources, in this order:

1. **The installed package** — `node_modules/@nimiq/mini-app-sdk@0.1.0`
   (`README.md`, `dist/index.d.ts`, `dist/provider.d.ts`). This is what
   actually ships and runs in this app; it is the primary source of truth.
2. **Upstream source** — `github.com/nimiq/trust-web3-provider`,
   `packages/mini-app-sdk/{provider.ts,init.ts,host.ts,index.ts}` and
   `packages/nimiq/{NimiqProvider.ts,RPCServer.ts}`. Used only to confirm
   behavior the type declarations don't fully spell out (exact event names,
   what `connect()` does internally, what `request()` falls back to).

One important finding from comparing the two: the upstream repo has since
added `getHostFiat()` / a `Fiat` type that do **not** exist in the installed
`0.1.0` package. Those are deliberately not used anywhere in this app —
calling them would throw at runtime against the version actually installed.
This is the version-drift trap the Prompt 9 spec warned about, and the
reason "read the installed package first" is the rule, not "read the repo."

**nimiq.dev** (the official docs host the second Prompt 9 pass names
explicitly) is unreachable from this sandbox's network egress policy — every
`WebFetch` to it returns `EGRESS_BLOCKED`. The installed package + upstream
source above are the fallback ground truth used throughout this file
instead; a `WebSearch` cross-check turned up nothing that contradicts them
(same method names: `listAccounts`, `sign`, `sendBasicTransaction`,
`isConsensusEstablished`, `getBlockNumber`).

A second finding from re-reading the installed package's *compiled* JS (not
just its `.d.ts`): `init()`'s real default timeout is **10,000ms**, not the
8000ms an earlier pass of this file used — `i?.timeout??1e4` in
`dist/index.js`. Also, `sendBasicTransaction()`'s own doc comment says it
returns **"the serialized transaction"**, not a computed hash — see
"Payment flow" below for why this app never presents that string as a
Nimiq protocol transaction hash.

## What is real vs. what is verified unsupported

| Capability | Status | Real method used |
|---|---|---|
| Environment detection | Real | `window.nimiq` presence + `init()` timeout poll |
| Connect / account fetch | Real | `provider.connect()` → internally `listAccounts()` |
| Disconnect | Real | `provider.disconnect()` |
| Address | Real | first entry of `listAccounts()` result |
| Network | Real | `provider.getNetwork()` |
| Consensus state | Real | `provider.isConsensusEstablished()` |
| Block height | Real | `provider.getBlockNumber()` |
| Host language | Real | `getHostLanguage()` |
| NIM payment | Real | `provider.sendBasicTransaction({ recipient, value })` |
| Message signing | Real | `provider.sign(message)` |
| **NIM balance query** | **Verified unsupported** | no such method anywhere in the SDK or its upstream provider |
| **USDT / EVM payment** | **Verified unsupported** | zero EVM/`window.ethereum`/USDT code in this SDK or its upstream `NimiqProvider.ts` |

The real provider emits exactly two events: `'connect'` and `'disconnect'`.
There is no `'accountsChanged'` or similar in this SDK version — code that
assumed one would silently never fire.

### Why balance is "not available," not "0" or hidden

`provider.request()` recognizes a fixed `WALLET_METHODS` set (`listAccounts`,
`sign`, `sendBasicTransaction`, `sendBasicTransactionWithData`, plus staking
transactions). Anything else falls through to a raw JSON-RPC call against a
separately-configured RPC endpoint (`setRPCUrl()`) that Nimiq Pay does not
supply. Querying a balance that way would mean this app silently trusting a
third-party Albatross RPC node NimiqLearn never configured — a materially
different trust model than "ask the wallet the user already trusts."
`getBalance()` in `nimiqWalletService.js` therefore always resolves
`{ amount: null, supported: false, reason: "..." }` and the UI shows "Not
available" with that reason, rather than a `0`, a spinner that never
resolves, or a fabricated number.

### Why USDT is disabled everywhere, not just outside Nimiq Pay

`getUsdtSupportStatus()` always returns `"UNSUPPORTED"` regardless of
environment, because the capability doesn't exist in the installed SDK at
all — it isn't a "works in Mini App, not in browser" situation. The asset
picker in `LearningPaymentModal.jsx` disables the USDT option
unconditionally (`disabled={!a.real}`), and `paymentService.js` fails fast
with an explicit error if a request somehow arrives with `asset !== "NIM"`
while connected to a real wallet, rather than silently attempting it.

## Architecture

```
nimiqWalletService.js        ← single source of truth, module-level state
   │  NIMIQ_STATUS: NIMIQ_PAY_AVAILABLE | BROWSER_UNAVAILABLE | INITIALIZING
   │                | CONNECTED | ERROR   (one flat enum — see below)
   │  initializeNimiqProvider() / connectWallet() / disconnectWallet()
   │  getAddress() / listAccounts() / getConsensusStatus() / getBlockNumber()
   │  getNimBalance() / getUsdtSupportStatus()
   │  sendNimPayment() / requestUsdtPayment() (always throws) / waitForTransaction()
   │  signMessage() / authenticateWithNimiqPay()
   │  subscribeToWalletChanges(fn) — pub/sub, no polling
   ▼
authService.js                ← session metadata only, no provider access
   │  createAuthChallenge() / createSession() / getStoredSession() / clearSession()
   ▼
useNimiq()  (hooks/useNimiq.js)  ← thin reactive wrapper, one per component
   │  { status, address, network, consensusReady, networkHeight, balance,
   │    authenticated, error, providerAvailable, isConnecting, isConnected,
   │    isUnavailable, isError, isAuthenticated, connect, disconnect, signIn, pay }
   ▼
┌──────────────────────┬────────────────┬──────────────────────┬──────────────────┐
NimiqWalletStatus.jsx    Marketplace.jsx  LearningPaymentModal.jsx  WalletDiagnostics.jsx
(components/wallet/)     (badges, unlock)  (payment flow)            (dev-only panel)
```

Item 6 of the Prompt 9 spec is explicit that "connected" must never be shown
when no provider actually exists — so this is one flat `NIMIQ_STATUS` enum,
not the two separate `WALLET_STATUS`/`ENVIRONMENT` enums an earlier pass of
this file used. `NIMIQ_PAY_AVAILABLE` means "provider detected, not yet
connected" (what was previously `DISCONNECTED`); `BROWSER_UNAVAILABLE` means
no provider at all; `INITIALIZING` is a connection attempt in flight.

`paymentService.js` sits between the UI and `nimiqWalletService.js`: it
decides real-payment vs. DEMO-simulation routing, but every real action it
takes (`sendNimPayment`) still goes through the wallet service — it never
touches `window.nimiq` directly. It also checks
`src/config/paymentConfig.js` first: if `VITE_NIM_LEARNING_RECIPIENT` is
unset, every payment attempt fails immediately with a "payment disabled"
error rather than falling back to a placeholder address (item 15).

`entitlementService.js` is a separate, deliberately dumb concept: a
successful payment (real or simulated) produces an entitlement
`{ productId, purchaserAddress, transactionId, purchasedAt, status,
simulated }`, stored in `LearnerContext.jsx`'s `learner.unlockedPacks`. It
says nothing about learning progress — see `docs/learning-engine.md` for
that model — and it is explicitly **not** tamper-proof: it's client-side
localStorage with no backend verification, appropriate for a prototype and
called out as such in the file's own header comment. The same file also
tracks `pendingPayments` — see "Preventing a duplicate payment" below.

### Singleton connection guard, and connecting only once per session

`useNimiq()` calls `connectWallet()` from a mount effect, and several
components can be mounted at once (a page, `NimiqWalletStatus`, the dev
diagnostics panel). Two distinct problems were found and fixed by testing
actual navigation between pages, not just a single page load:

1. **Concurrent duplicate connects** — `connectWallet()` guards against
   this: if a connection is already `INITIALIZING` or `CONNECTED`, later
   callers just get the current state back (they still receive live updates
   via `subscribeToWalletChanges` regardless). The underlying `provider`
   object and its `'connect'`/`'disconnect'` listeners are module-level
   singletons, registered at most once — not once per component that
   happens to call the hook.
2. **Repeated auto-reconnect on every navigation** — a real bug: without a
   guard, every page navigation remounts a component that calls
   `useNimiq()`, and its mount effect would call `connectWallet()` again.
   Once the first attempt settles to `BROWSER_UNAVAILABLE`, the environment
   cannot have changed mid-session, so re-running a fresh ~10s `init()` poll
   on every single navigation is pure waste (and produced a visibly wrong
   "Connecting…" flicker with a stale "Nimiq Pay detected: YES" reading).
   Fixed with a module-level `autoConnectAttempted` flag in `useNimiq.js`:
   the automatic mount-effect connect runs at most once per session;
   explicit user-initiated `connect()` (Retry/Connect buttons) is never
   gated by it.

## Connection flow

1. `isNimiqPayAvailable()` checks `window.nimiq` synchronously for
   immediate UI labeling, but this alone is not trusted for the real
   attempt — some hosts inject `window.nimiq` asynchronously.
2. `initializeNimiqProvider({ timeout })` calls the real `init()` from
   `@nimiq/mini-app-sdk`, which polls for `window.nimiq` up to `timeout` ms
   (default **10,000ms** — verified in the installed package's compiled
   JS, not just its types). If it never appears, `init()` rejects and
   status becomes `BROWSER_UNAVAILABLE` — this is the expected, correct
   outcome for anyone opening the app in a normal browser tab.
3. `connectWallet()` calls `provider.connect()` (internally `listAccounts()`),
   then `refreshAccountState()` reads the real address, network,
   `getConsensusStatus()`, and `getBlockNumber()` in parallel. Status
   becomes `CONNECTED` only once a real, non-empty address comes back —
   never sooner.
4. A still-valid prior sign-in for that exact address is rehydrated from
   `authService.getStoredSession()` at this point, so a page reload doesn't
   silently drop a session that hasn't expired.

## Authentication (message signing)

Connection and authentication are deliberately separate states (item 11): a
connected account is never shown as authenticated unless a real signing
flow has succeeded. `NimiqWalletStatus.jsx` shows both facts independently
("Wallet connected: YES" / "Wallet authenticated: NO" are both real,
possible at once).

`authenticateWithNimiqPay()` implements the message-signing flow the spec
asked for, entirely with real primitives, split across two files:

- `authService.createAuthChallenge({ address })` builds the message with the
  app origin, the connected address, a fresh nonce, an issue time, and a
  5-minute expiry — all human-readable, since `provider.sign()` shows the
  exact text in Nimiq Pay's own confirmation UI. This app has no way to sign
  "hidden" data through this API. The nonce comes from
  `crypto.getRandomValues()` (16 bytes → hex), never `Math.random()`.
- `nimiqWalletService.signMessage(message)` is the real
  `provider.sign(message)` call — the low-level primitive item 9 asks for.
- `authService.createSession(...)` stores only
  `{ address, authenticatedAt, expiresAt }` — never the signature, never a
  public key. `localStorage` is a convenience so the UI can show "Signed in"
  without re-prompting every render; it is not itself cryptographic proof of
  anything to a third party.

**Security model — read before treating this as production auth.** There is
no backend here to verify the signature or track spent nonces. The fresh
nonce and short expiry are the *only* replay defenses, and they are
client-side only: a user's own browser choosing to replay a captured
message within its 5-minute window is not something this design can stop.
This is a prototype auth model suitable for a Mini App with no server-side
session concept, not a production authentication system. A production
version would verify the signature against the claimed address server-side,
track nonces to prevent replay, and issue its own session token.

## Payment flow

`buildPaymentRequest(pack)` turns a `LEARNING_PACKS` entry into
`{ productId, amount, asset, recipient, purpose, title }` — `recipient`
resolves through `src/config/paymentConfig.js`'s `NIM_LEARNING_RECIPIENT`
(read from `VITE_NIM_LEARNING_RECIPIENT`), never a hard-coded address.
`processPayment(request, { onStateChange })` first checks
`PAYMENTS_ENABLED`; if the recipient is unconfigured, it fails immediately
with an explicit "payment disabled" error, before touching the wallet at
all. Otherwise it branches on whether a real wallet is connected:

**Connected (real path):**
1. Non-NIM assets fail immediately with an explicit "not available" error —
   never attempted against the provider.
2. `TRANSACTION_STATE` moves to `REQUESTING_APPROVAL` → the real
   `sendNimPayment()` calls `provider.sendBasicTransaction({ recipient, value })`
   (amount converted to Lunas via `nimToLuna()`, integer-safe, `1 NIM =
   100,000 Lunas` — item 14).
3. The result is reported via `TRANSACTION_STATE` (item 18: `IDLE`,
   `REVIEW`, `REQUESTING_APPROVAL`, `SUBMITTED`, `CONFIRMED`, `REJECTED`,
   `FAILED`, `UNKNOWN`):
   - **`CONFIRMED`** — the provider actually returned a result.
     `purchaserAddress`, a `reference` string, and `provider: "Nimiq Pay"`
     are included. That `reference` is what the installed SDK's own doc
     comment calls "the serialized transaction" — **not** a separately
     computed Nimiq protocol transaction hash. Computing that real hash
     would mean re-implementing Nimiq's transaction serialization +
     Blake2b hashing outside any documented SDK method, which risks
     silently producing a hash that doesn't match the real one on chain.
     Being explicit that this is a real, verifiable transaction reference
     — not an independently computed hash — is the honest choice; see
     "Remaining blockers" in the final report for what this means for the
     "transaction hash" acceptance item.
   - **`REJECTED`** — the provider error text matches a user-decline
     pattern (`reject|cancel|denied|declined`). This is the one failure case
     where the UI is allowed to say "your wallet was not charged," because
     nothing was ever broadcast.
   - **`UNKNOWN`** — a timeout (60s) or any other unclassifiable provider
     error. The UI explicitly does **not** claim the wallet was or wasn't
     charged here — see "Preventing a duplicate payment" below.

**Not connected (DEMO MODE):** a 1.4s delay, then a `CONFIRMED` simulated
result with `simulated: true`, `purchaserAddress: null`, and a `SIM-XXXXXX`
reference (`crypto.getRandomValues`-based, not `Math.random`). Every
surface that shows this result — the modal (via `PaymentReceipt.jsx`), the
marketplace notice, payment history — labels it as a simulation; nothing
about it is presented as a real blockchain transaction.

### Transaction status: `waitForTransaction()` and why it returns UNKNOWN

Item 19 asks for a `waitForTransaction()` if the provider "returns only the
hash and a separate status lookup is needed" — but also explicitly forbids
inventing a status endpoint. Both are true here: `sendBasicTransaction()`
returns only the serialized transaction, and `provider.request()` only
recognizes the fixed `WALLET_METHODS` set (see the capability table above);
anything else needs a self-configured RPC endpoint Nimiq Pay does not
supply. `waitForTransaction()` therefore always resolves `{ status:
"UNKNOWN", reason: "..." }` rather than silently trusting a third-party RPC
node this app doesn't control — the same reasoning as `getNimBalance()`.

### Preventing a duplicate payment (item 22)

A `TRANSACTION_STATE.UNKNOWN` result calls
`recordPendingPayment({ productId })` (`LearnerContext.jsx`, persisted in
`learner.pendingPayments`). While a product has a pending entry,
`LearningPaymentModal.jsx` opens straight to a "Payment status needs
verification" screen instead of the normal review screen, and the only way
forward is an explicit "I've checked my wallet" acknowledgment
(`clearPendingPayment`) — there is no automatic status check, because none
exists (see above), and this app will not fabricate one. Pending entries
also surface on the Wallet page so they're visible outside the modal.

## Browser fallback (DEMO MODE)

Opening this app in a normal browser tab (not inside Nimiq Pay) is a fully
expected, first-class path, not an error state: `window.nimiq` never
appears, `init()` times out, status settles at `BROWSER_UNAVAILABLE`, and
the rest of the app — AI, ExplainBack, Knowledge Map, ForgetMeNot — works
exactly as it does inside a real Mini App. Only the wallet/payment surface
changes: `NimiqWalletStatus.jsx` explains that connecting requires opening
the app from Nimiq Pay, and `LearningPaymentModal.jsx` runs the DEMO
simulation path described above.

## Dev diagnostics panel

`src/components/payments/WalletDiagnostics.jsx` mirrors the existing
`AIDiagnostics.jsx` pattern: dev-build-only (`import.meta.env.DEV`), hidden
behind the `nimiqlearn:wallet-diagnostics=1` localStorage flag or a
`#wallet-diagnostics` URL hash, and rendered from `AppRoot.jsx` alongside
`AIDiagnostics`. It shows: Nimiq Pay detected Y/N, connection status,
address (truncated), network, consensus, block height, host language, NIM
balance query status (always "not supported by SDK"), USDT support status,
payment provider, sign-in status and expiry, and the last wallet error —
plus Connect/Disconnect buttons for manual testing. It never renders a
private key, seed phrase, or signature: `nimiq.authenticated` only ever
contains `{ address, authenticatedAt, expiresAt }`, so there is nothing
sensitive in scope to accidentally leak here.

## Testing instructions

**In a normal browser (available in this environment):**
```
npm install
npm run build
npm run preview
```
Open the preview URL. Expect: `NimiqWalletStatus` shows "Nimiq Pay
unavailable," the Marketplace/Home/Wallet badges show "DEMO MODE," and
(with `VITE_NIM_LEARNING_RECIPIENT` set — see `.env.example`) completing a
purchase in `LearningPaymentModal` produces a `SIM-XXXXXX`-labelled
simulated unlock; without it, the Marketplace shows a "payment disabled"
banner and the Confirm button is disabled. Append `#wallet-diagnostics` to
the URL (or run `localStorage.setItem("nimiqlearn:wallet-diagnostics","1")`
in the console) to open the dev panel and confirm `Nimiq Pay detected: NO`.

A real bug was only caught by testing *navigation between pages*, not a
single page load: without the `autoConnectAttempted` guard (see above),
clicking to the Wallet page after the first connection attempt had already
settled to `BROWSER_UNAVAILABLE` silently restarted a fresh ~10s `init()`
poll, so the status card showed a stale "Connecting…" / "Nimiq Pay
detected: YES" for another 10 seconds. Confirmed fixed by polling the
badge text across a full page-navigation sequence, not just checking it
once after initial load.

**Inside a real Nimiq Pay Mini App environment (NOT available in this
sandbox):** deploy to an HTTPS URL and open it via
`nimiqpay://miniapp?url=your-app.com` or
`https://nimpay.app/miniapps/open/your-app.com`. Expect `window.nimiq` to be
injected, `connectWallet()` to resolve a real address, `NimiqWalletStatus`
to show "Connected," and a real unlock purchase to open Nimiq Pay's native
confirmation dialog. **This path is BLOCKED in the current development
environment** — there is no real Nimiq Pay client, and no Android device
running it, available to test against here. Every method this integration
calls has been verified against the installed SDK and its upstream source
(see "Verification trail" above), but the end-to-end real-wallet flow
itself has not been exercised against an actual Nimiq Pay instance and
must not be reported as tested until it is.
