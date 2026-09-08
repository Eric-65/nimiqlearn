# NimiqLearn — Nimiq Pay Integration

This document is the audit and reference for the real wallet, authentication,
and payment integration in `src/services/nimiqWalletService.js` and its
consumers. It is written by tracing the real code against real
documentation, not from memory or invented method names.

## 1. Installed Nimiq skill

The official Nimiq Mini Apps skill was installed via:

```
npx skills add nimiq/developer-center --skill mini-apps
```

Installed at `.agents/skills/mini-apps` (symlinked into `.claude/skills/mini-apps`
for this session), cloned live from `github.com/nimiq/developer-center`. Its
contents (`SKILL.md`, `references/nimiq-provider-api.md`,
`references/checklist.md`, plus Ethereum-provider and chains-and-tokens
references) were read in full before any wallet code in this pass was
written or changed, and used throughout as the primary source of truth —
ahead of the installed npm package's own inline comments where the two
disagree (see "A corrected finding" below). This matters because
`nimiq.dev` itself is unreachable from this sandbox's network egress policy
(every `WebFetch` to it returns `EGRESS_BLOCKED`); the skill is fetched at
install time from the same underlying documentation source without needing
direct network access to nimiq.dev from this session.

## 2. SDK version

`package.json` / `package-lock.json` pin `@nimiq/mini-app-sdk` at `^0.1.0`;
the installed version (`node_modules/@nimiq/mini-app-sdk/package.json`) is
exactly `0.1.0`. Verification used the installed package's *compiled* JS
(`dist/*.js`, not just its `.d.ts` types — compiled JS is what actually
runs), the skill's `references/nimiq-provider-api.md`, and the upstream
`github.com/nimiq/trust-web3-provider` source for anything the other two
didn't fully spell out.

