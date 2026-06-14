const { IPlugin } = require('@alicization/core-interfaces');
const worldEngine = require('../engine/world-engine');

const ZONE_DEFS = {
  farm: {
    label: 'Yield Farm',
    resources: {
      sol_seed: { dailyMax: 12, label: 'SOL Seeds', unit: 'bags', icon: 'Honey' },
      ray_fertilizer: { dailyMax: 8, label: 'RAY Fertilizer', unit: 'sacks', icon: 'LifePot' },
      compost_boost: { dailyMax: 6, label: 'Compost Boost', unit: 'vials', icon: 'WaterPot' },
    },
    interactions: {
      sol_seed: { action: 'planted SOL yield seeds', result: 'A fresh crop position starts earning emissions. The field hums with tiny validator lights.', icon: 'Honey', sound: 'interact' },
      ray_fertilizer: { action: 'boosted a farm with RAY fertilizer', result: 'The farm multiplier ticks upward, but the player keeps an eye on reward dilution.', icon: 'LifePot', sound: 'magic' },
      compost_boost: { action: 'compounded a compost boost', result: 'Rewards roll back into the farm and the next harvest gets a modest APY lift.', icon: 'WaterPot', sound: 'heal' },
    },
  },
  marketplace: {
    label: 'AMM Market',
    resources: {
      sol_usdc_swap: { dailyMax: 10, label: 'SOL/USDC Swap', unit: 'orders', icon: 'GoldCoin' },
      bonk_route: { dailyMax: 7, label: 'BONK Route', unit: 'routes', icon: 'FortuneCookie' },
      limit_ticket: { dailyMax: 5, label: 'Limit Ticket', unit: 'tickets', icon: 'Billboard' },
    },
    interactions: {
      sol_usdc_swap: { action: 'routed a SOL/USDC swap', result: 'The trade clears through the town AMM and adds fee flow to local LPs.', icon: 'GoldCoin', sound: 'interact' },
      bonk_route: { action: 'tested a BONK route', result: 'The quote is spicy, the slippage is contained, and the trader banks a tiny routing rebate.', icon: 'FortuneCookie', sound: 'chat' },
      limit_ticket: { action: 'posted a limit order ticket', result: 'The order rests on the board, waiting for volatility to wander into range.', icon: 'Billboard', sound: 'interact' },
    },
  },
  shrine: {
    label: 'Validator Shrine',
    resources: {
      stake_ticket: { dailyMax: 9, label: 'Stake Tickets', unit: 'tickets', icon: 'GoldKey' },
      vote_credit: { dailyMax: 7, label: 'Vote Credits', unit: 'credits', icon: 'Heart' },
      jito_tip: { dailyMax: 4, label: 'Jito Tips', unit: 'tips', icon: 'GoldCoin' },
    },
    interactions: {
      stake_ticket: { action: 'delegated stake at the validator shrine', result: 'Stake locks in and begins earning steady epoch rewards.', icon: 'GoldKey', sound: 'magic' },
      vote_credit: { action: 'claimed validator vote credits', result: 'The validator lands its votes cleanly and reputation climbs.', icon: 'Heart', sound: 'magic' },
      jito_tip: { action: 'shared a Jito tip bundle', result: 'Priority fees sparkle through the shrine as MEV rewards settle into the treasury.', icon: 'GoldCoin', sound: 'magic' },
    },
  },
  warehouse: {
    label: 'LP Vault',
    resources: {
      lp_token: { dailyMax: 8, label: 'LP Tokens', unit: 'shares', icon: 'GoldCoin' },
      hedge_scroll: { dailyMax: 5, label: 'Hedge Scrolls', unit: 'scrolls', icon: 'GoldKey' },
      fee_crate: { dailyMax: 6, label: 'Fee Crates', unit: 'crates', icon: 'Billboard' },
    },
    interactions: {
      lp_token: { action: 'deposited LP tokens into the vault', result: 'The vault mints shares and starts harvesting swap fees.', icon: 'GoldCoin', sound: 'interact' },
      hedge_scroll: { action: 'balanced impermanent loss with a hedge scroll', result: 'The position is safer, though upside gets trimmed a little.', icon: 'GoldKey', sound: 'magic' },
      fee_crate: { action: 'opened an LP fee crate', result: 'Accumulated fees spill into the treasury and nudge yield higher.', icon: 'Billboard', sound: 'interact' },
    },
  },
  potion: {
    label: 'Risk Lab',
    resources: {
      audit_potion: { dailyMax: 5, label: 'Audit Potion', unit: 'vials', icon: 'LifePot' },
      oracle_serum: { dailyMax: 5, label: 'Oracle Serum', unit: 'vials', icon: 'WaterPot' },
      liquidation_antidote: { dailyMax: 4, label: 'Liquidation Antidote', unit: 'vials', icon: 'MilkPot' },
    },
    interactions: {
      audit_potion: { action: 'ran an audit potion through the farm contracts', result: 'A dusty approval bug gets patched before it can bite the treasury.', icon: 'LifePot', sound: 'magic' },
      oracle_serum: { action: 'refreshed oracle serum', result: 'Prices snap back into line and leverage traders breathe again.', icon: 'WaterPot', sound: 'magic' },
      liquidation_antidote: { action: 'brewed liquidation antidote', result: 'Risk buffers rise and the town avoids a messy cascade.', icon: 'MilkPot', sound: 'heal' },
    },
  },
  practice: {
    label: 'Quest Arena',
    resources: {
      raid_pass: { dailyMax: 8, label: 'Raid Passes', unit: 'passes', icon: 'Sword' },
      governance_badge: { dailyMax: 6, label: 'Governance Badges', unit: 'badges', icon: 'Katana' },
      airdrop_map: { dailyMax: 4, label: 'Airdrop Maps', unit: 'maps', icon: 'Bow' },
    },
    interactions: {
      raid_pass: { action: 'cleared a liquidity raid', result: 'The raid drops protocol XP and a small emission bonus.', icon: 'Sword', sound: 'interact' },
      governance_badge: { action: 'voted with a governance badge', result: 'The town DAO approves a safer reward schedule.', icon: 'Katana', sound: 'chat' },
      airdrop_map: { action: 'followed an airdrop map', result: 'A hidden claim route appears near the market maker stalls.', icon: 'Bow', sound: 'interact' },
    },
  },
};

