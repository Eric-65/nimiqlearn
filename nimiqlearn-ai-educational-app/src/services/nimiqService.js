/* ============================================================
   NimiqLearn — Nimiq Pay Mini App integration
   ------------------------------------------------------------
   Real wallet actions go through the official Mini App SDK
   (@nimiq/mini-app-sdk) and the native Nimiq Pay WebView.
   Outside Nimiq Pay we operate in DEMO MODE with explicit,
   clearly-labelled mocks — no fake blockchain data.
   ============================================================ */

const LUNAS_PER_NIM = 1e5;

const KNOWN_EVM_CHAINS = {
  "0x1": { name: "Ethereum", usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  "0x89": { name: "Polygon", usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  "0xa4b1": { name: "Arbitrum One", usdt: null },
  "0xa": { name: "Optimism", usdt: null },
  "0x2105": { name: "Base", usdt: null },
  "0x38": { name: "BNB Smart Chain", usdt: null },
  "0xaa36a7": { name: "Sepolia", usdt: null },
};

let state = {
  mode: "detecting", // 'detecting' | 'miniapp' | 'demo'
  provider: null,
  accounts: [],
  consensus: null,
  blockNumber: null,
  network: "Nimiq",
  evmChainId: null,
  evmChainName: null,
  deviceId: null,
  language: null,
  error: null,
  initialized: false,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function onNimiqState(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getNimiqState() {
  return state;
}

function readHostLanguage() {
  try {
    return window.nimiqPay?.language || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Try to initialize the real Nimiq Pay provider through the SDK.
 * Never throws — it settles into demo mode when unavailable.
 */
export async function initNimiq() {
  if (state.initialized) return state;

  setState({ mode: "detecting", initialized: true });
  const language = readHostLanguage();

  try {
    const { init } = await import("@nimiq/mini-app-sdk");
    const provider = await init({ timeout: 4000 });

    if (!provider || !provider.connected) {
      throw new Error("Nimiq Pay provider not connected");
    }

    const [accounts, consensus, blockNumber] = await Promise.all([
      provider.listAccounts().catch(() => []),
      provider.isConsensusEstablished().catch(() => false),
      provider.getBlockNumber().catch(() => null),
    ]);

    // EVM side (USDT etc.) via the injected window.ethereum
    let evmChainId = null;
    let evmChainName = null;
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        evmChainId = await window.ethereum.request({ method: "eth_chainId" });
        evmChainName = KNOWN_EVM_CHAINS[evmChainId]?.name || `Chain ${evmChainId}`;
      } catch {
        /* EVM optional */
      }
    }

    let deviceId = null;
    try {
      deviceId = await import("@nimiq/mini-app-sdk").then((m) =>
        m.requestDeviceIdentifier({ reason: "Sync your NimiqLearn progress across devices" })
      );
    } catch {
      /* optional */
    }

    setState({
      mode: "miniapp",
      provider,
      accounts,
      consensus,
      blockNumber,
      network: "Nimiq",
      evmChainId,
      evmChainName,
      deviceId,
      language,
      error: null,
    });
  } catch (err) {
    console.warn("[NimiqLearn] Nimiq Pay provider unavailable — switching to DEMO MODE.", err);
    setState({
      mode: "demo",
      provider: null,
      accounts: [],
      consensus: null,
      blockNumber: null,
      evmChainId: null,
      evmChainName: null,
      deviceId: null,
      language,
      error: err?.message || "Provider unavailable",
    });
  }

  return state;
}

/* ---------------- Real wallet actions (Mini App mode) ---------------- */

/**
 * Real NIM payment through Nimiq Pay's native confirmation dialog.
 * Returns the provider's signed & submitted transaction reference.
 */
export async function sendNimPayment({ recipient, valueNim }) {
  if (state.mode !== "miniapp" || !state.provider) {
    throw new Error("Nimiq Pay provider is not available in this environment.");
  }
  const valueLunas = Math.round(Number(valueNim) * LUNAS_PER_NIM);
  const serialized = await state.provider.sendBasicTransaction({
    recipient,
    value: valueLunas,
  });
  return {
    simulated: false,
    provider: "Nimiq Pay",
    asset: "NIM",
    valueLunas,
    serialized: typeof serialized === "string" ? serialized : JSON.stringify(serialized),
  };
}

/**
 * EVM payment (e.g. USDT) through window.ethereum when a known
 * chain with a USDT address is detected. Never hard-coded to an
 * unsupported chain — if the chain is unknown we refuse.
 */
export async function sendEvmPayment({ recipient, amount, asset }) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("EVM provider not available.");
  }
  const chain = KNOWN_EVM_CHAINS[state.evmChainId];
  if (!chain || !chain.usdt) {
    throw new Error(`USDT is not configured for chain ${state.evmChainName || state.evmChainId}.`);
  }
  if (asset !== "USDT") {
    throw new Error(`Unsupported EVM asset: ${asset}`);
  }
  const [from] = await window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => []);
  if (!from) throw new Error("No EVM account available.");

  const usdtDecimals = 6;
  const rawAmount = BigInt(Math.round(Number(amount) * 10 ** usdtDecimals));
  const data =
    "0xa9059cbb" + // transfer(address,uint256)
    pad64(recipient) +
    pad64(rawAmount.toString(16));

  const txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to: chain.usdt, data }],
  });
  return { simulated: false, provider: "Nimiq Pay EVM", asset, txHash, chain: chain.name };
}

function pad64(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.padStart(64, "0");
}

/* ---------------- Demo helpers (explicitly mocked) ---------------- */

export function isDemoMode() {
  return state.mode === "demo";
}

export function isMiniAppMode() {
  return state.mode === "miniapp";
}

export function detectSupportedAssets() {
  const assets = [{ asset: "NIM", network: "Nimiq", real: true }];
  const chain = KNOWN_EVM_CHAINS[state.evmChainId];
  if (state.mode === "miniapp" && typeof window !== "undefined" && window.ethereum && chain?.usdt) {
    assets.push({ asset: "USDT", network: chain.name, real: true });
  } else {
    assets.push({ asset: "USDT", network: "EVM (when supported)", real: false });
  }
  return assets;
}