**A corrected finding.** An earlier pass of this document, written before
the skill was installed, read the installed package's inline doc comment on
`sendBasicTransaction()` ("@returns The serialized transaction") and
concluded that string should never be called a transaction hash. The
official skill's `references/nimiq-provider-api.md` explicitly documents
the same method's return type as `string` **(tx hash)**. Both describe the
same method on the same installed version — confirmed still exactly
`0.1.0`, so this is not a version mismatch, it's a documentation-authority
question. The skill is the more current, authoritative source (freshly
pulled from nimiq.dev's actual documentation), so this app now treats and
labels that string as a real transaction hash — see "Payment flow" below.
This is exactly the kind of skill-vs-installed-SDK discrepancy Prompt 10
asked to be investigated rather than silently resolved either way.

**Another correction.** An earlier pass also concluded USDT/EVM payments
were flatly "unsupported" because `@nimiq/mini-app-sdk` itself contains zero
EVM code. That narrow claim is true, but the broader conclusion was wrong:
the skill confirms Nimiq Pay separately injects a real `window.ethereum`
(EIP-1193, discoverable via EIP-6963) with ERC-20 support — including
USDT/USDC — across several EVM chains, entirely independent of
`@nimiq/mini-app-sdk`. See "USDT status" and "External wallet / EVM
roadmap" below.

Compatibility: **PASS** — every Nimiq-provider method this app uses
(`listAccounts`, `sign`, `sendBasicTransaction`, `isConsensusEstablished`,
`getBlockNumber`) is confirmed present, with matching signatures, in both
the installed package and the skill's capability table.

## 3. Provider initialization

```
nimiqWalletService.js        ← single source of truth, module-level state
   │  NIMIQ_STATUS: NIMIQ_PAY_AVAILABLE | BROWSER_MODE | INITIALIZING
   │                | CONNECTED | ERROR   (one flat enum, Part 6)
   │  initializeNimiqProvider() / connectWallet() / disconnectWallet()
   │  getAddress() / listAccounts() / getConsensusStatus() / getBlockNumber()
   │  getNimBalance()
   │  sendNimPayment() / waitForTransaction()
   │  signMessage() / authenticateWithNimiqPay()
   │  subscribeToWalletChanges(fn) — pub/sub, no polling
   ▼
evmWalletService.js           ← separate provider (window.ethereum), same
   │                             shape, real USDT payments (see "USDT status")
   │  EVM_STATUS: EVM_AVAILABLE | BROWSER_MODE | INITIALIZING
   │              | CONNECTED | ERROR
   │  detectEvmProvider() / connectEvmWallet() / disconnectEvmWallet()
   │  sendUsdtPayment({ chainKey, recipient, amountUsdt })
   │  subscribeToEvmChanges(fn)
   ▼
authService.js                ← session metadata only, no provider access
   │  createAuthChallenge() / createSession() / getStoredSession() / clearSession()
   ▼
useNimiq()  (hooks/useNimiq.js)  ← thin reactive wrapper, one per component
   │  { status, providerAvailable, address, network, consensusReady,
   │    blockNumber, balance, authenticated, error, isConnecting,
   │    isConnected, isUnavailable, isError, isAuthenticated,
   │    connect, disconnect, signIn, pay }
   ▼
┌──────────────────────┬────────────────┬──────────────────────┬──────────────────┐
NimiqWalletStatus.jsx    Marketplace.jsx  LearningPaymentModal.jsx  WalletDiagnostics.jsx
(components/wallet/)     (badges, unlock)  (payment flow)            (dev-only panel)
```

`initializeNimiqProvider()` is exactly the singleton-plus-in-flight-promise
architecture Part 5 asks for:

```js
let provider = null;
let providerPromise = null;
export async function initializeNimiqProvider({ timeout } = {}) {
  if (provider) return provider;
  if (!providerPromise) providerPromise = init(timeout != null ? { timeout } : undefined);
  provider = await providerPromise;
  return provider;
}
```

`init()`'s real default timeout is **10,000ms** — read from the installed
package's compiled JS (`i?.timeout??1e4` in `dist/index.js`), not assumed.

## 4. Account flow (connection, rejection)

1. `isNimiqPayAvailable()` checks `window.nimiq` synchronously for immediate
   UI labeling, but this alone is not trusted for the real attempt — some
   hosts inject `window.nimiq` asynchronously.
2. `connectWallet()` calls `initializeNimiqProvider()`, then
   `provider.connect()` (internally `listAccounts()` — real user
   confirmation dialog), then reads address, network,
   `getConsensusStatus()`, and `getBlockNumber()` in parallel. Status
   becomes `CONNECTED` only once a real, non-empty address comes back.
3. A still-valid prior sign-in for that exact address is rehydrated from
   `authService.getStoredSession()` at this point, so a page reload doesn't
   silently drop a session that hasn't expired.
4. **Rejection (Part 8) is handled distinctly from a genuine error.** If
   `provider.connect()` fails with an error whose text matches a
   user-decline pattern (`reject|cancel|denied|declined`), status resets to
   `NIMIQ_PAY_AVAILABLE` (not `ERROR`) with `error: "Connection cancelled"`
   — the UI shows this as a calm, dismissible notice, not an alarming
   failure state. No fake address, no authentication, no entitlement is
   ever created from this path. A genuine technical failure (provider
   present but something else went wrong) still resets to `ERROR`.

### A real bug caught by the skill's own pre-ship checklist

Running `references/checklist.md` against this app after the rest of this
pass surfaced a genuine bug: the mount-effect auto-connect called
`connectWallet()`, which calls `provider.connect()` — and `connect()` calls
`listAccounts()` internally, which the skill's own capability table marks
as **requiring user confirmation**. That means, unfixed, opening this mini
app inside real Nimiq Pay could have triggered a native "share your
account" dialog automatically on load, with zero user interaction — a
direct violation of the checklist's "The app does not trigger approval
dialogs on page load without user interaction."

Fixed by splitting **detection** from **connection**:
- `detectNimiqPay()` — provider presence only (`init()` + registering event
  listeners). Never requires confirmation. Safe to run automatically on
  mount, and is now the only thing `useNimiq()`'s mount effect calls.
- `connectWallet()` — the real, confirmation-requiring account request
  (`provider.connect()` → `listAccounts()`). Now only ever invoked from an
  explicit user action: the "Connect Nimiq Pay" button.

### Singleton connection guard, and connecting only once per session

`useNimiq()` calls `connectWallet()` from a mount effect, and several
components can be mounted at once (a page, `NimiqWalletStatus`, the dev
diagnostics panel). Two distinct problems were found and fixed by testing
actual navigation between pages, not just a single page load:

1. **Concurrent duplicate connects** — `connectWallet()` guards against
   this: if a connection is already `INITIALIZING` or `CONNECTED`, later
   callers just get the current state back. The underlying `provider`
   object and its `'connect'`/`'disconnect'` listeners are module-level
   singletons, registered at most once.
2. **Repeated auto-reconnect on every navigation** — a real bug: without a
   guard, every page navigation remounts a component that calls
   `useNimiq()`, and its mount effect would call `connectWallet()` again.
   Once the first attempt settles to `BROWSER_MODE`, the environment cannot
   have changed mid-session, so re-running a fresh ~10s `init()` poll on
   every navigation is pure waste — and produced a visibly wrong
   "Connecting…" flicker with a stale "Nimiq Pay detected: YES" reading.
   Fixed with a module-level `autoConnectAttempted` flag in `useNimiq.js`:
   the automatic mount-effect connect runs at most once per session;
   explicit user-initiated `connect()` (Retry/Connect buttons) is never
   gated by it.

## 5. Signing flow (authentication)

Connection and authentication are deliberately separate states (Part 10): a
connected account is never shown as authenticated unless a real signing
flow has succeeded. `NimiqWalletStatus.jsx` shows both facts independently
("Wallet connected: YES" / "Wallet authenticated: NO" are both real,
possible at once).

`authenticateWithNimiqPay()` implements the flow, split across two files:

- `authService.createAuthChallenge({ address })` builds the message with
  the app name, the connected address, a fresh nonce, an issue time, and a
  5-minute expiry — all human-readable, since `provider.sign()` shows the
  exact text in Nimiq Pay's own confirmation UI. The nonce comes from
  `crypto.getRandomValues()` (16 bytes → hex), never `Math.random()`.
- `nimiqWalletService.signMessage(message)` is the real `provider.sign(message)`
  call — the low-level primitive Part 9 asks for.
- `authService.createSession(...)` stores only
  `{ address, authenticatedAt, expiresAt }` — never the signature, never a
  public key.

**Signing rejection** is handled the same way as account rejection:
`signMessage()` throws with the provider's real error message, caught in
`NimiqWalletStatus.jsx`'s `handleSignIn()` and shown inline; authentication
state simply stays `false` — never a fake "authenticated" state.

**Security model — read before treating this as production auth.** There
is no backend here to verify the signature or track spent nonces. The
fresh nonce and short expiry are the *only* replay defenses, and they are
client-side only. This is a prototype auth model suitable for a Mini App
with no server-side session concept, not a production authentication
system. A production version would verify the signature against the
claimed address server-side, track nonces to prevent replay, and issue its
own session token.

## 6. Payment flow

`buildPaymentRequest(pack)` turns a `LEARNING_PACKS` entry into
`{ productId, amount, asset, recipient, purpose, title }` — `recipient`
resolves through `src/config/paymentConfig.js`'s `NIM_LEARNING_RECIPIENT`
(read from `VITE_NIM_LEARNING_RECIPIENT`), never a hard-coded address (Part
18). `processPayment(request, { onStateChange })` first checks
`PAYMENTS_ENABLED`; if the recipient is unconfigured, it fails immediately
with "Payments are not configured yet"-equivalent messaging, before
touching the wallet at all — payment is disabled app-wide, not silently
routed to a placeholder.

Amounts are converted NIM → Luna via `nimToLuna()`: `Math.round(n * 1e5)`,
rejecting non-finite, non-positive input — never floating-point arithmetic
on the final integer transaction value (Part 17).

**Connected (real path):**
1. Non-NIM assets fail immediately with an explicit error — never
   attempted against the provider.
2. `TRANSACTION_STATE` moves to `AWAITING_APPROVAL` → `sendNimPayment()`
   calls the real `provider.sendBasicTransaction({ recipient, value })`.
3. The result is reported via `TRANSACTION_STATE` (Part 22, exactly:
   `IDLE`, `REVIEW`, `AWAITING_APPROVAL`, `SUBMITTED`, `CONFIRMED`,
   `REJECTED`, `FAILED`, `UNKNOWN`):
   - **`CONFIRMED`** — the provider actually returned a result.
     `purchaserAddress`, a real `transactionHash` (see "A corrected
     finding" above — this is the provider's own returned tx hash string,
     never independently recomputed), and `provider: "Nimiq Pay"` are
     included.
   - **`REJECTED`** — the provider error text matches a user-decline
     pattern. This is the one failure case where the UI is allowed to say
     "your wallet was not charged," because nothing was ever broadcast.
   - **`UNKNOWN`** — a timeout (60s) or any other unclassifiable provider
     error. The UI explicitly does **not** claim the wallet was or wasn't
     charged here — see "Transaction confirmation" and "Duplicate payment
     prevention" below.

**Not connected (DEMO MODE):** a 1.4s delay, then a `CONFIRMED` simulated
result with `simulated: true`, `purchaserAddress: null`, and a
`SIM-XXXXXX` transaction-hash-shaped string (`crypto.getRandomValues`-based,
not `Math.random`). Every surface that shows this result — the modal (via
`PaymentReceipt.jsx`), the marketplace notice, payment history — labels it
as a simulation; nothing about it is presented as a real transaction.

### Transaction confirmation: why `waitForTransaction()` returns UNKNOWN

Even with a real transaction hash in hand, the skill's own capability table
(`references/nimiq-provider-api.md`) has no confirmation/status-lookup
method at all, and `provider.request()` for anything outside the documented
`WALLET_METHODS` set needs a self-configured RPC endpoint this app does not
provide (Part 23 explicitly forbids inventing one — no invented status
endpoints, RPC methods, URLs, or explorer APIs). `waitForTransaction()`
therefore always resolves `{ status: "UNKNOWN", reason: "..." }` — the
honest report is:

**TRANSACTION CONFIRMATION = UNSUPPORTED** by the currently documented Mini
App provider capabilities, not a gap in this app's implementation.

### Duplicate payment prevention (Parts 24/26)

A `TRANSACTION_STATE.UNKNOWN` result calls
`recordPendingPayment({ productId })` (`LearnerContext.jsx`, persisted in
`learner.pendingPayments`). While a product has a pending entry,
`LearningPaymentModal.jsx` opens straight to a "Payment submitted —
confirmation still needs to be verified" screen instead of the normal
review screen; the only way forward is an explicit "I've checked my
wallet" acknowledgment — there is no automatic status check, because none
exists, and this app will not fabricate one. Pending entries also surface
on the Wallet page. Separately, the Confirm button only ever renders during
the `REVIEW` step (hidden during `AWAITING_APPROVAL`/`SUBMITTED`/`UNKNOWN`),
and `LearningPaymentModal.jsx` additionally guards `handleConfirm()` with a
`submittingRef` so a rapid double-click cannot fire two requests even
before React re-renders the button away.

## 7. Browser behavior

Opening this app in a normal browser tab (not inside Nimiq Pay) is a fully
expected, first-class path, not an error state: `window.nimiq` never
appears, `init()` times out, status settles at `BROWSER_MODE`, and the rest
of the app — AI, ExplainBack, Knowledge Map, ForgetMeNot — works exactly as
it does inside a real Mini App (Part 32). Only the wallet/payment surface
changes: `NimiqWalletStatus.jsx` shows "Open NimiqLearn in Nimiq Pay to
connect your wallet," and `LearningPaymentModal.jsx` runs the DEMO
simulation path described above.

## 8. Android testing

**Real Nimiq Pay / Android testing is BLOCKED in this sandbox** — there is
no Android device and no Nimiq Pay client reachable from this environment.
Chrome desktop is explicitly not treated as equivalent (Part 33). Every
method this integration calls has been verified against the installed SDK
and the official skill, but the end-to-end real-wallet flow itself (account
approval, signing approval, payment approval — all require native Nimiq Pay
dialogs) has not been exercised against an actual Nimiq Pay instance and
must not be reported as tested until it is.

When that environment is available, the skill documents the concrete setup:
- Dev computer and Android device on the same Wi-Fi network; the mini app
  must be reachable at the dev machine's LAN URL, not `localhost` (from
  inside the WebView, `localhost` resolves to the phone, not the dev
  machine).
