/* ============================================================
   NimiqLearn — supported EVM chains and USDT contract addresses
   ------------------------------------------------------------
   Straight from the official Nimiq Mini Apps skill's
   references/chains-and-tokens.md — nothing here is guessed.
   Nimiq Pay injects window.ethereum with USDT support across
   these chains; Base and BNB Smart Chain are also supported
   EVM chains for other tokens, but the skill's own USDT address
   table only lists these four, so USDT payments are scoped to
   them until a further-verified address is available.
   ============================================================ */

export const EVM_CHAINS = {
  polygon: {
    chainId: "0x89",
    name: "Polygon",
    usdt: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  },
  ethereum: {
    chainId: "0x1",
    name: "Ethereum",
    usdt: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  },
  arbitrum: {
    chainId: "0xa4b1",
    name: "Arbitrum One",
    usdt: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  },
  optimism: {
    chainId: "0xa",
    name: "Optimism",
    usdt: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
  },
};

// Polygon first: lowest gas cost for a stablecoin transfer among the four
// supported chains, so it's the sane default rather than an arbitrary one.
export const DEFAULT_USDT_CHAIN = "polygon";