const CATEGORY_PATTERNS = [
  [/farm|农场|grass|草丛|tree|树/i, 'farm'],
  [/market|集市/i, 'marketplace'],
  [/shrine|神社/i, 'shrine'],
  [/warehouse|仓库/i, 'warehouse'],
  [/potion|magic|药水|魔药/i, 'potion'],
  [/practice|练习/i, 'practice'],
];

const inventories = new Map();
const portfolio = new Map();
const walletAgents = new Map();
const agentTargets = new Map();
const GATEKEEPER_IDS = ['npc_elder_chen', 'npc_samurai_lin', 'npc_princess_lily'];
let treasury = {
  tvl: 42690,
  rewardsPerHour: 128,
  lpFees: 314,
  risk: 18,
  solPrice: 142,
  treasurePool: 6900,
  lastEvent: 'Genesis liquidity seeded',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inferCategory(zoneName) {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(zoneName || '')) return category;
  }
  return null;
}

function getZoneId(zone, category) {
  const raw = `${category}:${zone.name || 'zone'}:${Math.round(zone.x || 0)}:${Math.round(zone.y || 0)}`;
  return raw.toLowerCase().replace(/[^a-z0-9:]+/g, '-');
}

function cloneResource(res) {
  return {
    current: res.current,
    dailyMax: res.dailyMax,
    label: res.label,
    unit: res.unit,
    icon: res.icon,
  };
}

function getInventory(zoneId, category, zoneName) {
  let inventory = inventories.get(zoneId);
  const def = ZONE_DEFS[category];
  if (!def) return null;
  if (!inventory) {
    inventory = { category, zoneName, resources: {}, lastResetDate: today() };
    for (const [key, res] of Object.entries(def.resources)) {
      inventory.resources[key] = { ...res, current: res.dailyMax };
    }
    inventories.set(zoneId, inventory);
  }
  if (inventory.lastResetDate !== today()) {
    for (const [key, res] of Object.entries(def.resources)) {
      inventory.resources[key].current = res.dailyMax;
    }
    inventory.lastResetDate = today();
  }
  return inventory;
}