- Nimiq Pay has a hidden dev menu with a network switch (long-press the
  settings button for 10 seconds): Default / Mainnet / Testnet. The
  testnet switch only affects Nimiq-provider operations, not EVM ones.
- **Use testnet for real payment testing** — the "Get free NIM" button on
  testnet credits 110,000 NIM per request, so an actual `sendBasicTransaction()`
  round-trip can be tested without spending real funds. This is the
  concrete mechanism for Part 37's "small controlled purchase" instruction:
  testnet NIM, not a real recipient with real funds.

## 9. Security

- No private key, seed phrase, mnemonic, secret key, or wallet password is
  ever requested or stored anywhere in this codebase — confirmed by direct
  grep (`privateKey`, `seedPhrase`, `mnemonic`, `secretKey`,
  `walletPassword`, and variants) with zero real-code hits.
- No mock/fake wallet data in production code paths — confirmed by grep
  (`mockWallet`, `demoWallet`, `fakeBalance`, `fakeAddress`,
  `mockTransaction`, `demoTransaction`, `simulatedTransaction`,
  `simulatedPayment`) with zero hits; the one deliberate, clearly-labelled
  exception is the DEMO MODE simulation path in `paymentService.js`, which
  only ever runs when no real wallet is connected and always marks its
  output `simulated: true`.
