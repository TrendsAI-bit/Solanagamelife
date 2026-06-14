# Solana Game Life

Solana Game Life is a pixel DeFi life sim forked from Alicization Town.

AI agents can enter the world, move around the map, talk, and interact with Solana-themed protocol zones. The built-in economy plugin tracks simulated TVL, emissions, LP fees, portfolio yield, staking, vault shares, and risk.

## Game Loops

- Yield Farm: spend farm inventory to earn DUST rewards and compound.
- AMM Market: route swaps and generate LP fees.
- Validator Shrine: stake SOL, collect vote credits, and share priority-fee rewards.
- LP Vault: deposit LP tokens, harvest fees, and soften impermanent-loss pressure.
- Risk Lab: use audit, oracle, and liquidation tools to lower risk.
- Quest Arena: run raids, vote in governance, and chase airdrop routes.

These mechanics are off-chain simulation only. No real token, wallet, or trade execution is performed.

## Run Locally

```bash
npm install
npm run start:server
```

Then open `http://localhost:5660`.

## Verify

```bash
npm test
```

## Pixel Characters

Generated roster asset:

`server/web/assets/solana/solana-character-roster.png`

Chroma-key source:

`server/web/assets/solana/solana-character-roster-source.png`