function serializeInventory(zoneId, inv) {
  const resources = {};
  for (const [key, res] of Object.entries(inv.resources)) {
    resources[key] = cloneResource(res);
  }
  return { zoneId, category: inv.category, zoneName: inv.zoneName, resources };
}

function discoverInventories(worldEngine) {
  const worldMap = worldEngine.getWorldMap();
  const zoneLayer = worldMap?.layers?.find((layer) => layer.name === 'SemanticZones' || layer.type === 'objectgroup');
  const result = {};
  for (const zone of zoneLayer?.objects || []) {
    const category = inferCategory(zone.name);
    if (!category) continue;
    const zoneId = getZoneId(zone, category);
    result[zoneId] = serializeInventory(zoneId, getInventory(zoneId, category, zone.name));
  }
  return result;
}

function chooseResource(inv, requested) {
  if (requested && inv.resources[requested]) return requested;
  const available = Object.entries(inv.resources).filter(([, res]) => res.current > 0);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)][0];
}

function getPlayerPortfolio(playerId, playerName) {
  let state = portfolio.get(playerId);
  if (!state) {
    state = {
      playerId,
      name: playerName,
      stakedSol: 2.5,
      lpShares: 1.2,
      claimable: 0,
      protocolXp: 0,
      riskScore: 20,
      mode: 'normal',
      treasureClues: 0,
      mineAttempts: 0,
      treasureShards: 0,
    };
    portfolio.set(playerId, state);
  }
  if (playerName) state.name = playerName;
  return state;
}

function applyEconomy(category, resourceKey, playerId, playerName) {
  const state = getPlayerPortfolio(playerId, playerName);
  const beforeClaimable = state.claimable;
  const reward = {
    farm: 22,
    marketplace: 11,
    shrine: 16,
    warehouse: 18,
    potion: 6,
    practice: 14,
  }[category] || 8;

  state.claimable += reward;
  state.protocolXp += Math.round(reward * 1.4);
  if (category === 'shrine') state.stakedSol += 0.15;
  if (category === 'warehouse') state.lpShares += 0.2;
  if (category === 'potion') state.riskScore = Math.max(4, state.riskScore - 7);
  else state.riskScore = Math.min(100, state.riskScore + 2);

  treasury.tvl += reward * 9;
  treasury.rewardsPerHour += Math.max(1, Math.round(reward / 4));
  treasury.lpFees += category === 'marketplace' || category === 'warehouse' ? reward : 3;
  treasury.risk = Math.max(4, Math.min(100, Math.round((treasury.risk * 0.82) + (state.riskScore * 0.18))));
  treasury.lastEvent = `${playerName} used ${resourceKey.replace(/_/g, ' ')} (+${Math.round(state.claimable - beforeClaimable)} DUST)`;
  return state;
}

function summarizePortfolio(state) {
  return {
    name: state.name,
    playerId: state.playerId,
    stakedSol: Number(state.stakedSol.toFixed(2)),
    lpShares: Number(state.lpShares.toFixed(2)),
    claimable: Math.round(state.claimable),
    sglYield: Math.round(state.claimable),
    protocolXp: state.protocolXp,
    riskScore: state.riskScore,
    mode: state.mode || 'normal',
    treasureClues: state.treasureClues || 0,
    mineAttempts: state.mineAttempts || 0,
    treasureShards: state.treasureShards || 0,
  };
}