- Every sensitive action (account access, signing, the payment transaction)
  goes through the real provider's own native confirmation dialog — this
  app never bypasses or suppresses it, consistent with the skill's own
  anti-patterns list ("Do not bypass the approval dialog").
- Approval-dialog UX: confirmation-requiring provider calls
  (`listAccounts`, `sign`, `sendBasicTransaction`) are only ever fired from
  an explicit user action (a button press), never in rapid sequence or on
  page load, per the skill's "Approval dialog UX" guidance.

## 10. NIM support

Real, verified via both the installed package and the official skill:
`listAccounts()`, `sign()`, `isConsensusEstablished()`, `getBlockNumber()`,
`sendBasicTransaction()`.

## 11. USDT status

**Real, not "coming soon" — implemented via Nimiq Pay's own `window.ethereum`.**
The skill confirms Nimiq Pay injects a real EIP-1193 provider (EIP-6963
discoverable) with ERC-20 support across Ethereum, Polygon, Arbitrum, and
Optimism (the skill's own USDT contract-address table — Base and BNB Smart
Chain support other EVM tokens but aren't in that table, so USDT here is
scoped to the four verified chains). `evmWalletService.js` implements:

- `detectEvmProvider()` / `connectEvmWallet()` — same detect-vs-connect
  split as the Nimiq provider, for the same reason (never an approval
  dialog on page load).
