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
   │  WALLET_STATUS: UNAVAILABLE | DISCONNECTED | CONNECTING | CONNECTED | ERROR
   │  ENVIRONMENT:   NIMIQ_PAY_AVAILABLE | BROWSER_MODE | UNSUPPORTED
   │  connectWallet() / disconnectWallet() / getAddress() / getBalance()
   │  requestNimPayment() / requestUsdtPayment() (always throws)
   │  signInWithNimiqPay() / getStoredAuthSession()
   │  subscribeToWalletChanges(fn) — pub/sub, no polling
   ▼
useNimiq()  (hooks/useNimiq.js)  ← thin reactive wrapper, one per component
   │  { status, environment, address, network, consensus, blockNumber,
   │    balance, auth, error, isConnecting, isConnected, isUnavailable,
   │    isError, connect, disconnect, signIn, pay }
   ▼
┌──────────────┬────────────────┬──────────────────┬──────────────────┐
WalletStatus.jsx  Marketplace.jsx  LearningPaymentModal.jsx  WalletDiagnostics.jsx
(connection card) (badges, unlock)  (payment flow)            (dev-only panel)
```

`paymentService.js` sits between the UI and `nimiqWalletService.js`: it
decides real-payment vs. DEMO-simulation routing, but every real action it
takes (`requestNimPayment`) still goes through the wallet service — it never
touches `window.nimiq` directly.

`entitlementService.js` is a separate, deliberately dumb concept: a
successful payment (real or simulated) produces an entitlement
`{ productId, purchaserAddress, transactionId, purchasedAt, status,
simulated }`, stored in `LearnerContext.jsx`'s `learner.unlockedPacks`. It
says nothing about learning progress — see `docs/learning-engine.md` for
that model — and it is explicitly **not** tamper-proof: it's client-side
localStorage with no backend verification, appropriate for a prototype and
called out as such in the file's own header comment.

### Singleton connection guard

`useNimiq()` calls `connectWallet()` from a mount effect, and several
components can be mounted at once (a page, `WalletStatus`, the dev
diagnostics panel). `connectWallet()` guards against this: if a connection
is already `CONNECTING` or `CONNECTED`, later callers just get the current
state back (they still receive live updates via `subscribeToWalletChanges`
regardless). The underlying `provider` object and its `'connect'`/
`'disconnect'` listeners are module-level singletons, registered at most
once — not once per component that happens to call the hook.

## Connection flow

1. `detectEnvironmentSync()` checks `window.nimiq` synchronously for
   immediate UI labeling (`isNimiqPayAvailable()`), but this alone is not
   trusted for the real attempt — some hosts inject `window.nimiq`
   asynchronously.
2. `connectWallet({ timeout })` calls the real `init()` from
   `@nimiq/mini-app-sdk`, which polls for `window.nimiq` up to `timeout` ms
   (default 8000). If it never appears, `init()` rejects and status becomes
   `UNAVAILABLE` with `environment: BROWSER_MODE` — this is the expected,
   correct outcome for anyone opening the app in a normal browser tab.
3. On success, `provider.connect()` is called (internally `listAccounts()`),
   then `refreshAccountState()` reads the real address, network, consensus
   state, and block height in parallel. Status becomes `CONNECTED` only once
   a real, non-empty address comes back — never sooner.
4. A still-valid prior sign-in for that exact address is rehydrated from
   `localStorage` at this point (see Authentication below), so a page
   reload doesn't silently drop a session that hasn't expired.

## Authentication (message signing)

`signInWithNimiqPay()` implements the message-signing flow the spec asked
for, entirely with real primitives:

- A message is built with the app origin, the connected address, a fresh
  nonce, an issue time, and a 5-minute expiry — all human-readable, since
  `provider.sign()` shows the exact text in Nimiq Pay's own confirmation UI.
  This app has no way to sign "hidden" data through this API.
- The nonce comes from `crypto.getRandomValues()` (16 bytes → hex), never
  `Math.random()`.
- `provider.sign(message)` is the real signing call.
- Only `{ address, authenticatedAt, expiresAt }` is ever stored — never the
  signature, never a public key. `localStorage` is a convenience so the UI
  can show "Signed in" without re-prompting every render; it is not itself
  cryptographic proof of anything to a third party.

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
`{ productId, amount, asset, recipient, purpose, title }`.
`processPayment(request, { onStateChange })` then branches on whether a
real wallet is connected:

**Connected (real path):**
1. Non-NIM assets fail immediately with an explicit "not available" error —
   never attempted against the provider.
2. `TRANSACTION_STATE` moves `AWAITING_APPROVAL` → the real
   `provider.sendBasicTransaction({ recipient, value })` is called (amount
   converted to Lunas, `1 NIM = 100,000 Lunas`).
3. Three, and only three, outcome shapes are returned, distinguished by
   `status`:
   - **`"success"`** (`CONFIRMED`) — the provider actually returned a
     result. `purchaserAddress`, a real `reference` (the serialized
     transaction), and `provider: "Nimiq Pay"` are included.
   - **`"rejected"`** — the provider error text matches a user-decline
     pattern (`reject|cancel|denied|declined`). This is the one failure case
     where the UI is allowed to say "your wallet was not charged," because
     nothing was ever broadcast.
   - **`"uncertain"`** — a timeout (60s) or any other provider error. The
     UI explicitly does **not** claim the wallet was or wasn't charged here
     — it tells the learner to check their wallet before retrying, per the
     spec's instruction not to auto-retry an ambiguous payment.

**Not connected (DEMO MODE):** a 1.4s delay, then a simulated success with
`simulated: true`, `purchaserAddress: null`, and a `SIM-XXXXXX` reference
(`crypto.getRandomValues`-based, not `Math.random`). Every surface that
shows this result — the modal, the marketplace notice, payment history —
labels it as a simulation; nothing about it is presented as a real
blockchain transaction.

## Browser fallback (DEMO MODE)

Opening this app in a normal browser tab (not inside Nimiq Pay) is a fully
expected, first-class path, not an error state: `window.nimiq` never
appears, `init()` times out, status settles at `UNAVAILABLE` with
`environment: BROWSER_MODE`, and the rest of the app — AI, ExplainBack,
Knowledge Map, ForgetMeNot — works exactly as it does inside a real Mini
App. Only the wallet/payment surface changes: `WalletStatus.jsx` explains
that connecting requires opening the app from Nimiq Pay, and
`LearningPaymentModal.jsx` runs the DEMO simulation path described above.

## Dev diagnostics panel

`src/components/payments/WalletDiagnostics.jsx` mirrors the existing
`AIDiagnostics.jsx` pattern: dev-build-only (`import.meta.env.DEV`), hidden
behind the `nimiqlearn:wallet-diagnostics=1` localStorage flag or a
`#wallet-diagnostics` URL hash, and rendered from `AppRoot.jsx` alongside
`AIDiagnostics`. It shows: Nimiq Pay detected Y/N, environment, connection
status, address (truncated), network, consensus, block height, host
language, NIM balance query status (always "not supported by SDK"), USDT
support status, payment provider, sign-in status and expiry, and the last
wallet error — plus Connect/Disconnect buttons for manual testing. It never
renders a private key, seed phrase, or signature: `nimiq.auth` only ever
contains `{ address, authenticatedAt, expiresAt }`, so there is nothing
sensitive in scope to accidentally leak here.

