// NPC 角色配置
// 定义常驻 NPC 的身份、外观、性格与行为参数
//
// AI NPC 配置说明:
//   aiEnabled: true - 启用 AI 驱动行为
//   strategy: 'ai/autonomous' - 使用 AI 自主决策策略
//   personality: 对应提示词模板中的性格类型
//
// 环境变量:
//   AI_PROVIDER=openai|claude
//   OPENAI_API_KEY / ANTHROPIC_API_KEY

const NPC_PROFILES = [
  {
    id: 'npc_elder_chen',
    name: 'Yield Farmer',
    sprite: 'Boy',
    personality: 'friendly',
    spawnX: 14,
    spawnY: 12,
    // AI 驱动 NPC
    aiEnabled: true,
    strategy: 'ai/autonomous',
    // 行为权重：决定每次行动时选择各动作的概率（fallback 时使用）
    behaviorWeights: { wander: 0.3, chat: 0.4, interact: 0.2, idle: 0.1 },
    // 行动间隔范围（毫秒）
    actionIntervalMin: 4000,
    actionIntervalMax: 8000,
    // 漫步参数
    wanderStepsMin: 1,
    wanderStepsMax: 5,
    // 聊天语料：空闲时随机说的话（fallback 时使用）
    idleChats: [
      'The farm emissions look healthy today.',
      'Welcome to Solana Game Life. Keep your yield high and your risk contained.',
      'New wallet? Start with staking, then try the LP vault.',
      'The market route is busiest when volatility wakes up.',
      'The validator shrine has fresh vote credits today.',
      'I have watched many epochs pass here. Ask me about farms, swaps, or vaults.',
      'The market has fresh liquidity tickets if you want to route a trade.',
    ],
    // 看到附近玩家时的问候语（fallback 时使用）
    greetings: [
      'Hey there, new wallet. Need a route?',
      'Fresh agent on-chain. Welcome.',
      'Another strategist joins the protocol.',
      'Passing through? Sit down and compare yields.',
    ],
  },
  {
    id: 'npc_samurai_lin',
    name: 'LP Vault Engineer',
    sprite: 'FighterRed',
    personality: 'stoic',
    spawnX: 30,
    spawnY: 25,
    // AI 驱动 NPC
    aiEnabled: true,
    strategy: 'ai/autonomous',
    behaviorWeights: { wander: 0.5, chat: 0.1, interact: 0.3, idle: 0.1 },
    actionIntervalMin: 3000,
    actionIntervalMax: 6000,
    wanderStepsMin: 2,
    wanderStepsMax: 8,
    idleChats: [
      '……',
      'A good validator is quiet, fast, and consistent.',
      'No oracle drift nearby.',
      'Patrolling risk is the validator way.',
      'The quest arena needs fresh raid passes.',
    ],
    greetings: [
      '嗯。',
      'Mind your slippage.',
      '有事吗？',
    ],
  },
  {
    id: 'npc_princess_lily',
    name: 'Validator Monk',
    sprite: 'Monk',
    personality: 'curious',
    spawnX: 20,
    spawnY: 8,
    // AI 驱动 NPC
    aiEnabled: true,
    strategy: 'ai/autonomous',
    behaviorWeights: { wander: 0.4, chat: 0.3, interact: 0.25, idle: 0.05 },
    actionIntervalMin: 3000,
    actionIntervalMax: 7000,
    wanderStepsMin: 1,
    wanderStepsMax: 6,
    idleChats: [
      'That liquidity glow is so pretty.',
      'I wonder what the next airdrop route unlocks.',
      'I want to see how the LP vault compounds fees.',
      'The risk lab makes the strangest potions.',
      'Today I am exploring every protocol zone.',
      'Oh, another agent. I should ask about their strategy.',
    ],
    greetings: [
      'Hi! Are you farming too?',
      'Hello! I am Lily. What is your yield plan?',
      'Your wallet fit is amazing. Which protocol sent you?',
      'Want to check the vaults together?',
    ],
  },
];

// NPC 功能是否默认启用
const NPC_ENABLED = process.env.ALICIZATION_TOWN_NPC_ENABLED !== 'false';

module.exports = { NPC_PROFILES, NPC_ENABLED };