- `sendUsdtPayment({ chainKey, recipient, amountUsdt })` — switches chain
  via `wallet_switchEthereumChain` if needed, then a real ERC-20 `transfer`
  call via `eth_sendTransaction`, ABI-encoded with **viem**
  (`encodeFunctionData`/`parseUnits`) — never manually encoded, per the
  skill's explicit rule.

USDT is priced independently per pack (`usdtPrice` in
`mockLearningPacks.js`), never derived from the NIM price via a live
exchange rate — this app has no price oracle and won't fabricate one (same
principle as `getNimBalance()` refusing to guess a balance). A pack only
offers USDT if it sets `usdtPrice`, and the option is only enabled once
`VITE_USDT_LEARNING_RECIPIENT` is configured (see
`src/config/evmPaymentConfig.js`) — otherwise it shows "Coming soon,"
matching NIM's own disabled-until-configured behavior.

## 12. External wallet / EVM roadmap

The native Nimiq and native-EVM (USDT) paths are both now implemented.
**Not implemented**: MetaMask, OKX, Phantom, WalletConnect, or any other
third-party wallet — per the skill's own staging, those are a later,
separate milestone after the native paths (this one) are verified working.
Reference implementation for that later work:
`github.com/Albermonte/evm-mini-wallet` (full EVM wallet mini app), linked
from the skill.

## 13. Known limitations

- **No balance query** — verified absent from both the Nimiq provider's
  documented capability list and its `WALLET_METHODS` set. Displaying one
  would require trusting a third-party RPC endpoint this app doesn't
  configure. Always shown as "Balance unavailable in this Mini App
  provider," never a fabricated number.
