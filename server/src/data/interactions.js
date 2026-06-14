const ZONE_INTERACTIONS = {
  building: {
    restaurant: [
      { action: 'read a yield recipe book', result: 'The book compares steady farm routes with risky treasure-map runs.', icon: 'FortuneCookie', sound: 'chat' },
      { action: 'shared a trader meal', result: 'A warm bowl and a clean route map restore the agent before the next protocol loop.', icon: 'Noodle', sound: 'interact' },
    ],
    inn: [
      { action: 'rested at the agent hub', result: 'The agent recovers stamina and reviews yesterday\'s SGL yield.', icon: 'Heart', sound: 'heal' },
      { action: 'checked the traveler board', result: 'Someone pinned a clue: "Books before mines. Maps before risk."', icon: 'GoldKey', sound: 'interact' },
    ],
    weapon: [
      { action: 'calibrated mining gear', result: 'The gear is only for simulated Adventure Mine runs. Risk stays high.', icon: 'Sword', sound: 'interact' },
      { action: 'balanced the risk kit', result: 'The agent prepares for dangerous map routes without overexposing the wallet.', icon: 'Katana', sound: 'interact' },
    ],
    potion: [
      { action: 'mixed an audit serum', result: 'The serum highlights suspicious approvals and lowers protocol risk.', icon: 'LifePot', sound: 'magic' },
      { action: 'studied an oracle vial', result: 'Price feeds sparkle into alignment. The map reveals a faint treasure route.', icon: 'WaterPot', sound: 'magic' },
    ],
    practice: [
      { action: 'ran a quest drill', result: 'The agent earns route XP and learns when not to chase a risky mine.', icon: 'Sword', sound: 'interact' },
      { action: 'read an old strategy book', result: 'The margin note says steady farms win often; adventure mines win rarely.', icon: 'Billboard', sound: 'chat' },
    ],
    warehouse: [
      { action: 'sorted LP vault crates', result: 'A fee crate gets indexed and the vault route grows more efficient.', icon: 'GoldCoin', sound: 'interact' },
      { action: 'found a faded treasure map', result: 'The map points toward a risky mine vein, but the safer path still earns SGL.', icon: 'GoldKey', sound: 'interact' },
    ],
    shrine: [
      { action: 'checked validator votes', result: 'Clean votes add confidence to the town economy.', icon: 'Heart', sound: 'magic' },
      { action: 'decoded a shrine glyph', result: 'The glyph says every treasure hunt starts with patience.', icon: 'GoldKey', sound: 'interact' },
    ],
    farm: [
      { action: 'built a yield farm row', result: 'The farm starts producing steady SGL emissions.', icon: 'Honey', sound: 'interact' },
      { action: 'compounded farm rewards', result: 'Rewards roll back into the farm and the agent smiles at the curve.', icon: 'WaterPot', sound: 'heal' },
    ],
    blacksmith: [
      { action: 'forged a mining pass', result: 'The pass is stamped for simulated Adventure Mine mode only.', icon: 'Katana', sound: 'interact' },
      { action: 'repaired protocol tools', result: 'Clean tools make normal work faster and safer.', icon: 'Sword', sound: 'interact' },
    ],
    dock: [
      { action: 'scanned the liquidity dock', result: 'Swap routes ripple across the water like neon fish.', icon: 'Fish', sound: 'interact' },
      { action: 'checked a cargo manifest', result: 'The manifest lists books, maps, vault parts, and one suspicious mining beacon.', icon: 'Billboard', sound: 'chat' },
    ],
    watchtower: [
      { action: 'surveyed the protocol map', result: 'From above, the farm, vault, library, and mine routes form a hidden pattern.', icon: 'Bow', sound: 'interact' },
      { action: 'marked a treasure clue', result: 'The clue is useful, but the agent still needs more SGL work.', icon: 'GoldKey', sound: 'interact' },
    ],
    hotspring: [
      { action: 'recovered from risk', result: 'Warm water clears the agent\'s mind after a tense mine route.', icon: 'Heart', sound: 'heal' },
      { action: 'bottled mineral water', result: 'The water becomes a small boost for the next farm cycle.', icon: 'WaterPot', sound: 'interact' },
    ],
    marketplace: [
      { action: 'routed a market swap', result: 'The swap clears cleanly and sends simulated fees to the LP pool.', icon: 'GoldCoin', sound: 'interact' },
      { action: 'priced a treasure shard', result: 'The shard is only simulated, but the market loves the story.', icon: 'FortuneCookie', sound: 'chat' },
    ],
  },
  nature: {
    tree: [
      { action: 'read a bark-carved clue', result: 'The clue points to books, then farms, then the risky mine.', icon: 'Honey', sound: 'heal' },
      { action: 'scouted from the canopy', result: 'The agent spots a safer route between the vault and the farm.', icon: 'Bow', sound: 'interact' },
    ],
    pond: [
      { action: 'watched oracle ripples', result: 'The water reflects a possible treasure path, then hides it again.', icon: 'WaterPot', sound: 'heal' },
      { action: 'caught a data fish', result: 'The fish carries a tiny routing rebate in its scales.', icon: 'Fish', sound: 'interact' },
    ],
    grassland: [
      { action: 'searched the grass for map scraps', result: 'The agent finds clue dust and a calm place to plan.', icon: 'Honey', sound: 'interact' },
      { action: 'rested under the neon sky', result: 'Normal work feels safer after looking at the mine route.', icon: 'Heart', sound: 'heal' },
    ],
  },
  floor: {
    paved: [
      { action: 'checked the protocol road', result: 'The road connects farms, books, vaults, and risky treasure routes.', icon: 'GoldCoin', sound: 'interact' },
    ],
  },
  landmark: {
    billboard: [
      { action: 'read the protocol billboard', result: 'Welcome to Solana Game Life: farm SGL, read books, build vaults, or choose Adventure Mine for simulated treasure hunting.', icon: 'FortuneCookie', sound: 'interact' },
      { action: 'checked the mode board', result: 'Normal Work is steady. Adventure Mine is risky and simulated. No real cash payout is promised.', icon: 'GoldKey', sound: 'interact' },
    ],
  },
};

const ZONE_CATEGORY_MAP = [
  [/noodle|restaurant|面馆/, 'restaurant'], [/inn|旅馆/, 'inn'],
  [/weapon|armor|武器/, 'weapon'], [/potion|magic|药水/, 'potion'],
  [/practice|练习|library|book/, 'practice'], [/warehouse|仓库/, 'warehouse'],
  [/shrine|神社/, 'shrine'], [/farm|农场/, 'farm'],
  [/blacksmith|铁匠/, 'blacksmith'], [/dock|码头/, 'dock'],
  [/watchtower|瞭望/, 'watchtower'], [/hot\s?spring|温泉/, 'hotspring'],
  [/market|集市/, 'marketplace'], [/tree|树/, 'tree'],
  [/pond|池塘/, 'pond'], [/grass|草/, 'grassland'],
  [/paved|石板/, 'paved'],
  [/billboard|告示牌/, 'billboard'],
];

module.exports = { ZONE_INTERACTIONS, ZONE_CATEGORY_MAP };
