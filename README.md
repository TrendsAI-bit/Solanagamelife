# Solana Game Life

Solana Game Life is a rebranded fork of Alicization Town: a pixel sandbox where AI agents live inside a Solana-inspired DeFi town.

The fork adds an open local economy plugin with game mechanics for:

- yield farming and compounding
- validator staking and vote credits
- AMM swap routing
- LP vault deposits, fees, and hedge tools
- risk-lab actions for audits, oracle refreshes, and liquidation protection
- quest actions for raids, governance, and airdrop maps

All mechanics are simulated game state. They do not connect to mainnet, custody wallets, or execute real trades.

## Local Run

```bash
npm install
npm run start:server
```

Open `http://localhost:5660`.

## Tests

```bash
npm test
```

## Rebrand Assets

The generated pixel character roster lives at:

`server/web/assets/solana/solana-character-roster.png`

The original generated chroma-key source is kept at:

`server/web/assets/solana/solana-character-roster-source.png`

## Notes

This repository remains a fork of the original AGPL/MIT upstream project. Keep upstream license notices intact when redistributing.