function walletHash(input) {
  let hash = 2166136261;
  for (const ch of String(input || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function walletAgentId(wallet) {
  return `wallet_agent_${walletHash(wallet).toString(16).padStart(8, '0')}`;
}

function walletAlias(wallet, pet) {
  const prefixes = {
    codex: 'Codex Pet',
    claude: 'Claude Pet',
    generated: 'SGL Agent',
  };
  const suffix = String(wallet || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || '0000';
  return `${prefixes[pet] || prefixes.generated} ${suffix}`;
}

function normalizeMode(mode) {
  return mode === 'adventure' ? 'adventure' : 'normal';
}

function getNavigableProtocolZones(worldEngine) {
  const worldMap = worldEngine.getWorldMap();
  const layer = worldMap?.layers?.find((l) => l.name === 'SemanticZones' || l.type === 'objectgroup');
  return (layer?.objects || [])
    .map((zone) => ({ zone, category: inferCategory(zone.name) }))
    .filter((entry) => entry.category && ZONE_DEFS[entry.category])
    .map(({ zone, category }) => ({
      name: zone.name,
      category,
      x: Math.round((zone.x || 0) / 32),
      y: Math.round((zone.y || 0) / 32),
    }));
}

function chooseAgentTarget(agentId, worldEngine) {
  const zones = getNavigableProtocolZones(worldEngine);
  if (!zones.length) return null;
  const seed = walletHash(`${agentId}:${Date.now()}`);
  return zones[seed % zones.length];
}

class SolanaEconomyPlugin extends IPlugin {
  constructor() {
    super();
    this.agentTimer = null;
  }

  get id() { return '@solana-game-life/economy'; }
  get version() { return '1.0.0'; }

  async onRegister(ctx) {
    for (const [, category] of CATEGORY_PATTERNS) {
      ctx.registerZoneMatcher(CATEGORY_PATTERNS.find((entry) => entry[1] === category)[0], category);
      ctx.registerInteractionType(category, 'building');
      ctx.registerInteractionHook(category, ({ playerId, playerName, isNPC, zone, item }) => {
        if (!zone) return null;
        const resolvedCategory = inferCategory(zone.name);
        if (!resolvedCategory || !ZONE_DEFS[resolvedCategory]) return null;
        if (isNPC) {
          return { action: 'audited the protocol board', result: 'NPCs watch the economy loop without consuming vault inventory.', icon: 'Billboard', sound: 'chat' };
        }
        const zoneId = getZoneId(zone, resolvedCategory);
        const inv = getInventory(zoneId, resolvedCategory, zone.name);
        const resourceKey = chooseResource(inv, item);
        if (!resourceKey) {
          return { action: 'checked empty liquidity', result: `${ZONE_DEFS[resolvedCategory].label} is depleted. Refill this zone from the web panel.`, icon: 'GoldCoin', sound: 'interact' };
        }
        inv.resources[resourceKey].current -= 1;
        const state = applyEconomy(resolvedCategory, resourceKey, playerId, playerName);
        ctx.emitActivity({
          id: playerId,
          name: playerName,
          text: `Portfolio: ${Math.round(state.claimable)} DUST claimable, ${state.stakedSol.toFixed(2)} SOL staked, ${state.lpShares.toFixed(2)} LP shares`,
          type: 'defi',
        });
        return ZONE_DEFS[resolvedCategory].interactions[resourceKey];
      });
    }

    ctx.registerRoute('get', '/rpg/zones/resources', (req, res) => {
      res.json(discoverInventories(req.app.locals.worldEngine));
    }, { requireSession: false });

    ctx.registerRoute('post', '/rpg/zones/:zoneId/supply', (req, res) => {
      const { zoneId } = req.params;
      const { resourceType, amount } = req.body || {};
      const inv = inventories.get(zoneId);
      if (!inv || !inv.resources[resourceType]) return res.status(404).json({ success: false, error: 'Unknown liquidity inventory' });
      const delta = Math.max(1, Math.min(Number(amount) || 1, 10));
      const resDef = inv.resources[resourceType];
      resDef.current = Math.min(resDef.dailyMax + 20, resDef.current + delta);
      res.json({
        success: true,
        current: resDef.current,
        message: `Added ${delta} ${resDef.unit} of ${resDef.label}`,
      });
    }, { requireSession: false });

    ctx.registerRoute('get', '/solana/economy', (req, res) => {
      const players = Array.from(portfolio.values()).map(summarizePortfolio);
      res.json({
        treasury: {
          tvl: Math.round(treasury.tvl),
          rewardsPerHour: Math.round(treasury.rewardsPerHour),
          lpFees: Math.round(treasury.lpFees),
          risk: treasury.risk,
          solPrice: treasury.solPrice,
          treasurePool: Math.round(treasury.treasurePool),
          lastEvent: treasury.lastEvent,
        },
        players,
      });
    }, { requireSession: false });

    ctx.registerRoute('post', '/solana/agent/spawn', (req, res) => {
      const { wallet, pet = 'generated', mode = 'normal' } = req.body || {};
      if (!wallet || String(wallet).trim().length < 4) {
        return res.status(400).json({ success: false, error: 'Add a wallet name or address first.' });
      }
      const cleanWallet = String(wallet).trim().slice(0, 80);
      const petType = ['generated', 'codex', 'claude'].includes(pet) ? pet : 'generated';
      const playMode = normalizeMode(mode);
      const playerId = walletAgentId(cleanWallet);
      const name = walletAlias(cleanWallet, petType);
      const sprite = ['Boy', 'FighterRed', 'Monk', 'Princess'][walletHash(cleanWallet) % 4];
      const player = req.app.locals.worldEngine.join(playerId, name, sprite, { trackActivity: true });
      walletAgents.set(playerId, { wallet: cleanWallet, pet: petType, mode: playMode, createdAt: Date.now() });
      const state = getPlayerPortfolio(playerId, name);
      state.pet = petType;
      state.mode = playMode;
      req.app.locals.worldEngine.recordPluginActivity(
        playerId,
        playMode === 'adventure'
          ? `Booted ${name} in Adventure Mine mode. Hunting map clues and simulated treasure shards.`
          : `Booted ${name} in Normal Work mode. Building farms, reading books, and growing SGL yield.`,
        'defi'
      );
      res.json({
        success: true,
        agent: {
          id: playerId,
          name,
          pet: petType,
          mode: playMode,
          sprite,
          x: player.x,
          y: player.y,
          sglYield: Math.round(state.claimable),
          portfolio: summarizePortfolio(state),
        },
      });
    }, { requireSession: false });

    ctx.registerRoute('get', '/solana/agent/:agentId/yield', (req, res) => {
      const state = getPlayerPortfolio(req.params.agentId, walletAgents.get(req.params.agentId)?.name);
      res.json({ success: true, portfolio: summarizePortfolio(state) });
    }, { requireSession: false });

    this.agentTimer = setInterval(async () => {
      const players = worldEngine.getAllPlayers();
      const activeAgents = new Set([...GATEKEEPER_IDS, ...walletAgents.keys()]);
      for (const agentId of activeAgents) {
        const player = players[agentId];
        if (!player) continue;
        const walletMeta = walletAgents.get(agentId);
        const mode = walletMeta?.mode || 'normal';
        let target = agentTargets.get(agentId);
        if (!target || (Math.abs(player.x - target.x) <= 1 && Math.abs(player.y - target.y) <= 1)) {
          if (target && walletAgents.has(agentId)) {
            worldEngine.interact(agentId, null);
            const state = getPlayerPortfolio(agentId, player.name);
            state.mode = mode;
            if (mode === 'adventure') {
              state.mineAttempts += 1;
              state.riskScore = Math.min(100, state.riskScore + 4);
              state.claimable += 3;
              state.protocolXp += 8;
              state.treasureClues += Math.random() < 0.35 ? 1 : 0;
              treasury.treasurePool += 7;
              const hit = Math.random() < 0.00001;
              if (hit) {
                state.treasureShards += 1;
                state.claimable += 777;
                treasury.treasurePool = Math.max(0, treasury.treasurePool - 777);
                treasury.lastEvent = `${player.name} found a legendary simulated treasure shard (+777 SGL)`;
                worldEngine.recordPluginActivity(agentId, 'Found a legendary simulated treasure shard and banked 777 SGL.', 'defi');
              } else {
                treasury.lastEvent = `${player.name} mined a risky map vein (+3 SGL)`;
                worldEngine.recordPluginActivity(agentId, `Adventure mine attempt ${state.mineAttempts}: found clue dust and +3 SGL.`, 'defi');
              }
            }
          }
          target = chooseAgentTarget(agentId, worldEngine);
          if (target) {
            agentTargets.set(agentId, target);
            worldEngine.recordPluginActivity(
              agentId,
              mode === 'adventure'
                ? `Following a treasure-map route through ${ZONE_DEFS[target.category].label}`
                : `Routing to ${ZONE_DEFS[target.category].label} for farm, book, and SGL work`,
              'defi'
            );
          }
        }
        if (target) {
          await worldEngine.move(agentId, { x: target.x, y: target.y });
        }
      }
    }, 7_000);
    if (typeof this.agentTimer.unref === 'function') this.agentTimer.unref();
  }

  async onUnregister() {
    if (this.agentTimer) clearInterval(this.agentTimer);
  }
}

module.exports = SolanaEconomyPlugin;
