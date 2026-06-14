// 服务端入口，统一组装接口服务、事件推送与实时通道
// 加载 .env 环境变量（必须在其他模块之前）
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const worldEngine = require('./engine/world-engine');
const apiRouter = require('./routes');

const { NpcManager } = require('./npc/npc-manager');
const { PluginManager } = require('./engine/plugin-manager');
const BaseInteractionsPlugin = require('./plugins/base-interactions');
const BaseNpcPlugin = require('./plugins/base-npc');
const BaseStatsPlugin = require('./plugins/base-stats');
const createAiNpcPlugin = require('./plugins/ai-npc-plugin');
const SolanaEconomyPlugin = require('./plugins/solana-economy');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 5660;

app.use(express.static(path.join(__dirname, '..', 'web')));
app.use('/api', apiRouter);

// ── 初始化世界引擎 ───────────────────────────────────────────────────────────
worldEngine.init(path.join(__dirname, '..', 'web', 'assets', 'map.tmj'));

// ── 初始化插件系统 ───────────────────────────────────────────────────────────
const pluginManager = new PluginManager();
app.locals.pluginManager = pluginManager;
app.locals.worldEngine = worldEngine;

// 将 pluginManager 注入引擎，启用插件优先的交互查询
worldEngine.setPluginManager(pluginManager);

// 设置插件活动推送：插件 ctx.emitActivity() → SSE 广播 + 引擎 activity 记录
pluginManager.setActivityEmitter((data) => {
  // 记录到引擎的 activity 系统（会合并到玩家 activity 列表）
  worldEngine.recordPluginActivity(data.id, data.text, data.type);
});

// AI NPC 插件实例（需要在顶层定义以便后续使用）
const aiNpcPlugin = createAiNpcPlugin();

(async () => {
  // 加载内置基础插件
  await pluginManager.loadPlugin(new BaseStatsPlugin());
  await pluginManager.loadPlugin(new BaseInteractionsPlugin());
  await pluginManager.loadPlugin(new BaseNpcPlugin());
  await pluginManager.loadPlugin(new SolanaEconomyPlugin());

  // 加载 AI NPC 插件
  console.log('[ai-npc] Loading AI NPC plugin...');
  try {
    await pluginManager.loadPlugin(aiNpcPlugin);
    console.log('[ai-npc] AI NPC plugin loaded');
  } catch (err) {
    console.error('[ai-npc] Failed to load AI NPC plugin:', err.message);
  }

  // 自动加载 workspace 包中的插件
  const workspacePlugins = [
    '@alicization/dungeon',
  ];
  for (const pluginName of workspacePlugins) {
    try {
      const PluginModule = require(pluginName);
      const PluginClass = PluginModule.default || PluginModule;
      await pluginManager.loadPlugin(new PluginClass());
    } catch (err) {
      // 可选插件加载失败不阻塞启动
      console.log(`[plugin] Optional plugin not loaded (${pluginName}): ${err.message}`);
    }
  }

  // 加载外部插件（通过环境变量 ALICIZATION_PLUGINS 指定，逗号分隔）
  const pluginList = (process.env.ALICIZATION_PLUGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const pluginPath of pluginList) {
    try {
      const PluginModule = require(pluginPath);
      const PluginClass = PluginModule.default || PluginModule;
      await pluginManager.loadPlugin(new PluginClass());
    } catch (err) {
      console.error(`[plugin] Failed to load plugin (${pluginPath}):`, err.message);
    }
  }
  console.log(`[plugin] Loaded ${pluginManager.listPlugins().length} plugins`);

  // ── 挂载插件注册的路由和中间件到 Express ─────────────────────────────────
  // 中间件
  for (const mw of pluginManager.getMiddleware()) {
    app.use(mw);
  }

  // 路由
  const pluginRoutes = pluginManager.getRoutes();
  for (const route of pluginRoutes) {
    const handlers = [];
    if (route.requireSession) {
      // 复用 routes.js 中的 requireSession 中间件
      const routeModule = require('./routes');
      if (routeModule.requireSession) {
        handlers.push(routeModule.requireSession);
      }
    }
    handlers.push(route.handler);
    app[route.method](`/api${route.path}`, ...handlers);
  }

  if (pluginRoutes.length > 0) {
    console.log(`[plugin] Mounted ${pluginRoutes.length} plugin routes`);
  }

  // ── 设置 AI NPC 世界引擎引用 ──────────────────────────────────────────────────────
  const { setWorldEngine } = require('./plugins/ai-npc-plugin');
  setWorldEngine(worldEngine);
  // AI NPC 行为现在通过策略注册整合到 NpcBehavior 中，无需独立启动调度器
})();

// ── 通过 SSE 向网页观察端推送状态 ───────────────────────────────────────────
let sseClients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  sseClients.push({ id: clientId, res });
  console.log(`[web] Observer connected (ID: ${clientId})`);

  res.write(`data: ${JSON.stringify(worldEngine.sanitizeAllPlayers())}\n\n`);
  res.write(`event: chatHistory\ndata: ${JSON.stringify(worldEngine.getChatHistory())}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
    console.log(`[web] Observer disconnected (ID: ${clientId})`);
  });
});

// ── 监听世界事件并转发给观察端 ───────────────────────────────────────────────
worldEngine.events.on('stateChange', () => {
  const sanitized = worldEngine.sanitizeAllPlayers();
  const data = JSON.stringify(sanitized);
  sseClients.forEach(c => c.res.write(`data: ${data}\n\n`));
  io.emit('stateUpdate', sanitized);
});

worldEngine.events.on('chat', (entry) => {
  const payload = `event: chat\ndata: ${JSON.stringify(entry)}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
  pluginManager.emitPluginEvent('chat', entry);
});

worldEngine.events.on('interaction', (entry) => {
  const payload = `event: interaction\ndata: ${JSON.stringify(entry)}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
  pluginManager.emitPluginEvent('interaction', entry);
});

worldEngine.events.on('activity', (data) => {
  const payload = `event: activity\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
  pluginManager.emitPluginEvent('activity', data);
});

// ── 保留 Socket.IO 通道，供观察链路消费状态更新与基础初始化信息 ───────────────
io.on('connection', (socket) => {
  console.log('[socket] Player connected:', socket.id);
  socket.emit('characterList', worldEngine.getCharacterList());
});

server.listen(PORT, () => console.log(`🌍 Solana Game Life started: http://localhost:${PORT}`));

// ── 初始化 NPC 常驻系统 ─────────────────────────────────────────────────────
const npcManager = new NpcManager(worldEngine, pluginManager);
npcManager.start();
app.locals.npcManager = npcManager;

// ── 优雅关闭：清理 NPC ──────────────────────────────────────────────────────
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[server] Received ${signal}; shutting down...`);

  try {
    // 关闭所有 SSE 连接
    sseClients.forEach(c => {
      try { c.res.end(); } catch (e) {}
    });
    sseClients = [];

    // 关闭 Socket.IO
    io.close();

    // 停止 NPC
    npcManager.stop();

    // 卸载插件
    await pluginManager.unloadAllPlugins();

    // 关闭 HTTP 服务器
    server.close(() => {
      console.log('[server] Server closed');
      process.exit(0);
    });

    // 强制退出超时
    setTimeout(() => {
      console.log('[server] Forcing exit');
      process.exit(1);
    }, 3000);

  } catch (err) {
    console.error('Shutdown error:', err.message);
    process.exit(1);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