## Testing instructions

**In a normal browser (available in this environment):**
```
npm install
npm run build
npm run preview
```
Open the preview URL. Expect: `WalletStatus` shows "Wallet unavailable in
browser," the Marketplace/Home/Wallet badges show "DEMO MODE," and
completing a purchase in `LearningPaymentModal` produces a
`SIM-XXXXXX`-labelled simulated unlock. Append `#wallet-diagnostics` to the
URL (or run `localStorage.setItem("nimiqlearn:wallet-diagnostics","1")` in
the console) to open the dev panel and confirm `Nimiq Pay detected: NO`,
`Environment: BROWSER_MODE`.

**Inside a real Nimiq Pay Mini App environment (NOT available in this
sandbox):** deploy to an HTTPS URL and open it via
`nimiqpay://miniapp?url=your-app.com` or
`https://nimpay.app/miniapps/open/your-app.com`. Expect `window.nimiq` to be
injected, `connectWallet()` to resolve a real address, `WalletStatus` to
show "Connected," and a real unlock purchase to open Nimiq Pay's native
confirmation dialog. **This path is BLOCKED in the current development
environment** — there is no real Nimiq Pay client available to test
against here. Every method this integration calls has been verified against
the installed SDK and its upstream source (see "Verification trail" above),
but the end-to-end real-wallet flow itself has not been exercised against
an actual Nimiq Pay instance and must not be reported as tested until it
is.