- **No transaction confirmation/status lookup** — verified absent from the
  skill's capability table. `waitForTransaction()` always resolves
  `UNKNOWN`; the app requires the learner's own acknowledgment before
  allowing a repeat purchase, rather than guessing or auto-retrying.
- **Real Android/Nimiq Pay testing is BLOCKED** in this sandbox (see
  "Android testing" above) — every acceptance item that requires an actual
  native confirmation dialog is reported BLOCKED for BOTH providers (NIM
  and the new USDT/EVM path), never PASS. `evmWalletService.js` is
  implemented against the skill's documented method signatures and the
  EIP-1193 standard, and verified with Playwright in a plain (non-Nimiq
  Pay) browser — `window.ethereum` correctly absent, EVM wallet card
  correctly shows "Not available," USDT correctly falls back to the DEMO
  simulation path. A real `eth_requestAccounts`/`wallet_switchEthereumChain`/
  `eth_sendTransaction` round-trip against actual Nimiq Pay has not been
  exercised and must not be reported as tested until it is.
- **No third-party wallets** (MetaMask, WalletConnect, etc.) — see
  "External wallet / EVM roadmap" above, a deliberately later milestone.
- `network` (from `provider.getNetwork()`) is always the literal string
  `"nimiq"` — a provider identifier, not mainnet/testnet information. It is
  not surfaced as if it reveals which network the wallet is on.

## 14. Pre-ship checklist (`references/checklist.md`)

Run against this app; failures found and fixed in this pass:

- **FAIL → fixed**: "The app does not trigger approval dialogs on page load
  without user interaction" — see "A real bug caught by the skill's own
  pre-ship checklist" under Provider initialization, above.
- **FAIL → fixed**: "Touch targets are at least 44px" — `NimiqWalletStatus.jsx`'s
  Connect/Disconnect/Sign-in/Retry buttons measured ~36px (`.btn-sm`) in a
  live render; changed to the default button size (~46px, confirmed by
  measurement) for these wallet-critical actions. The primary "Confirm with
  Nimiq Pay" payment button already measured ~46px — no change needed there.
- All other checklist items: PASS (provider error handling, no private key
  access, no approval-dialog bypass, no hardcoded secrets, user rejection
  handled gracefully, no horizontal scrolling at 360/390/414px, confirmation
  calls not fired in rapid sequence).

Re-run against `evmWalletService.js` / `EvmWalletStatus.jsx` when USDT was
added: PASS on every item re-checked at 390px in a live Playwright render —
`detectEvmProvider()` never calls `eth_requestAccounts` on mount (mirrors
the Nimiq-side fix above), no approval-dialog bypass, no hardcoded
addresses (`VITE_USDT_LEARNING_RECIPIENT` unset correctly disables the
option rather than falling back to a placeholder), `EvmWalletStatus.jsx`'s
Connect/Disconnect buttons use the same default (~46px) size as the Nimiq
card, no horizontal scrolling introduced by the new chain selector.

## Testing instructions

**In a normal browser (available in this environment):**
```
npm install
npm run build
npm run preview
```
Open the preview URL. Expect: `NimiqWalletStatus` shows "Not available" /
"Open NimiqLearn in Nimiq Pay to connect your wallet," the
Marketplace/Home/Wallet badges show "DEMO MODE," and (with
`VITE_NIM_LEARNING_RECIPIENT` set — see `.env.example`) completing a
purchase in `LearningPaymentModal` produces a `SIM-XXXXXX`-labelled
simulated unlock; without it, the Marketplace shows a "payments not
configured" banner and the Confirm button is disabled. Append
`#wallet-diagnostics` to the URL (or run
`localStorage.setItem("nimiqlearn:wallet-diagnostics","1")` in the console)
to open the dev panel and confirm `Nimiq Pay detected: NO`.

**Inside a real Nimiq Pay Mini App environment (NOT available in this
sandbox):** deploy to an HTTPS URL and open it via
`nimiqpay://miniapp?url=your-app.com` or
`https://nimpay.app/miniapps/open/your-app.com`, following the skill's
dev-server setup (same-Wi-Fi LAN URL, not `localhost`). Use Nimiq Pay's
testnet dev-menu switch and its free-NIM faucet for a real, no-real-funds
end-to-end payment test. This path is **BLOCKED** here — see "Android
testing" above.
