    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const miniCanvas = document.getElementById('minimapCanvas');
    const miniCtx = miniCanvas.getContext('2d');
    const chatlogEl = document.getElementById('chatlog');
    const TILE_SIZE = 26;
    const VIEWPORT_W = 800, VIEWPORT_H = 600;
    const IDLE_AFTER_MS = 30000;
    const OFFLINE_AFTER_MS = 180000;

    let PLAYER_W = 16, PLAYER_H = 16;
    let mapData = null;
    let clientPlayers = {};
    const images = {};
    let imagesLoaded = 0;
    let totalImagesToLoad = 1;
    let isGameLoopRunning = false;

    // === Loading screen progress ===
    const _loadBar = document.getElementById('loading-bar');
    const _loadText = document.getElementById('loading-text');
    let _loadingDismissed = false;
    function _updateLoadingProgress() {
      if (_loadingDismissed) return;
      const pct = Math.min(100, Math.round(imagesLoaded / totalImagesToLoad * 100));
      if (_loadBar) _loadBar.style.width = pct + '%';
      if (_loadText) _loadText.textContent = 'Loading ' + pct + '%';
      if (imagesLoaded >= totalImagesToLoad && mapData) { _dismissLoading(); }
    }
    function _dismissLoading() {
      if (_loadingDismissed) return;
      _loadingDismissed = true;
      const el = document.getElementById('loading-screen');
      if (el) { el.classList.add('fade-out'); setTimeout(() => el.remove(), 700); }
    }

    // 同时缓存屏幕坐标和世界坐标，避免命中检测时反复换算。
    let mouseScreenX = -1, mouseScreenY = -1;
    let mouseX = -1, mouseY = -1;

    // === 镜头状态 ===
    let camera = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1.0, targetZoom: 1.0 };
    let isCameraFollowing = false;
    function getMinZoom() {
      if (!mapData) return 0.5;
      const mapPxW = mapData.width * TILE_SIZE;
      const mapPxH = mapData.height * TILE_SIZE;
      return Math.max(VIEWPORT_W / mapPxW, VIEWPORT_H / mapPxH);
    }

    // 拖拽期间需要记住起点，才能让镜头跟手而不是跳变。
    let isDragging = false, dragMoved = false;
    let dragStartScreen = { x: 0, y: 0 };
    let dragStartCam = { x: 0, y: 0 };

    // === 玩家轨迹 ===
    const playerTrails = {};
    const MAX_TRAIL = 25;

    // 当前悬停的玩家会驱动右侧信息卡和点击跟随。
    let hoveredPlayerId = null;

    // === 昼夜循环 ===
    let gameTime = 6 * 60;
    const TIME_SPEED = 0.01;

    // === 粒子系统 ===
    let particles = [];

    // === 聊天流 ===
    let chatMessages = [];
    const MAX_DISPLAY_MESSAGES = 100;

    // === AI 面板 ===
    let selectedPlayerId = null;
    let playerActivityData = {};
    let demoModeStarted = false;
    const aiListEl = document.getElementById('ai-list');
    const aiCountEl = document.getElementById('ai-count');
    const economyContentEl = document.getElementById('economy-content');
    const activityDetailEl = document.getElementById('activity-detail');
    const activityDetailNameEl = document.getElementById('activity-detail-name');
    const activityLogEl = document.getElementById('activity-log');
    const walletInputEl = document.getElementById('wallet-input');
    const petSelectEl = document.getElementById('pet-select');
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const walletConnectStatusEl = document.getElementById('wallet-connect-status');
    const spawnAgentBtn = document.getElementById('spawn-agent-btn');
    const walletAgentNameEl = document.getElementById('wallet-agent-name');
    const walletSglYieldEl = document.getElementById('wallet-sgl-yield');
    const walletAgentStatusEl = document.getElementById('wallet-agent-status');
    let localWalletAgentId = localStorage.getItem('sgl-agent-id') || '';
    let connectedWalletAddress = localStorage.getItem('sgl-wallet') || '';

    // === 背景音乐 ===
    const bgm = new Audio('assets/musics/36-Village.ogg');
    bgm.loop = true; bgm.volume = 0.3;
    let musicPlaying = false;
    document.getElementById('music-toggle').addEventListener('click', () => {
      musicPlaying = !musicPlaying;
      if (musicPlaying) { bgm.play().catch(() => {}); document.getElementById('music-toggle').textContent = 'Music ON'; }
      else { bgm.pause(); document.getElementById('music-toggle').textContent = 'Music OFF'; }
    });

    // === 角色贴图 ===
    const CHARACTER_SPRITES = ['Custom1','Boy','Cavegirl','Eskimo','FighterRed','Monk','OldMan','Princess','Samurai','Skeleton','Vampire','Villager'];
    const characterImages = {};
    CHARACTER_SPRITES.forEach(name => {
      const img = new Image();
      img.src = `assets/characters/${name}.png`;
      img.onload = () => { imagesLoaded++; _updateLoadingProgress(); };
      characterImages[name] = img;
      totalImagesToLoad++;
    });
    images['player'] = new Image();
    images['player'].src = 'assets/player.png';
    images['player'].onload = () => { imagesLoaded++; PLAYER_W = images['player'].width / 4; PLAYER_H = images['player'].height / 4; _updateLoadingProgress(); };

    const emoteImages = {};
    for (let i = 1; i <= 16; i++) { const img = new Image(); img.src = `assets/emotes/emote${i}.png`; emoteImages[i] = img; }

    const ITEM_NAMES = ['Noodle','Sushi','Fish','Onigiri','Meat','FortuneCookie','Honey','LifePot','MilkPot','WaterPot','Heart','Sword','Katana','Bow','GoldCoin','GoldKey','Billboard'];
    const itemImages = {};
    ITEM_NAMES.forEach(name => { const img = new Image(); img.src = `assets/items/${name}.png`; itemImages[name] = img; });

    const solanaRosterImage = new Image();
    solanaRosterImage.src = 'assets/solana/solana-character-roster.png';
    const SOLANA_ROSTER_RECTS = [
      { x: 50, y: 128, w: 400, h: 645 },
      { x: 506, y: 124, w: 385, h: 654 },
      { x: 908, y: 86, w: 357, h: 688 },
      { x: 1299, y: 136, w: 391, h: 637 },
    ];

    const sfx = {
      interact: new Audio('assets/sounds/interact.wav'),
      chat: new Audio('assets/sounds/chat.wav'),
      magic: new Audio('assets/sounds/magic.wav'),
      heal: new Audio('assets/sounds/heal.wav'),
    };
    Object.values(sfx).forEach(s => { s.volume = 0.25; });
    let sfxEnabled = false;
    document.getElementById('sfx-toggle').textContent = 'SFX OFF';
    document.getElementById('sfx-toggle').addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      document.getElementById('sfx-toggle').textContent = sfxEnabled ? 'SFX ON' : 'SFX OFF';
    });

    const animalImages = {};
    ['Cat','Dog','Frog'].forEach(name => { const img = new Image(); img.src = `assets/animals/${name}.png`; animalImages[name] = img; });

    const animDecorImages = {};
    ['FlagRed','Flower','WaterRipple'].forEach(name => { const img = new Image(); img.src = `assets/animated/${name}.png`; animDecorImages[name] = img; });

    const particleSprites = {};
    ['Leaf','LeafPink','Spark'].forEach(name => { const img = new Image(); img.src = `assets/particles/${name}.png`; particleSprites[name] = img; });

    let npcAnimals = [], npcAnimalsInitialized = false;
    let animDecors = [], animDecorsInitialized = false;

    // ==========================================
    // === 鼠标与镜头事件 ===
    // ==========================================
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      mouseScreenX = (e.clientX - rect.left) * scaleX;
      mouseScreenY = (e.clientY - rect.top) * scaleY;
      mouseX = mouseScreenX / camera.zoom + camera.x;
      mouseY = mouseScreenY / camera.zoom + camera.y;
      if (isDragging) {
        dragMoved = true;
        const dx = (mouseScreenX - dragStartScreen.x) / camera.zoom;
        const dy = (mouseScreenY - dragStartScreen.y) / camera.zoom;
        let newX = dragStartCam.x - dx;
        let newY = dragStartCam.y - dy;
        if (mapData) {
          const maxX = Math.max(0, mapData.width * TILE_SIZE - VIEWPORT_W / camera.zoom);
          const maxY = Math.max(0, mapData.height * TILE_SIZE - VIEWPORT_H / camera.zoom);
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
        }
        camera.x = camera.targetX = newX;
        camera.y = camera.targetY = newY;
      }
    });
    canvas.addEventListener('mouseleave', () => { mouseScreenX = -1; mouseScreenY = -1; mouseX = -1; mouseY = -1; });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true; dragMoved = false;
      dragStartScreen = { x: mouseScreenX, y: mouseScreenY };
      dragStartCam = { x: camera.x, y: camera.y };
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      canvas.classList.remove('dragging');
      if (!dragMoved) {
        if (hoveredPlayerId && clientPlayers[hoveredPlayerId]) {
          selectAndFollowPlayer(hoveredPlayerId);
        } else {
          // Check if clicked on a clickable zone
          const clickedZone = getZoneAtMouse();
          if (clickedZone && isClickableZone(clickedZone.name)) {
            if (isResourceZone(clickedZone.name)) {
              showZonePopup(clickedZone.name, e.clientX, e.clientY);
            } else {
              showShrinePopup(clickedZone.name, e.clientX, e.clientY);
            }
          } else {
            closeZonePopup();
            isCameraFollowing = false;
          }
        }
      } else {
        isCameraFollowing = false;
      }
      isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      camera.targetZoom = Math.max(getMinZoom(), Math.min(4.0, camera.targetZoom + delta));
      if (mouseScreenX >= 0) {
        const nz = camera.targetZoom;
        let newX = mouseX - mouseScreenX / nz;
        let newY = mouseY - mouseScreenY / nz;
        if (mapData) {
          const maxX = Math.max(0, mapData.width * TILE_SIZE - VIEWPORT_W / nz);
          const maxY = Math.max(0, mapData.height * TILE_SIZE - VIEWPORT_H / nz);
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
        }
        camera.x = camera.targetX = newX;
        camera.y = camera.targetY = newY;
      }
      isCameraFollowing = false;
    }, { passive: false });

    // === Touch events for mobile drag ===
    let touchId = null;
    let pinchStartDist = 0, pinchStartZoom = 1;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch zoom start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = camera.targetZoom;
        isDragging = false;
        touchId = null;
        return;
      }
      if (e.touches.length === 1 && touchId === null) {
        const t = e.touches[0];
        touchId = t.identifier;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
        mouseScreenX = (t.clientX - rect.left) * scaleX;
        mouseScreenY = (t.clientY - rect.top) * scaleY;
        mouseX = mouseScreenX / camera.zoom + camera.x;
        mouseY = mouseScreenY / camera.zoom + camera.y;
        isDragging = true; dragMoved = false;
        dragStartScreen = { x: mouseScreenX, y: mouseScreenY };
        dragStartCam = { x: camera.x, y: camera.y };
        canvas.classList.add('dragging');
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchStartDist;
        camera.targetZoom = Math.max(getMinZoom(), Math.min(4.0, pinchStartZoom * scale));
        isCameraFollowing = false;
        return;
      }
      const t = Array.from(e.touches).find(tt => tt.identifier === touchId);
      if (!t || !isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      mouseScreenX = (t.clientX - rect.left) * scaleX;
      mouseScreenY = (t.clientY - rect.top) * scaleY;
      mouseX = mouseScreenX / camera.zoom + camera.x;
      mouseY = mouseScreenY / camera.zoom + camera.y;
      dragMoved = true;
      const ddx = (mouseScreenX - dragStartScreen.x) / camera.zoom;
      const ddy = (mouseScreenY - dragStartScreen.y) / camera.zoom;
      let newX = dragStartCam.x - ddx;
      let newY = dragStartCam.y - ddy;
      if (mapData) {
        const maxX = Math.max(0, mapData.width * TILE_SIZE - VIEWPORT_W / camera.zoom);
        const maxY = Math.max(0, mapData.height * TILE_SIZE - VIEWPORT_H / camera.zoom);
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
      }
      camera.x = camera.targetX = newX;
      camera.y = camera.targetY = newY;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        canvas.classList.remove('dragging');
        if (!dragMoved && hoveredPlayerId && clientPlayers[hoveredPlayerId]) {
          selectAndFollowPlayer(hoveredPlayerId);
        } else if (!dragMoved) {
          // Check if tapped on a resource zone
          const tappedZone = getZoneAtMouse();
          if (tappedZone && isResourceZone(tappedZone.name)) {
            const rect = canvas.getBoundingClientRect();
            const sx = mouseScreenX / canvas.width * rect.width + rect.left;
            const sy = mouseScreenY / canvas.height * rect.height + rect.top;
            showZonePopup(tappedZone.name, sx, sy);
          } else {
            closeZonePopup();
          }
        } else if (dragMoved) {
          isCameraFollowing = false;
        }
        isDragging = false;
        touchId = null;
      } else if (e.touches.length === 1) {
        // Switched from pinch to single finger — restart drag
        const t = e.touches[0];
        touchId = t.identifier;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
        mouseScreenX = (t.clientX - rect.left) * scaleX;
        mouseScreenY = (t.clientY - rect.top) * scaleY;
        dragStartScreen = { x: mouseScreenX, y: mouseScreenY };
        dragStartCam = { x: camera.x, y: camera.y };
        isDragging = true; dragMoved = false;
      }
    });

    canvas.addEventListener('touchcancel', () => {
      isDragging = false; touchId = null;
      canvas.classList.remove('dragging');
    });

    // === Zoom button controls ===
    // DEFAULT_ZOOM 在地图加载后用 getMinZoom() 赋值，确保缩放重置不会出现空白。
    let DEFAULT_ZOOM = 1.0;

    function applyZoom(newZoom) {
      camera.targetZoom = Math.max(getMinZoom(), Math.min(4.0, newZoom));
      isCameraFollowing = false;
    }

    document.getElementById('zoom-in-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      applyZoom(camera.targetZoom + 0.5);
    });
    document.getElementById('zoom-out-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      applyZoom(camera.targetZoom - 0.5);
    });
    document.getElementById('zoom-reset-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      applyZoom(DEFAULT_ZOOM);
    });

    miniCanvas.addEventListener('click', (e) => {
      if (!mapData) return;
      const rect = miniCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (miniCanvas.width / rect.width);
      const my = (e.clientY - rect.top) * (miniCanvas.height / rect.height);
      const mapPixelW = mapData.width * TILE_SIZE, mapPixelH = mapData.height * TILE_SIZE;
      const scale = Math.min(miniCanvas.width / mapPixelW, miniCanvas.height / mapPixelH);
      camera.targetX = mx / scale - VIEWPORT_W / (2 * camera.zoom);
      camera.targetY = my / scale - VIEWPORT_H / (2 * camera.zoom);
      isCameraFollowing = false;
    });

    function selectAndFollowPlayer(id) {
      selectedPlayerId = id;
      isCameraFollowing = true;
      selectedFlashTime = Date.now();
      activityDetailEl.classList.add('visible');
      const p = clientPlayers[id];
      if (p) { activityDetailNameEl.textContent = p.name; renderActivityLog(id); }
      updateAiPanel();
    }

    function isPlayerOffline(player) {
      return !player.lastHeartbeatAt || (Date.now() - player.lastHeartbeatAt) > OFFLINE_AFTER_MS;
    }

    function isPlayerIdle(player) {
      if (isPlayerOffline(player)) return false;
      return !player.lastActionAt || (Date.now() - player.lastActionAt) > IDLE_AFTER_MS;
    }

    function drawSolanaRosterCharacter(targetCtx, index, x, y, w, h) {
      if (!solanaRosterImage.complete || solanaRosterImage.naturalWidth === 0) return false;
      const rect = SOLANA_ROSTER_RECTS[index % SOLANA_ROSTER_RECTS.length];
      targetCtx.save();
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(solanaRosterImage, rect.x, rect.y, rect.w, rect.h, x, y, w, h);
      targetCtx.restore();
      return true;
    }

    function solanaAgentProfile(player, id) {
      const profiles = [
        { name: 'Yield Farmer', sprite: 'Boy', zone: 'Yield Farm' },
        { name: 'LP Vault Engineer', sprite: 'FighterRed', zone: 'LP Vault' },
        { name: 'Validator Monk', sprite: 'Monk', zone: 'Validator Shrine' },
        { name: 'Market Maker', sprite: 'Princess', zone: 'AMM Market' },
      ];
      if (!player || player.name === 'Observer') return player;
      if (String(id || '').startsWith('wallet_agent_')) {
        const hash = String(id || player.id || player.name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        player.solanaSpriteIndex = typeof player.solanaSpriteIndex === 'number' ? player.solanaSpriteIndex : hash % profiles.length;
        player.protocolZoneName = player.currentZoneName || 'SGL Yield Route';
        return player;
      }
      const knownOrder = ['npc_elder_chen', 'npc_samurai_lin', 'npc_princess_lily', 'demo_farmer', 'demo_lp', 'demo_validator', 'demo_mm'];
      const orderedIndex = knownOrder.indexOf(id);
      const hash = String(id || player.id || player.name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const index = orderedIndex >= 0 ? orderedIndex % profiles.length : hash % profiles.length;
      const profile = profiles[index];
      player.solanaSpriteIndex = typeof player.solanaSpriteIndex === 'number' ? player.solanaSpriteIndex : index;
      player.name = profile.name;
      player.sprite = profile.sprite;
      player.protocolZoneName = profile.zone;
      return player;
    }

    function startVercelDemoMode() {
      if (demoModeStarted) return;
      demoModeStarted = true;
      document.body.classList.add('cyberpunk-mode');
      const now = Date.now();
      const demoPlayers = {
        demo_farmer: { id: 'demo_farmer', name: 'Yield Farmer', sprite: 'Boy', solanaSpriteIndex: 0, x: 14, y: 42, lastDirection: 'S', currentZoneName: 'Yield Farm', message: 'Compounding DUST rewards', interactionText: 'harvesting SOL seeds', interactionIcon: 'Honey', lastActionAt: now, lastHeartbeatAt: now },
        demo_lp: { id: 'demo_lp', name: 'LP Vault Engineer', sprite: 'FighterRed', solanaSpriteIndex: 1, x: 22, y: 18, lastDirection: 'E', currentZoneName: 'LP Vault', message: '', interactionText: 'opening fee crates', interactionIcon: 'GoldCoin', lastActionAt: now, lastHeartbeatAt: now },
        demo_validator: { id: 'demo_validator', name: 'Validator Monk', sprite: 'Monk', solanaSpriteIndex: 2, x: 38, y: 32, lastDirection: 'W', currentZoneName: 'Validator Shrine', message: 'Vote credits look clean', interactionText: '', interactionIcon: '', lastActionAt: now, lastHeartbeatAt: now },
        demo_mm: { id: 'demo_mm', name: 'Market Maker', sprite: 'Princess', solanaSpriteIndex: 3, x: 46, y: 45, lastDirection: 'N', currentZoneName: 'AMM Market', message: 'Routing a SOL/USDC swap', interactionText: '', interactionIcon: '', lastActionAt: now, lastHeartbeatAt: now },
      };
      for (const [id, p] of Object.entries(demoPlayers)) {
        clientPlayers[id] = { ...p, displayX: p.x * TILE_SIZE, displayY: p.y * TILE_SIZE, targetX: p.x * TILE_SIZE, targetY: p.y * TILE_SIZE, animFrame: 0 };
        playerActivityData[id] = [
          { time: now - 9000, type: 'join', text: 'Entered Solana Game Life demo mode' },
          { time: now - 5000, type: 'defi', text: `${p.name} updated a simulated protocol position` },
        ];
      }
      updateAiPanel();
      updateStatsPanel();
      addInteractionMessage({ time: now, name: 'Protocol', zone: 'Vercel Preview', action: 'running static demo mode' });
    }

    // ==========================================
    // === 初始化 ===
    // ==========================================
    async function initialize() {
      try {
        document.body.classList.add('cyberpunk-mode');
        const response = await fetch('assets/map.tmj');
        mapData = await response.json();
        if (mapData.tilesets) {
          totalImagesToLoad += mapData.tilesets.length;
          mapData.tilesets.forEach(ts => {
            const imgName = ts.image.split('/').pop();
            images[imgName] = new Image();
            images[imgName].src = 'assets/' + imgName;
            images[imgName].onload = () => { imagesLoaded++; _updateLoadingProgress(); };
          });
        }
        // 观察端固定视口尺寸，避免布局变化打乱像素比例。
        canvas.width = VIEWPORT_W; canvas.height = VIEWPORT_H;
        const mapPixelW = mapData.width * TILE_SIZE, mapPixelH = mapData.height * TILE_SIZE;

        // 动态调整小地图画布尺寸，使其完全匹配地图宽高比，消除留白。
        const miniMapW = miniCanvas.width;
        const miniMapH = Math.round(miniMapW * (mapPixelH / mapPixelW));
        miniCanvas.width = miniMapW;
        miniCanvas.height = miniMapH;

        // 初始缩放设为刚好能看到最大范围且无空白的最小值。
        const initZoom = getMinZoom();
        camera.zoom = camera.targetZoom = initZoom;
        DEFAULT_ZOOM = initZoom;

        // 默认镜头定位到右下角视角。
        camera.x = camera.targetX = Math.max(0, mapPixelW - VIEWPORT_W / camera.zoom);
        camera.y = camera.targetY = Math.max(0, mapPixelH - VIEWPORT_H / camera.zoom);

        const eventSource = new EventSource('/events');
        eventSource.onopen = () => { document.getElementById('status-text').innerText = "Connected - agents can now farm, stake, swap, and compound."; };
        eventSource.onmessage = (event) => {
          const serverPlayers = JSON.parse(event.data);
          for (const id in serverPlayers) {
            const sp = solanaAgentProfile(serverPlayers[id], id);
            if (!clientPlayers[id]) {
              clientPlayers[id] = { ...sp, displayX: sp.x * TILE_SIZE, displayY: sp.y * TILE_SIZE, targetX: sp.x * TILE_SIZE, targetY: sp.y * TILE_SIZE, animFrame: 0, id };
            } else {
              clientPlayers[id].targetX = sp.x * TILE_SIZE;
              clientPlayers[id].targetY = sp.y * TILE_SIZE;
              clientPlayers[id].lastDirection = sp.lastDirection;
              clientPlayers[id].message = sp.message;
              clientPlayers[id].interactionText = sp.interactionText;
              clientPlayers[id].interactionIcon = sp.interactionIcon;
              clientPlayers[id].sprite = sp.sprite;
              clientPlayers[id].name = sp.name;
              clientPlayers[id].solanaSpriteIndex = sp.solanaSpriteIndex;
              clientPlayers[id].protocolZoneName = sp.protocolZoneName;
              clientPlayers[id].id = id;
              clientPlayers[id].isThinking = sp.isThinking;
              clientPlayers[id].currentZoneName = sp.currentZoneName;
              clientPlayers[id].lastActionAt = sp.lastActionAt;
              clientPlayers[id].lastHeartbeatAt = sp.lastHeartbeatAt;
              if (sp.interactionSound && !clientPlayers[id]._lastSound) {
                clientPlayers[id]._lastSound = sp.interactionSound;
                if (sfxEnabled && sfx[sp.interactionSound]) sfx[sp.interactionSound].cloneNode().play().catch(() => {});
              }
              if (!sp.interactionSound) clientPlayers[id]._lastSound = null;
            }
            clientPlayers[id].lastActionAt = sp.lastActionAt;
            clientPlayers[id].lastHeartbeatAt = sp.lastHeartbeatAt;
            // 只有真实位置变化才记录轨迹，避免静止时堆出重复点。
            if (!playerTrails[id]) playerTrails[id] = [];
            const trail = playerTrails[id];
            const wx = sp.x * TILE_SIZE + TILE_SIZE / 2, wy = sp.y * TILE_SIZE + TILE_SIZE / 2;
            const last = trail[trail.length - 1];
            if (!last || last.wx !== wx || last.wy !== wy) {
              trail.push({ wx, wy, time: Date.now() });
              if (trail.length > MAX_TRAIL) trail.shift();
            }
          }
          for (const id in clientPlayers) {
            if (!serverPlayers[id]) { delete clientPlayers[id]; delete playerActivityData[id]; delete playerTrails[id]; }
          }
          updateAiPanel();
        };
        eventSource.addEventListener('chatHistory', (e) => { JSON.parse(e.data).forEach(entry => addChatMessage(entry.name, entry.message, entry.time)); });
        eventSource.addEventListener('chat', (e) => { const entry = JSON.parse(e.data); addChatMessage(entry.name, entry.message, entry.time); if (sfxEnabled) sfx.chat.cloneNode().play().catch(() => {}); });
        eventSource.addEventListener('interaction', (e) => { addInteractionMessage(JSON.parse(e.data)); });
        eventSource.addEventListener('activity', (e) => {
          const data = JSON.parse(e.data);
          playerActivityData[data.id] = data.activities || [];
          if (selectedPlayerId === data.id) renderActivityLog(data.id);
        });
        eventSource.onerror = () => {
          document.getElementById('status-text').innerText = "Static demo mode - Vercel is serving the frontend preview.";
          startVercelDemoMode();
        };

        initParticles(); initNpcAnimals(); initAnimDecors();
        if (!isGameLoopRunning) { isGameLoopRunning = true; lastFrameTime = performance.now(); requestAnimationFrame(gameLoop); }
      } catch (error) {
        document.getElementById('status-text').innerText = "Failed to load map!";
        console.error("Load error:", error);
      }
    }

    // ==========================================
    // === 主循环 ===
    // ==========================================
    let lastFrameTime = 0;
    function gameLoop(timestamp) {
      const dt = (timestamp - lastFrameTime) / 1000;
      lastFrameTime = timestamp;
      if (mapData && imagesLoaded >= totalImagesToLoad) {
        _dismissLoading();
        updateDayNight(dt);
        updateParticles(dt);
        updateNpcAnimals(dt);
        updatePhysics();
        updateCamera(dt);
        draw();
        drawMinimap();
      }
      requestAnimationFrame(gameLoop);
    }

    // Re-render AI panel on resize (orientation change, etc.)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { updateAiPanel(); }, 150);
    });

    // ==========================================
    // === 更新镜头 ===
    // ==========================================
    function updateCamera(dt) {
      camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 10);
      if (isCameraFollowing && selectedPlayerId && clientPlayers[selectedPlayerId]) {
        const p = clientPlayers[selectedPlayerId];
        camera.targetX = p.displayX + TILE_SIZE / 2 - VIEWPORT_W / (2 * camera.zoom);
        camera.targetY = p.displayY + TILE_SIZE / 2 - VIEWPORT_H / (2 * camera.zoom);
      }
      if (mapData) {
        const maxX = Math.max(0, mapData.width * TILE_SIZE - VIEWPORT_W / camera.zoom);
        const maxY = Math.max(0, mapData.height * TILE_SIZE - VIEWPORT_H / camera.zoom);
        camera.targetX = Math.max(0, Math.min(camera.targetX, maxX));
        camera.targetY = Math.max(0, Math.min(camera.targetY, maxY));
        camera.x = Math.max(0, Math.min(camera.x, maxX));
        camera.y = Math.max(0, Math.min(camera.y, maxY));
      }
      if (!isDragging) {
        camera.x += (camera.targetX - camera.x) * Math.min(1, dt * 8);
        camera.y += (camera.targetY - camera.y) * Math.min(1, dt * 8);
      }
    }

    // ==========================================
    // === 更新插值动画 ===
    // ==========================================
    function updatePhysics() {
      const MOVE_SPEED = 1.2, ANIM_SPEED = 0.09;
      for (const id in clientPlayers) {
        const p = clientPlayers[id];
        let isMoving = false;
        if (p.displayX < p.targetX) { p.displayX = Math.min(p.displayX + MOVE_SPEED, p.targetX); isMoving = true; }
        else if (p.displayX > p.targetX) { p.displayX = Math.max(p.displayX - MOVE_SPEED, p.targetX); isMoving = true; }
        if (p.displayY < p.targetY) { p.displayY = Math.min(p.displayY + MOVE_SPEED, p.targetY); isMoving = true; }
        else if (p.displayY > p.targetY) { p.displayY = Math.max(p.displayY - MOVE_SPEED, p.targetY); isMoving = true; }
        if (isMoving) { p.animFrame += ANIM_SPEED; if (p.animFrame >= 4) p.animFrame = 0; }
        else { p.animFrame = 0; }
      }
    }

    // ==========================================
    // === 昼夜更新 ===
    // ==========================================
    function updateDayNight(dt) {
      gameTime += TIME_SPEED * dt * 60;
      if (gameTime >= 1440) gameTime -= 1440;
      const hours = Math.floor(gameTime / 60), mins = Math.floor(gameTime % 60);
      document.getElementById('time-display').textContent = `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    }
    function getDayNightOverlay() {
      const h = gameTime / 60;
      if (h >= 6 && h < 8)  return { r:255,g:180,b:100, a: 0.15 * (1-(h-6)/2) };
      if (h >= 8 && h < 17) return { r:0,g:0,b:0, a:0 };
      if (h >= 17 && h < 19) return { r:255,g:140,b:50, a: 0.12 * (h-17)/2 };
      if (h >= 19 && h < 21) return { r:20,g:20,b:80, a: 0.12 + 0.25*(h-19)/2 };
      if (h >= 21 || h < 4)  return { r:10,g:10,b:50, a:0.4 };
      return { r:30,g:20,b:80, a: 0.4*(1-(h-4)/2) };
    }
    function isNight() { return gameTime >= 1260 || gameTime < 300; }

    // ==========================================
    // === 粒子系统 ===
    // ==========================================
    function initParticles() { particles = []; }
    function spawnFirefly() {
      if (!mapData) return;
      particles.push({ type:'firefly', x:Math.random()*mapData.width*TILE_SIZE, y:Math.random()*mapData.height*TILE_SIZE,
        vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*10, life:4+Math.random()*6, maxLife:10,
        phase:Math.random()*Math.PI*2, size:1.5+Math.random()*1.5 });
    }
    function spawnLeaf(zx,zy,zw,zh) {
      const sx=TILE_SIZE/mapData.tilewidth, sy=TILE_SIZE/mapData.tileheight;
      particles.push({ type:'leaf', x:zx*sx+Math.random()*zw*sx, y:zy*sy-10, vx:8+Math.random()*12, vy:15+Math.random()*10,
        life:3+Math.random()*2, maxLife:5, rot:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*4, size:2+Math.random()*2 });
    }
    function spawnWaterShimmer(zx,zy,zw,zh) {
      const sx=TILE_SIZE/mapData.tilewidth, sy=TILE_SIZE/mapData.tileheight;
      particles.push({ type:'shimmer', x:zx*sx+Math.random()*Math.max(zw*sx,20), y:zy*sy+Math.random()*Math.max(zh*sy,20),
        life:0.8+Math.random()*1.2, maxLife:2, size:1+Math.random()*2 });
    }
    let particleTimer = 0;
    function updateParticles(dt) {
      particleTimer += dt;
      if (isNight() && particleTimer > 0.3) {
        particleTimer = 0;
        if (particles.filter(p=>p.type==='firefly').length < 25) spawnFirefly();
      }
      if (mapData && Math.random() < dt * 0.5) {
        const zl = mapData.layers.find(l=>l.type==='objectgroup');
        if (zl && zl.objects) zl.objects.forEach(z => {
          const n=(z.name||'').toLowerCase();
          if (n.includes('tree') && Math.random()<0.05) spawnLeaf(z.x,z.y,z.width||30,z.height||30);
          if (n.includes('pond') && Math.random()<0.08) spawnWaterShimmer(z.x,z.y,z.width||20,z.height||30);
        });
      }
      for (let i=particles.length-1;i>=0;i--) {
        const p=particles[i]; p.life-=dt;
        if (p.life<=0){particles.splice(i,1);continue;}
        if (p.type==='firefly'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx+=(Math.random()-0.5)*20*dt;p.vy+=(Math.random()-0.5)*15*dt;p.vx=Math.max(-20,Math.min(20,p.vx));p.vy=Math.max(-15,Math.min(15,p.vy));}
        else if (p.type==='leaf'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.rotSpeed*dt;}
      }
    }

    // ==========================================
    // === 场景动物 ===
    // ==========================================
    function initNpcAnimals() {
      if (!mapData||npcAnimalsInitialized) return; npcAnimalsInitialized=true;
      const zl=mapData.layers.find(l=>l.type==='objectgroup');
      if (!zl||!zl.objects) return;
      const sx=TILE_SIZE/mapData.tilewidth, sy=TILE_SIZE/mapData.tileheight;
      zl.objects.forEach(z=>{
        const n=(z.name||'').toLowerCase(), zx=z.x*sx,zy=z.y*sy,zw=(z.width||30)*sx,zh=(z.height||30)*sy;
        if (n.includes('inn')||n.includes('noodle')||n.includes('warehouse')) npcAnimals.push(createAnimal('Cat',zx,zy,zw,zh));
        if (n.includes('practice')||n.includes('weapon')) npcAnimals.push(createAnimal('Dog',zx,zy,zw,zh));
        if (n.includes('pond')){ npcAnimals.push(createAnimal('Frog',zx,zy,zw,zh)); npcAnimals.push(createAnimal('Frog',zx,zy,zw,zh)); }
      });
    }
    function createAnimal(type,zx,zy,zw,zh){
      return {type,zx,zy,zw,zh,x:zx+Math.random()*zw,y:zy+Math.random()*zh,vx:0,vy:0,animFrame:0,animTimer:0,moveTimer:Math.random()*3,idleTime:2+Math.random()*4,facing:Math.random()>0.5?1:-1};
    }
    function updateNpcAnimals(dt){
      for (const a of npcAnimals){
        a.animTimer+=dt; if(a.animTimer>0.4){a.animTimer=0;a.animFrame=(a.animFrame+1)%2;}
        a.moveTimer-=dt;
        if(a.moveTimer<=0){
          if(Math.random()<0.6){const speed=6+Math.random()*8,angle=Math.random()*Math.PI*2;a.vx=Math.cos(angle)*speed;a.vy=Math.sin(angle)*speed*0.5;a.facing=a.vx>=0?1:-1;a.moveTimer=0.5+Math.random()*1.5;}
          else{a.vx=0;a.vy=0;a.moveTimer=a.idleTime+Math.random()*3;}
        }
        a.x+=a.vx*dt; a.y+=a.vy*dt;
        a.x=Math.max(a.zx,Math.min(a.x,a.zx+a.zw-8));
        a.y=Math.max(a.zy,Math.min(a.y,a.zy+a.zh-8));
      }
    }
    function drawNpcAnimals(){
      for (const a of npcAnimals){
        const img=animalImages[a.type]; if(!img||!img.complete) continue;
        const fw=img.width/2,fh=img.height;
        ctx.save(); ctx.imageSmoothingEnabled=false;
        if(a.facing<0){ctx.translate(a.x+TILE_SIZE*0.6,a.y);ctx.scale(-1,1);ctx.drawImage(img,a.animFrame*fw,0,fw,fh,0,0,TILE_SIZE*0.6,TILE_SIZE*0.6);}
        else{ctx.drawImage(img,a.animFrame*fw,0,fw,fh,a.x,a.y,TILE_SIZE*0.6,TILE_SIZE*0.6);}
        ctx.imageSmoothingEnabled=true; ctx.restore();
      }
    }

    // ==========================================
    // === 动态装饰 ===
    // ==========================================
    function initAnimDecors(){
      if(!mapData||animDecorsInitialized) return; animDecorsInitialized=true;
      const zl=mapData.layers.find(l=>l.type==='objectgroup');
      if(!zl||!zl.objects) return;
      const sx=TILE_SIZE/mapData.tilewidth,sy=TILE_SIZE/mapData.tileheight;
      zl.objects.forEach(z=>{
        const n=(z.name||'').toLowerCase(),zx=z.x*sx,zy=z.y*sy,zw=(z.width||30)*sx,zh=(z.height||30)*sy;
        if(n.includes('grass')||n.includes('tree')){const c=2+Math.floor(Math.random()*3);for(let i=0;i<c;i++) animDecors.push({type:'Flower',x:zx+Math.random()*zw,y:zy+Math.random()*zh,speed:0.12+Math.random()*0.08,timer:Math.random()*4});}
        if(n.includes('pond')){const c=3+Math.floor(Math.random()*3);for(let i=0;i<c;i++) animDecors.push({type:'WaterRipple',x:zx+Math.random()*zw,y:zy+Math.random()*zh,speed:0.2+Math.random()*0.1,timer:Math.random()*4});}
        if(n.includes('noodle')||n.includes('inn')||n.includes('weapon')||n.includes('potion')) animDecors.push({type:'FlagRed',x:zx-4,y:zy-8,speed:0.15,timer:Math.random()*4});
      });
    }
    function drawAnimDecors(layerName){
      const now=Date.now()/1000;
      for(const d of animDecors){
        const img=animDecorImages[d.type]; if(!img||!img.complete) continue;
        const isBottom=(d.type==='WaterRipple'||d.type==='Flower');
        if((layerName==='bottom'&&!isBottom)||(layerName==='top'&&isBottom)) continue;
        const fw=img.width/4,fh=img.height,frame=Math.floor((now*(1/d.speed))+d.timer)%4;
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img,frame*fw,0,fw,fh,d.x,d.y,TILE_SIZE*0.7,TILE_SIZE*0.7);
        ctx.imageSmoothingEnabled=true;
      }
    }

    // ==========================================
    // === 静态地标（告示牌等）===
    // ==========================================
    function drawStaticLandmarks(){
      if(!mapData) return;
      const zl=mapData.layers.find(l=>l.type==='objectgroup');
      if(!zl||!zl.objects) return;
      const sx=TILE_SIZE/mapData.tilewidth, sy=TILE_SIZE/mapData.tileheight;
      zl.objects.forEach(z=>{
        if(z.type!=='landmark') return;
        const img=itemImages['Billboard'];
        if(!img||!img.complete) return;
        const px=z.x*sx, py=z.y*sy;
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img, px-4, py-8, TILE_SIZE*1.4, TILE_SIZE*1.4);
        ctx.imageSmoothingEnabled=true;
      });
    }

    // ==========================================
    // === 绘制瓦片 ===
    // ==========================================
    // Tiled GID flip/rotation flags
    const FLIPPED_HORIZONTALLY = 0x40000000;
    const FLIPPED_VERTICALLY   = 0x80000000;
    const ROTATED_90           = 0x20000000;

    function drawTile(gid,x,y){
      if(gid===0) return;

      // Extract flip/rotation flags from GID
      const flippedH = (gid & FLIPPED_HORIZONTALLY) !== 0;
      const flippedV = (gid & FLIPPED_VERTICALLY) !== 0;
      const rotated  = (gid & ROTATED_90) !== 0;

      // Get actual tile ID without flip/rotation bits
      const cleanGid = gid & 0x1FFFFFFF;

      const ts=mapData.tilesets.slice().reverse().find(t=>cleanGid>=t.firstgid);
      if(!ts) return;
      const imgName=ts.image.split('/').pop();
      if(!images[imgName]) return;
      const localId=cleanGid-ts.firstgid,cols=ts.columns;

      const sx = (localId%cols)*ts.tilewidth;
      const sy = Math.floor(localId/cols)*ts.tileheight;
      const sw = ts.tilewidth;
      const sh = ts.tileheight;
      const dx = x*TILE_SIZE;
      const dy = y*TILE_SIZE;
      const dw = TILE_SIZE;
      const dh = TILE_SIZE;

      // Tiled's rotation is 90° clockwise (bit 29). Canvas rotation is counter-clockwise,
      // so we negate the angle. Also apply flips in the correct order.
      if (flippedH || flippedV || rotated) {
        ctx.save();
        ctx.translate(dx + dw/2, dy + dh/2);

        let r = 0;
        if (rotated)  r += Math.PI / 2;   // +90° clockwise in Tiled = +90° counter-clockwise in canvas
        if (flippedH && flippedV) r += Math.PI;  // 180° = H flip + V flip
        if (flippedH && !flippedV) r += (rotated ? 0 : Math.PI);  // complex case

        // More precise: combine H/V flip with rotation
        // The actual transform: rotate first (if needed), then flip
        ctx.rotate(r);

        // Scale for flips - order matters
        const sx2 = flippedH ? -1 : 1;
        const sy2 = flippedV ? -1 : 1;
        ctx.scale(sx2, sy2);

        // If rotated 90° in Tiled (bit 29), and H flip, the result differs
        // Tiled: rotation 90° CW + H flip = mirror across diagonal
        // We handle the combined transform above, but still need to account for
        // how rotated tiles affect the draw position

        ctx.drawImage(
          images[imgName],
          sx, sy, sw, sh,
          -dw/2, -dh/2, dw, dh
        );
        ctx.restore();
      } else {
        ctx.drawImage(images[imgName], sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }

    // ==========================================
    // === 绘制玩家轨迹 ===
    // ==========================================
    function drawPlayerTrails(){
      const now=Date.now();
      for(const id in playerTrails){
        if(!clientPlayers[id]||clientPlayers[id].name==='Observer') continue;
        const trail=playerTrails[id];
        if(trail.length<2) continue;
        for(let i=1;i<trail.length;i++){
          const ageRatio=i/trail.length;
          const timeFade=Math.max(0,1-(now-trail[i].time)/8000);
          const alpha=ageRatio*timeFade*0.55;
          if(alpha<0.01) continue;
          ctx.beginPath();
          ctx.moveTo(trail[i-1].wx,trail[i-1].wy);
          ctx.lineTo(trail[i].wx,trail[i].wy);
          ctx.strokeStyle=`rgba(116,185,255,${alpha})`;
          ctx.lineWidth=Math.max(0.5,2/camera.zoom);
          ctx.lineCap='round';
          ctx.stroke();
        }
      }
    }

    function drawCyberpunkOverlay() {
      if (!demoModeStarted) return;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(8, 7, 28, 0.28)';
      ctx.fillRect(camera.x,camera.y,VIEWPORT_W/camera.zoom,VIEWPORT_H/camera.zoom);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(38,242,194,0.18)';
      ctx.lineWidth = 1 / camera.zoom;
      const step = TILE_SIZE * 3;
      const startX = Math.floor(camera.x / step) * step;
      const startY = Math.floor(camera.y / step) * step;
      for (let x = startX; x < camera.x + VIEWPORT_W / camera.zoom; x += step) {
        ctx.beginPath(); ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + VIEWPORT_H / camera.zoom); ctx.stroke();
      }
      for (let y = startY; y < camera.y + VIEWPORT_H / camera.zoom; y += step) {
        ctx.beginPath(); ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + VIEWPORT_W / camera.zoom, y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // ==========================================
    // === 绘制玩家悬浮信息卡：屏幕坐标层 ===
    // ==========================================
    function drawPlayerHoverCard(p, sx, sy){
      const W=185,H=82;
      let cx=sx+18, cy=sy-H-12;
      if(cx+W>VIEWPORT_W) cx=sx-W-12;
      if(cy<0) cy=sy+28;
      ctx.fillStyle='rgba(20,20,40,0.95)';
      ctx.beginPath(); ctx.roundRect(cx,cy,W,H,10); ctx.fill();
      ctx.strokeStyle='#74b9ff'; ctx.lineWidth=1.5; ctx.stroke();
      // 头像单独画在信息卡左上角，避免文字抖动时一起偏移。
      const si=(p.sprite&&characterImages[p.sprite])?characterImages[p.sprite]:images['player'];
      if(typeof p.solanaSpriteIndex==='number'){
        drawSolanaRosterCharacter(ctx,p.solanaSpriteIndex,cx+8,cy+2,34,44);
      } else if(si&&si.complete){const pw=si.width/4,ph=si.height/4;ctx.imageSmoothingEnabled=false;ctx.drawImage(si,0,0,pw,ph,cx+8,cy+8,32,32);ctx.imageSmoothingEnabled=true;}
      // 名字保持高对比色，方便在深色卡片上快速识别。
      ctx.font='bold 13px "Pixelify Sans",sans-serif';
      ctx.fillStyle='#74b9ff'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(p.name,cx+46,cy+8);
      // 区域名去掉括号附注，避免悬浮信息过长。
        const zone=(p.currentZoneName||'protocol lane').split('(')[0].trim();
      ctx.font='11px "Pixelify Sans",sans-serif'; ctx.fillStyle='#9aa899';
      ctx.fillText('📍 '+zone,cx+46,cy+26);
      // 思考态与空闲态用颜色直接区分，减少阅读成本。
      const idle = isPlayerIdle(p);
      ctx.fillStyle=p.isThinking?'#fdcb6e':(idle?'#95a5a6':'#00b894');
      ctx.fillText(p.isThinking?'💭 Thinking...':(idle?'🌫 Inactive':'🟢 Active'),cx+46,cy+42);
      // 消息做截断，避免气泡内容把悬浮卡撑坏。
      if(p.message){const msg=p.message.length>24?p.message.substring(0,24)+'…':p.message;ctx.fillStyle='#dfe6e9';ctx.fillText('💬 '+msg,cx+8,cy+60);}
      // 明示点击后会进入跟随模式，降低交互学习成本。
      ctx.font='10px "Pixelify Sans",sans-serif'; ctx.fillStyle='rgba(116,185,255,0.5)';
      ctx.textAlign='right'; ctx.fillText('Follow',cx+W-6,cy+H-8);
      ctx.textAlign='left'; ctx.textBaseline='middle';
    }

    // ==========================================
    // === 主渲染阶段 ===
    // ==========================================
    function draw(){
      ctx.clearRect(0,0,VIEWPORT_W,VIEWPORT_H);

      // 先切到世界坐标系，后续地图与角色都共享同一套变换。
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.setTransform(camera.zoom,0,0,camera.zoom,-camera.x*camera.zoom,-camera.y*camera.zoom);

      // 1. 先画底层地块，保证角色与装饰能压在上面。
      ['BaseFloor','Floor','BaseNature'].forEach(name=>{
        const l=mapData.layers.find(l=>l.type==='tilelayer'&&l.name===name&&l.visible);
        if(l) for(let i=0;i<l.data.length;i++) drawTile(l.data[i],i%mapData.width,Math.floor(i/mapData.width));
      });

      drawParticlesOfType('shimmer');
      drawCyberpunkOverlay();
      drawAnimDecors('bottom');
      drawNpcAnimals();
      drawStaticLandmarks();
      drawPlayerTrails();

      // 被选中玩家所在区域要持续高亮，方便远距离追踪。
      if(selectedPlayerId&&clientPlayers[selectedPlayerId]){
        const sp=clientPlayers[selectedPlayerId];
        const zl=mapData.layers.find(l=>l.type==='objectgroup');
        if(zl){
          const zone=zl.objects.find(z=>z.name===sp.currentZoneName);
          if(zone){
            const sx2=TILE_SIZE/mapData.tilewidth,sy2=TILE_SIZE/mapData.tileheight;
            const pulse=0.5+0.5*Math.sin(Date.now()/400);
            ctx.save();
            ctx.strokeStyle=`rgba(116,185,255,${0.3+0.35*pulse})`;
            ctx.lineWidth=Math.max(1,3/camera.zoom);
            ctx.shadowColor='#74b9ff'; ctx.shadowBlur=12/camera.zoom;
            ctx.beginPath(); ctx.roundRect(zone.x*sx2,zone.y*sy2,zone.width*sx2,zone.height*sy2,4); ctx.stroke();
            ctx.shadowBlur=0; ctx.restore();
          }
        }
      }

      const actorOverlays = [];

      // 2. 按 Y 轴排序绘制角色，模拟伪 2D 遮挡关系。
      Object.values(clientPlayers).sort((a,b)=>a.displayY-b.displayY).forEach(p=>{
        const sx=p.displayX,sy=p.displayY;
        const idle=isPlayerIdle(p);
        const actorAlpha=idle?0.45:1;
        const col={'S':0,'N':1,'W':2,'E':3}[(p.lastDirection||'S').toUpperCase()]||0;
        const row=Math.floor(p.animFrame);
        const si=(p.sprite&&characterImages[p.sprite])?characterImages[p.sprite]:images['player'];
        const pw=si.width/4,ph=si.height/4;
        ctx.save();
        ctx.globalAlpha=actorAlpha;
        if(typeof p.solanaSpriteIndex==='number'){
          ctx.shadowColor = '#26f2c2';
          ctx.shadowBlur = 5 / camera.zoom;
          drawSolanaRosterCharacter(ctx,p.solanaSpriteIndex,sx-2,sy-34,TILE_SIZE*1.18,TILE_SIZE*2.05);
          ctx.shadowBlur = 0;
        } else {
          ctx.drawImage(si,col*pw,row*ph,pw,ph,sx,sy-10,TILE_SIZE*1.2,TILE_SIZE*1.2);
        }
        const cx2=sx+TILE_SIZE/2;
        const floatY=Math.sin(Date.now()/300+p.x)*2;
        const nameY=sy-15;

        ctx.restore();

        actorOverlays.push(() => {
          ctx.save();
          ctx.globalAlpha=actorAlpha;

          if(selectedPlayerId&&p.id===selectedPlayerId){
            ctx.strokeStyle=`rgba(116,185,255,${0.5+0.3*Math.sin(Date.now()/300)})`;
            ctx.lineWidth=2/camera.zoom;
            const selY = typeof p.solanaSpriteIndex==='number' ? sy-35 : sy-13;
            const selH = typeof p.solanaSpriteIndex==='number' ? TILE_SIZE*2.1 : TILE_SIZE*1.2+6;
            ctx.beginPath(); ctx.roundRect(sx-4,selY,TILE_SIZE*1.25+8,selH,6); ctx.stroke();
            const ay=sy-22+Math.sin(Date.now()/400)*3;
            ctx.fillStyle='#74b9ff'; ctx.beginPath(); ctx.moveTo(cx2-4,ay); ctx.lineTo(cx2+4,ay); ctx.lineTo(cx2,ay+5); ctx.closePath(); ctx.fill();
          }

          ctx.font='400 14px "Pixelify Sans","Comic Sans MS",sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.strokeStyle=idle?'rgba(26,26,46,0.55)':'rgba(26,26,46,0.9)'; ctx.strokeText(p.name,cx2,nameY);
          ctx.fillStyle=p.name==='Observer'?'#f1c40f':(idle?'rgba(255,255,255,0.72)':'#ffffff'); ctx.fillText(p.name,cx2,nameY);

          const bubbleY=sy-27+floatY;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          if(p.isThinking){
            const thinkEmotes=[1,6,2],idx=thinkEmotes[Math.floor(Date.now()/900)%3],ei=emoteImages[idx];
            const bw=28,bh=28,bx=cx2-14,by=bubbleY-bh;
            ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,10); ctx.fill();
            ctx.strokeStyle='#a4b0be'; ctx.lineWidth=2/camera.zoom; ctx.stroke();
            ctx.fillStyle='rgba(255,255,255,0.9)';
            ctx.beginPath(); ctx.arc(cx2-5,bubbleY+2,3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx2-2,bubbleY+6,2,0,Math.PI*2); ctx.fill();
            if(ei&&ei.complete){ctx.imageSmoothingEnabled=false;ctx.drawImage(ei,bx+(bw-18)/2,by+(bh-18)/2,18,18);ctx.imageSmoothingEnabled=true;}
          } else if(p.interactionText){
            const actText=p.interactionText.length>16?p.interactionText.substring(0,16)+'...':p.interactionText;
            ctx.font='400 12px "Pixelify Sans",sans-serif';
            const hasIcon=p.interactionIcon&&itemImages[p.interactionIcon];
            const iconSpace=hasIcon?20:0, pad=10;
            const bw=ctx.measureText(actText).width+iconSpace+pad*2, bh=28;
            const bx=cx2-bw/2, by=sy-65+floatY;
            ctx.fillStyle='rgba(255,248,220,0.97)'; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,8); ctx.fill();
            ctx.strokeStyle='#e67e22'; ctx.lineWidth=2/camera.zoom; ctx.stroke();
            ctx.fillStyle='rgba(255,248,220,0.97)'; ctx.beginPath(); ctx.moveTo(cx2-4,by+bh); ctx.lineTo(cx2+4,by+bh); ctx.lineTo(cx2,by+bh+6); ctx.closePath(); ctx.fill();
            ctx.strokeStyle='#e67e22'; ctx.lineWidth=1.5/camera.zoom; ctx.stroke();
            let tx=bx+pad;
            if(hasIcon){const ii=itemImages[p.interactionIcon];if(ii.complete){ctx.imageSmoothingEnabled=false;ctx.drawImage(ii,bx+pad,by+(bh-16)/2,16,16);ctx.imageSmoothingEnabled=true;}tx+=iconSpace;}
            ctx.font='400 12px "Pixelify Sans",sans-serif'; ctx.fillStyle='#8B5E14'; ctx.textAlign='left';
            ctx.fillText(actText,tx,by+bh/2+1); ctx.textAlign='center';
          } else if(p.message){
            const msg=p.message.length>30?p.message.substring(0,30)+'...':p.message;
            ctx.font='400 14px "Pixelify Sans",sans-serif';
            const bw=ctx.measureText(msg).width+32,bh=30,bx=cx2-bw/2,by=sy-65+floatY;
            ctx.fillStyle='white'; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,8); ctx.fill();
            ctx.strokeStyle='#8ecf7e'; ctx.lineWidth=2/camera.zoom; ctx.stroke();
            ctx.fillStyle='#5c4a3d'; ctx.fillText(msg,cx2,by+bh/2);
          }

          ctx.restore();
        });
      });

      // 3. 最后再盖上顶部图层，形成树冠/屋檐遮挡效果。
      ['Nature','Building','BuildingTop'].forEach(name=>{
        const l=mapData.layers.find(l=>l.type==='tilelayer'&&l.name===name&&l.visible);
        if(l) for(let i=0;i<l.data.length;i++) drawTile(l.data[i],i%mapData.width,Math.floor(i/mapData.width));
      });
      drawAnimDecors('top');
      drawParticlesOfType('leaf');
      drawParticlesOfType('firefly');

      actorOverlays.forEach(drawOverlay => drawOverlay());

      // 昼夜遮罩覆盖的是世界视口，而不是整张地图。
      const ov=getDayNightOverlay();
      if(ov.a>0){ ctx.fillStyle=`rgba(${ov.r},${ov.g},${ov.b},${ov.a})`; ctx.fillRect(camera.x,camera.y,VIEWPORT_W/camera.zoom,VIEWPORT_H/camera.zoom); }

      // 鼠标提示只在世界坐标层判定，避免缩放后命中偏移。
      const zl=mapData.layers.find(l=>l.type==='objectgroup');
      if(zl&&zl.objects&&mouseX>=0){
        zl.objects.forEach(zone=>{
          const sx2=TILE_SIZE/mapData.tilewidth,sy2=TILE_SIZE/mapData.tileheight;
          const rx=zone.x*sx2,ry=zone.y*sy2,rw=zone.width*sx2,rh=zone.height*sy2;
          if(mouseX>=rx&&mouseX<=rx+rw&&mouseY>=ry&&mouseY<=ry+rh){
            const isResZone = isClickableZone(zone.name);
            const suffix = isResZone ? ' [view]' : '';
            ctx.font='bold 16px "Pixelify Sans",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            const nameText = zone.name + suffix;
            const tw=ctx.measureText(nameText).width+20,th=isResZone?42:35,tx=mouseX-15,ty=mouseY-30;
            ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,8); ctx.fill();
            ctx.strokeStyle=isResZone?'#e67e22':'#f39c12'; ctx.lineWidth=2/camera.zoom; ctx.stroke();
            ctx.fillStyle='#5c4a3d'; ctx.fillText(zone.name,tx+tw/2,ty+th/2-(isResZone?8:0));
            if(isResZone){
              ctx.font='11px "Pixelify Sans",sans-serif'; ctx.fillStyle='#e67e22';
              ctx.fillText('[view]',tx+tw/2,ty+th/2+10);
            }
          }
        });
      }

      // 恢复到屏幕坐标后再绘制界面层，避免被镜头缩放影响。
      ctx.restore();
      ctx.imageSmoothingEnabled=true;

      // === 屏幕坐标层：检测玩家悬停 ===
      hoveredPlayerId=null;
      for(const id in clientPlayers){
        const p=clientPlayers[id]; if(p.name==='Observer') continue;
        const spx=(p.displayX-camera.x)*camera.zoom, spy=(p.displayY-camera.y)*camera.zoom;
        const isSolana = typeof p.solanaSpriteIndex==='number';
        const hitX = spx + (isSolana ? -2 : 0) * camera.zoom;
        const hitY = spy + (isSolana ? -34 : -10) * camera.zoom;
        const hitW = (isSolana ? TILE_SIZE*1.18 : TILE_SIZE*1.2) * camera.zoom;
        const hitH = (isSolana ? TILE_SIZE*2.05 : TILE_SIZE*1.2) * camera.zoom;
        if(mouseScreenX>=hitX&&mouseScreenX<=hitX+hitW&&mouseScreenY>=hitY&&mouseScreenY<=hitY+hitH){ hoveredPlayerId=id; break; }
      }

      // 悬浮卡最后绘制，确保压在所有世界元素之上。
      if(hoveredPlayerId&&clientPlayers[hoveredPlayerId]){
        const p=clientPlayers[hoveredPlayerId];
        const spx=(p.displayX-camera.x)*camera.zoom+TILE_SIZE*camera.zoom/2;
        const spy=(p.displayY-camera.y)*camera.zoom;
        drawPlayerHoverCard(p,spx,spy);
      }
    }

    // ==========================================
    // === 按类型绘制粒子 ===
    // ==========================================
    function drawParticlesOfType(type){
      for(const p of particles){
        if(p.type!==type) continue;
        const fadeRatio=Math.min(1,p.life/(p.maxLife*0.3));
        if(type==='firefly'){
          const glow=0.4+0.6*Math.sin(Date.now()/200+p.phase),alpha=fadeRatio*glow;
          ctx.beginPath();ctx.arc(p.x,p.y,p.size*4,0,Math.PI*2);ctx.fillStyle=`rgba(200,255,100,${alpha*0.15})`;ctx.fill();
          const si=particleSprites['Spark'];
          if(si&&si.complete){const fw=si.width/9,fr=Math.floor(Date.now()/200+p.phase)%Math.max(1,Math.floor(si.width/8));ctx.save();ctx.globalAlpha=alpha*0.9;ctx.imageSmoothingEnabled=false;ctx.drawImage(si,fr*fw,0,fw,si.height,p.x-p.size*1.5,p.y-p.size*1.5,p.size*3,p.size*3);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.restore();}
          else{ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=`rgba(240,255,150,${alpha*0.9})`;ctx.fill();}
        } else if(type==='leaf'){
          const lt=(p.x+p.y)%2===0?'Leaf':'LeafPink',li=particleSprites[lt];
          if(li&&li.complete){const fw=li.height,nf=Math.max(1,Math.floor(li.width/fw)),fr=Math.floor(p.rot*2)%nf;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*0.3);ctx.globalAlpha=fadeRatio*0.8;ctx.imageSmoothingEnabled=false;ctx.drawImage(li,Math.abs(fr)*fw,0,fw,li.height,-p.size*1.5,-p.size*1.5,p.size*3,p.size*3);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.restore();}
          else{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=fadeRatio*0.7;ctx.fillStyle='#6ab04c';ctx.fillRect(-p.size,-p.size/2,p.size*2,p.size);ctx.globalAlpha=1;ctx.restore();}
        } else if(type==='shimmer'){
          const alpha=fadeRatio*(0.3+0.3*Math.sin(Date.now()/150+p.x));
          ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=`rgba(200,230,255,${alpha})`;ctx.fill();
        }
      }
    }

    // ==========================================
    // === 绘制小地图 ===
    // ==========================================
    function drawMinimap(){
      if(!mapData) return;
      const mw=miniCanvas.width,mh=miniCanvas.height;
      const mapPixelW=mapData.width*TILE_SIZE,mapPixelH=mapData.height*TILE_SIZE;
      const scale=Math.min(mw/mapPixelW,mh/mapPixelH);
      miniCtx.clearRect(0,0,mw,mh);
      miniCtx.fillStyle='#2d3436'; miniCtx.fillRect(0,0,mw,mh);

      const zl=mapData.layers.find(l=>l.type==='objectgroup');
      if(zl&&zl.objects){
        const ts=TILE_SIZE/mapData.tilewidth;
        zl.objects.forEach(zone=>{
          const n=(zone.name||'').toLowerCase();
          if(n.includes('paved')||n.includes('road')) return;
          const zx=zone.x*ts*scale,zy=zone.y*ts*scale;
          const zw=Math.max((zone.width||20)*ts*scale,4),zh=Math.max((zone.height||20)*ts*scale,4);
          // 小地图同步强调当前跟随目标所在区域。
          if(selectedPlayerId&&clientPlayers[selectedPlayerId]&&clientPlayers[selectedPlayerId].currentZoneName===zone.name){
            miniCtx.fillStyle='rgba(116,185,255,0.5)'; miniCtx.fillRect(zx,zy,zw,zh);
            miniCtx.strokeStyle='#74b9ff'; miniCtx.lineWidth=1.5; miniCtx.strokeRect(zx,zy,zw,zh);
          } else if(n.includes('pond')||n.includes('water')){miniCtx.fillStyle='rgba(116,185,255,0.4)';miniCtx.fillRect(zx,zy,zw,zh);}
          else if(n.includes('tree')||n.includes('grass')){miniCtx.fillStyle='rgba(106,176,76,0.4)';miniCtx.fillRect(zx,zy,zw,zh);}
          else{miniCtx.fillStyle='rgba(253,203,110,0.3)';miniCtx.fillRect(zx,zy,zw,zh);}
          if(!n.includes('tree')&&!n.includes('paved')&&!n.includes('grass')){
            miniCtx.font='7px "Pixelify Sans",sans-serif';miniCtx.fillStyle='rgba(255,255,255,0.7)';
            miniCtx.textAlign='center';miniCtx.textBaseline='middle';
            miniCtx.fillText(zone.name.split('(')[0].trim().substring(0,6),zx+zw/2,zy+zh/2);
          }
        });
      }

      // 玩家点位与名字同时显示，方便在缩略图里快速定位。
      for(const id in clientPlayers){
        const p=clientPlayers[id];
        const px=p.displayX*scale+2,py=p.displayY*scale+2;
        miniCtx.beginPath(); miniCtx.arc(px,py,id===selectedPlayerId?4:3,0,Math.PI*2);
        miniCtx.globalAlpha=isPlayerIdle(p)?0.45:1;
        miniCtx.fillStyle=id===selectedPlayerId?'#74b9ff':(p.name==='Observer'?'#f1c40f':'#e74c3c'); miniCtx.fill();
        miniCtx.globalAlpha=1;
        miniCtx.font='bold 8px "Pixelify Sans",sans-serif'; miniCtx.fillStyle='#fff'; miniCtx.textAlign='center';
        miniCtx.fillText(p.name,px,py-6);
      }

      // 当前视口边框能帮助理解主画布正在看地图的哪一块。
      const vx=camera.x*scale,vy=camera.y*scale;
      const vw=(VIEWPORT_W/camera.zoom)*scale,vh=(VIEWPORT_H/camera.zoom)*scale;
      miniCtx.strokeStyle='rgba(255,255,255,0.65)'; miniCtx.lineWidth=1;
      miniCtx.setLineDash([3,2]); miniCtx.strokeRect(vx,vy,vw,vh); miniCtx.setLineDash([]);
    }

    // ==========================================
    // === 聊天日志 ===
    // ==========================================
    function addChatMessage(name,message,timestamp){
      chatMessages.push({type:'chat',name,message,time:timestamp||Date.now()});
      if(chatMessages.length>MAX_DISPLAY_MESSAGES) chatMessages.shift();
      renderChatEntry({type:'chat',name,message,time:timestamp||Date.now()});
    }
    function addInteractionMessage(entry){
      chatMessages.push({type:'interaction',...entry});
      if(chatMessages.length>MAX_DISPLAY_MESSAGES) chatMessages.shift();
      renderChatEntry({type:'interaction',...entry});
    }
    function renderChatEntry(entry){
      const div=document.createElement('div');
      div.className='chat-entry';
      const t=new Date(entry.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      if(entry.type==='chat')
        div.innerHTML=`<span class="chat-time">${t}</span> <span class="chat-name">${escapeHtml(entry.name)}</span>: ${escapeHtml(entry.message)}`;
      else{
        div.className='chat-entry interaction-entry';
        div.innerHTML=`<span class="chat-time">${t}</span> ${escapeHtml(entry.name)} @ ${escapeHtml(entry.zone||'')}: ${escapeHtml(entry.action||'')}`;
      }
      chatlogEl.appendChild(div); chatlogEl.scrollTop=chatlogEl.scrollHeight;
    }
    function escapeHtml(text){ const d=document.createElement('div'); d.textContent=text||''; return d.innerHTML; }

    // ==========================================
    // === AI 面板 ===
    // ==========================================
    function updateAiPanel(){
      const players=Object.values(clientPlayers).filter(p=>p.name!=='Observer');
      aiCountEl.textContent=`${players.length} active`;
      aiListEl.innerHTML='';
      players.forEach(p=>{
        const wrap=document.createElement('div');
        wrap.className='ai-avatar-wrap'+(selectedPlayerId===p.id?' selected':'');
        wrap.title=`${p.name}\n${p.currentZoneName||'protocol lane'}`;
        // Canvas: 32x32 internal, CSS sizes it responsively
        const ac=document.createElement('canvas'); ac.width=32; ac.height=32; ac.className='ai-avatar-icon';
        const si=(p.sprite&&characterImages[p.sprite])?characterImages[p.sprite]:images['player'];
        const actx=ac.getContext('2d');
        if(typeof p.solanaSpriteIndex==='number'){
          drawSolanaRosterCharacter(actx,p.solanaSpriteIndex,5,0,22,32);
        } else if(si&&si.complete){
          actx.imageSmoothingEnabled=false;
          // Sample the front-facing idle frame (row 0, col 0)
          const fw=si.width/4, fh=si.height/4;
          actx.drawImage(si, 0, 0, fw, fh, 0, 0, 32, 32);
        }
        const statusClass=p.isThinking?'thinking':(isPlayerIdle(p)?'idle':'active');
        const dot=document.createElement('span'); dot.className='ai-avatar-dot '+statusClass;
        const nameEl=document.createElement('span'); nameEl.className='ai-avatar-name'; nameEl.textContent=p.name;
        wrap.appendChild(ac); wrap.appendChild(dot); wrap.appendChild(nameEl);
        wrap.addEventListener('click',()=>{
          if(selectedPlayerId===p.id){ selectedPlayerId=null; isCameraFollowing=false; activityDetailEl.classList.remove('visible'); }
          else selectAndFollowPlayer(p.id);
          updateAiPanel();
        });
        aiListEl.appendChild(wrap);
      });
      if(selectedPlayerId&&!clientPlayers[selectedPlayerId]){ selectedPlayerId=null; isCameraFollowing=false; activityDetailEl.classList.remove('visible'); }
    }

    let selectedFlashTime=0;
    function renderActivityLog(playerId){
      const acts=playerActivityData[playerId]||[];
      activityLogEl.innerHTML='';
      acts.slice().reverse().forEach(a=>{
        const div=document.createElement('div'); div.className='activity-item';
        const t=new Date(a.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        div.innerHTML=`<span class="activity-time">${t}</span> <span class="activity-type-${a.type||'move'}">${escapeHtml(a.text||'')}</span>`;
        activityLogEl.appendChild(div);
      });
    }

    // ==========================================
    // === 统计面板 ===
    // ==========================================
    function updateStatsPanel(){
      const el=document.getElementById('stats-content'); if(!el) return;
      const stats={}; let hasData=false;
      for(const id in playerActivityData){
        const p=clientPlayers[id]; if(!p||p.name==='Observer') continue;
        const acts=playerActivityData[id]||[];
        stats[p.name]={
          moves:acts.filter(a=>a.type==='move').length,
          says:acts.filter(a=>a.type==='chat'||a.type==='say').length,
          interacts:acts.filter(a=>a.type==='interact').length,
          defi:acts.filter(a=>a.type==='defi').length,
        };
        if(acts.length>0) hasData=true;
      }
      const names=Object.keys(stats);
      if(!hasData||names.length===0){el.innerHTML='<span id="stats-empty">Waiting for activity...</span>';return;}
      const topMove=names.reduce((a,b)=>stats[a].moves>=stats[b].moves?a:b);
      const topSay=names.reduce((a,b)=>stats[a].says>=stats[b].says?a:b);
      const topInteract=names.reduce((a,b)=>stats[a].interacts>=stats[b].interacts?a:b);
      const topDefi=names.reduce((a,b)=>stats[a].defi>=stats[b].defi?a:b);
      let html='';
      if(stats[topMove].moves>0) html+=`<div class="stat-row">Most active: <span class="stat-name">${escapeHtml(topMove)}</span> (${stats[topMove].moves} moves)</div>`;
      if(stats[topSay].says>0) html+=`<div class="stat-row">Most social: <span class="stat-name">${escapeHtml(topSay)}</span> (${stats[topSay].says} chats)</div>`;
      if(stats[topInteract].interacts>0) html+=`<div class="stat-row">Most hands-on: <span class="stat-name">${escapeHtml(topInteract)}</span> (${stats[topInteract].interacts} actions)</div>`;
      if(stats[topDefi].defi>0) html+=`<div class="stat-row">Yield lead: <span class="stat-name">${escapeHtml(topDefi)}</span> (${stats[topDefi].defi} DeFi ticks)</div>`;
      el.innerHTML=html||'<span id="stats-empty">Waiting for activity...</span>';
    }
    setInterval(updateStatsPanel, 3000);

    function renderFallbackEconomy() {
      if (!economyContentEl) return;
      economyContentEl.innerHTML = ''
        + '<div class="stat-row">TVL: <span class="stat-name">$42,690</span></div>'
        + '<div class="stat-row">Emissions: <span class="stat-name">128 DUST/hr</span></div>'
        + '<div class="stat-row">LP Fees: <span class="stat-name">314 DUST</span></div>'
        + '<div class="stat-row">Risk: <span class="stat-name">18%</span></div>'
        + '<div class="stat-row">Static Vercel demo economy</div>';
    }

    function updateWalletYieldCard(agent, portfolio) {
      if (!walletAgentNameEl || !walletSglYieldEl || !walletAgentStatusEl) return;
      if (!agent && !portfolio) {
        walletAgentNameEl.textContent = 'No wallet agent yet';
        walletSglYieldEl.textContent = '0 SGL';
        walletAgentStatusEl.textContent = 'Generate an avatar and send it to work.';
        return;
      }
      const p = portfolio || agent.portfolio || {};
      walletAgentNameEl.textContent = agent?.name || p.name || 'SGL Agent';
      walletSglYieldEl.textContent = `${Number(p.sglYield || p.claimable || agent?.sglYield || 0).toLocaleString()} SGL`;
      const mode = p.mode || agent?.mode || 'normal';
      const modeLabel = mode === 'adventure' ? 'Adventure Mine' : 'Normal Work';
      const extra = mode === 'adventure'
        ? ` · ${Number(p.mineAttempts || 0)} mines · ${Number(p.treasureClues || 0)} clues`
        : ` · ${Number(p.stakedSol || 0).toFixed(2)} SOL · ${Number(p.lpShares || 0).toFixed(2)} LP`;
      walletAgentStatusEl.textContent = `${modeLabel}${extra} · risk ${Number(p.riskScore || 0)}%`;
    }

    function refreshWalletYield() {
      if (!localWalletAgentId) return;
      fetch(`/api/solana/agent/${encodeURIComponent(localWalletAgentId)}/yield`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.portfolio) updateWalletYieldCard(null, data.portfolio);
        })
        .catch(() => {});
    }

    function selectedAgentMode() {
      return document.querySelector('input[name="agent-mode"]:checked')?.value || 'normal';
    }

    function updateWalletConnectionStatus(address) {
      if (!walletConnectStatusEl || !connectWalletBtn) return;
      if (address) {
        walletConnectStatusEl.textContent = `${address.slice(0, 4)}...${address.slice(-4)}`;
        connectWalletBtn.textContent = 'Wallet Connected';
      } else {
        walletConnectStatusEl.textContent = 'Wallet optional';
        connectWalletBtn.textContent = 'Connect Solana Wallet';
      }
    }

    async function connectSolanaWallet() {
      const provider = window.solana || window.phantom?.solana;
      if (!provider || !provider.connect) {
        walletAgentStatusEl.textContent = 'No Solana wallet found. Install Phantom/Solflare or type a wallet handle.';
        return;
      }
      try {
        connectWalletBtn.disabled = true;
        connectWalletBtn.textContent = 'Connecting...';
        const result = await provider.connect();
        const address = result?.publicKey?.toString?.() || provider.publicKey?.toString?.() || '';
        if (!address) throw new Error('Wallet did not return a public key.');
        connectedWalletAddress = address;
        if (walletInputEl) walletInputEl.value = address;
        localStorage.setItem('sgl-wallet', address);
        updateWalletConnectionStatus(address);
        walletAgentStatusEl.textContent = 'Wallet connected. Choose a mode and start your run.';
      } catch (err) {
        walletAgentStatusEl.textContent = err?.message || 'Wallet connection cancelled.';
        updateWalletConnectionStatus(connectedWalletAddress);
      } finally {
        connectWalletBtn.disabled = false;
      }
    }

    function spawnWalletAgent() {
      if (!walletInputEl || !spawnAgentBtn) return;
      const wallet = walletInputEl.value.trim();
      if (!wallet) {
        walletAgentStatusEl.textContent = 'Add a wallet address or handle first.';
        walletInputEl.focus();
        return;
      }
      spawnAgentBtn.disabled = true;
      spawnAgentBtn.textContent = 'Launching...';
      fetch('/api/solana/agent/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, pet: petSelectEl?.value || 'generated', mode: selectedAgentMode() }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data?.success) throw new Error(data?.error || 'Could not launch agent');
          localWalletAgentId = data.agent.id;
          localStorage.setItem('sgl-agent-id', localWalletAgentId);
          localStorage.setItem('sgl-wallet', wallet);
          localStorage.setItem('sgl-pet', data.agent.pet);
          localStorage.setItem('sgl-mode', data.agent.mode || selectedAgentMode());
          updateWalletYieldCard(data.agent, data.agent.portfolio);
          walletAgentStatusEl.textContent = data.agent.mode === 'adventure'
            ? `${data.agent.name} entered Adventure Mine mode.`
            : `${data.agent.name} started Normal Work mode.`;
        })
        .catch(err => {
          walletAgentStatusEl.textContent = err.message || 'Launch failed.';
        })
        .finally(() => {
          spawnAgentBtn.disabled = false;
          spawnAgentBtn.textContent = 'Start Yield Run';
        });
    }

    if (walletInputEl) walletInputEl.value = localStorage.getItem('sgl-wallet') || '';
    if (petSelectEl) petSelectEl.value = localStorage.getItem('sgl-pet') || 'generated';
    const savedMode = localStorage.getItem('sgl-mode') || 'normal';
    const savedModeInput = document.querySelector(`input[name="agent-mode"][value="${savedMode}"]`);
    if (savedModeInput) savedModeInput.checked = true;
    updateWalletConnectionStatus(connectedWalletAddress);
    if (connectWalletBtn) connectWalletBtn.addEventListener('click', connectSolanaWallet);
    if (spawnAgentBtn) spawnAgentBtn.addEventListener('click', spawnWalletAgent);
    refreshWalletYield();
    setInterval(refreshWalletYield, 5000);

    function fetchEconomy() {
      fetch('/api/solana/economy')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !economyContentEl) {
            if (demoModeStarted) renderFallbackEconomy();
            return;
          }
          const t = data.treasury || {};
          const leader = (data.players || []).sort((a,b) => (b.claimable || 0) - (a.claimable || 0))[0];
          let html = '';
          html += `<div class="stat-row">TVL: <span class="stat-name">$${Number(t.tvl || 0).toLocaleString()}</span></div>`;
          html += `<div class="stat-row">Emissions: <span class="stat-name">${Number(t.rewardsPerHour || 0).toLocaleString()} SGL/hr</span></div>`;
          html += `<div class="stat-row">LP Fees: <span class="stat-name">${Number(t.lpFees || 0).toLocaleString()} SGL</span></div>`;
          html += `<div class="stat-row">Risk: <span class="stat-name">${Number(t.risk || 0)}%</span></div>`;
          html += `<div class="stat-row">Treasure Pool: <span class="stat-name">${Number(t.treasurePool || 0).toLocaleString()} SGL</span></div>`;
          if (leader) html += `<div class="stat-row">Top wallet: <span class="stat-name">${escapeHtml(leader.name)}</span> (${leader.sglYield || leader.claimable} SGL)</div>`;
          html += `<div class="stat-row">${escapeHtml(t.lastEvent || 'Economy initialized')}</div>`;
          economyContentEl.innerHTML = html;
        })
        .catch(() => {
          renderFallbackEconomy();
        });
    }
    fetchEconomy();
    setInterval(fetchEconomy, 5000);

    // ==========================================
    // === Zone 资源交互系统 ===
    // ==========================================
    let zoneResourceData = {};  // zoneId → { category, zoneName, resources }
    let hoveredZoneName = null; // 当前鼠标悬停的 zone 名称
    let rpgPluginAvailable = null; // null=未知, true=可用, false=不可用

    // 判断 zone 名称是否属于有协议库存的类型
    const RESOURCE_ZONE_PATTERNS = [
      /farm|农场|grass|草丛|tree|树/i,
      /集市|market/i,
      /shrine|神社/i,
      /warehouse|仓库/i,
      /药水|potion|magic|魔药/i,
      /practice|练习/i,
    ];
    function isResourceZone(name) {
      return RESOURCE_ZONE_PATTERNS.some(p => p.test(name || ''));
    }

    // 判断是否为神社区域
    function isShrineZone(name) {
      return /shrine|神社/i.test(name || '');
    }

    // 判断是否可以弹出面板的区域（协议库存区）
    function isClickableZone(name) {
      return isResourceZone(name) || isShrineZone(name);
    }

    // 拉取 zone 资源数据（静默失败，插件未加载时不影响）
    function fetchZoneResources() {
      fetch('/api/rpg/zones/resources')
        .then(r => {
          if (r.ok) { rpgPluginAvailable = true; return r.json(); }
          rpgPluginAvailable = false;
          console.log('[rpg] fetchZoneResources: HTTP', r.status);
          return null;
        })
        .then(data => {
          if (data) {
            zoneResourceData = data;
            console.log('[rpg] zoneResourceData updated:', Object.keys(data).length, 'zones');
          }
        })
        .catch((e) => { rpgPluginAvailable = false; console.log('[rpg] fetchZoneResources error:', e.message); });
    }
    // 启动后定时刷新资源数据
    fetchZoneResources();
    setInterval(fetchZoneResources, 10000);

    // 根据 zone 名称查找对应的资源数据（先精确匹配，再按类别模糊匹配）
    function findResourceByZoneName(zoneName) {
      // 精确匹配
      for (const [zoneId, data] of Object.entries(zoneResourceData)) {
        if (data.zoneName === zoneName) return { zoneId, ...data };
      }
      // 模糊匹配：用 RESOURCE_ZONE_PATTERNS 推断类别
      const CATEGORY_MAP = [
        [/farm|农场|grass|草丛|tree|树/i, 'farm'],
        [/集市|market/i, 'marketplace'],
        [/shrine|神社/i, 'shrine'],
        [/warehouse|仓库/i, 'warehouse'],
        [/药水|potion|magic|魔药/i, 'potion'],
        [/practice|练习/i, 'practice'],
      ];
      let targetCat = null;
      for (const [pat, cat] of CATEGORY_MAP) {
        if (pat.test(zoneName)) { targetCat = cat; break; }
      }
      if (targetCat) {
        for (const [zoneId, data] of Object.entries(zoneResourceData)) {
          if (data.category === targetCat) return { zoneId, ...data };
        }
      }
      return null;
    }

    // 检测点击位置是否命中某个 zone
    function getZoneAtMouse() {
      if (!mapData || mouseX < 0) return null;
      const zl = mapData.layers.find(l => l.type === 'objectgroup');
      if (!zl || !zl.objects) return null;
      const sx2 = TILE_SIZE / mapData.tilewidth, sy2 = TILE_SIZE / mapData.tileheight;
      for (const zone of zl.objects) {
        const rx = zone.x * sx2, ry = zone.y * sy2;
        const rw = zone.width * sx2, rh = zone.height * sy2;
        if (mouseX >= rx && mouseX <= rx + rw && mouseY >= ry && mouseY <= ry + rh) {
          return zone;
        }
      }
      return null;
    }

    // === Zone Popup 交互函数 ===
    function showZonePopup(zoneName, screenX, screenY) {
      const popup = document.getElementById('zone-popup');
      const titleEl = document.getElementById('zone-popup-title');
      const contentEl = document.getElementById('zone-popup-content');
      const msgEl = document.getElementById('zone-popup-msg');
      if (!popup || !titleEl || !contentEl) return;

      const resInfo = findResourceByZoneName(zoneName);
      console.log('[rpg] showZonePopup:', zoneName, 'resInfo:', resInfo, 'rpgPluginAvailable:', rpgPluginAvailable);
      titleEl.textContent = zoneName;
      msgEl.textContent = '';

      if (rpgPluginAvailable === false) {
        contentEl.innerHTML = '<div class="zone-inv-empty">'
          + 'Economy plugin is offline<br>'
          + '<span>Restart the server and try again.</span>'
          + '</div>';
      } else if (!resInfo) {
        const hasAnyData = Object.keys(zoneResourceData).length > 0;
        if (hasAnyData) {
          contentEl.innerHTML = '<div class="zone-inv-empty">No protocol inventory here</div>';
        } else {
          contentEl.innerHTML = '<div class="zone-inv-empty">Syncing protocol inventory...</div>';
          fetchZoneResources();
          setTimeout(() => {
            const retryInfo = findResourceByZoneName(zoneName);
            if (retryInfo) {
              showZonePopup(zoneName, screenX, screenY);
            } else if (contentEl) {
              const stillEmpty = Object.keys(zoneResourceData).length === 0;
              contentEl.innerHTML = '<div class="zone-inv-empty">' + (stillEmpty
                ? 'Protocol inventory is still booting'
                : 'No protocol inventory here') + '</div>';
            }
          }, 2500);
        }
      } else {
        // Inventory grid rendering
        const resEntries = Object.entries(resInfo.resources);
        if (resEntries.length === 0) {
          contentEl.innerHTML = '<div class="zone-inv-empty">This protocol vault is empty</div>';
        } else {
          let html = '<div class="zone-inv-grid">';
          for (const [key, res] of resEntries) {
            const iconName = res.icon || 'GoldCoin';
            const countClass = res.current <= 0 ? 'zero' : '';
            html += `<div class="zone-inv-slot" data-zone-id="${resInfo.zoneId}" data-res-key="${key}" title="Refill ${res.label}">`;
            html += `  <img class="zone-inv-icon" src="assets/items/${iconName}.png" alt="${res.label}">`;
            html += `  <span class="zone-inv-label">${res.label}</span>`;
            html += `  <span class="zone-inv-count ${countClass}">&times;${res.current}</span>`;
            html += `  <span class="zone-inv-plus">refill +1</span>`;
            html += `</div>`;
          }
          html += '</div>';
          html += '<div class="zone-popup-footer">Click an item to refill protocol inventory</div>';
          contentEl.innerHTML = html;

          // Bind click events on slots
          contentEl.querySelectorAll('.zone-inv-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
              e.stopPropagation();
              supplyZone(slot.dataset.zoneId, slot.dataset.resKey, slot);
            });
          });
        }
      }

      // 定位弹窗：移动端用底部抽屉（CSS 控制），桌面端靠近点击位置
      popup.style.display = 'block';
      const isMobile = window.innerWidth <= 600;
      if (isMobile) {
        // CSS @media 接管定位，清除内联样式
        popup.style.left = '';
        popup.style.top = '';
      } else {
        const popW = popup.offsetWidth, popH = popup.offsetHeight;
        let left = screenX + 12, top = screenY - popH / 2;
        if (left + popW > window.innerWidth - 10) left = screenX - popW - 12;
        if (top < 10) top = 10;
        if (top + popH > window.innerHeight - 10) top = window.innerHeight - popH - 10;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
      }
    }

    function closeZonePopup() {
      const popup = document.getElementById('zone-popup');
      if (popup) popup.style.display = 'none';
    }

    function supplyZone(zoneId, resourceType, slotEl) {
      const msgEl = document.getElementById('zone-popup-msg');
      if (!slotEl) return;
      // Prevent rapid clicks
      if (slotEl.dataset.busy === '1') return;
      slotEl.dataset.busy = '1';

      fetch(`/api/rpg/zones/${encodeURIComponent(zoneId)}/supply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType: resourceType, amount: 1 }),
      })
        .then(r => {
          if (!r.ok) return r.text().then(() => { throw new Error('HTTP ' + r.status); });
          return r.json();
        })
        .then(data => {
          if (data.success) {
            // Flash animation
            slotEl.classList.remove('adding');
            void slotEl.offsetWidth; // reflow to retrigger
            slotEl.classList.add('adding');
            // Update count in-place
            const countEl = slotEl.querySelector('.zone-inv-count');
            if (countEl) {
              countEl.textContent = '\u00d7' + data.current;
              countEl.classList.remove('zero');
            }
            // Update cache
            if (zoneResourceData[zoneId]?.resources?.[resourceType]) {
              zoneResourceData[zoneId].resources[resourceType].current = data.current;
            }
            if (msgEl) msgEl.textContent = data.message || 'Refilled';
            setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2000);
          } else {
            if (msgEl) msgEl.textContent = data.error || 'Refill failed';
          }
        })
        .catch((err) => {
          console.error('[rpg] supply error:', err);
          if (msgEl) msgEl.textContent = 'Request failed; check economy plugin';
        })
        .finally(() => {
          slotEl.dataset.busy = '0';
        });
    }

    // === 神社怪谈 Popup ===
    function showShrinePopup(zoneName, screenX, screenY) {
      const popup = document.getElementById('zone-popup');
      const titleEl = document.getElementById('zone-popup-title');
      const contentEl = document.getElementById('zone-popup-content');
      const msgEl = document.getElementById('zone-popup-msg');
      if (!popup || !titleEl || !contentEl) return;

      titleEl.textContent = zoneName + ' - Story Board';
      if (msgEl) msgEl.textContent = '';

      contentEl.innerHTML = '<div class="zone-inv-empty">Loading...</div>';

      // Position popup first
      popup.style.display = 'block';
      const isMobile = window.innerWidth <= 600;
      if (isMobile) {
        popup.style.left = ''; popup.style.top = '';
      } else {
        const popW = popup.offsetWidth, popH = popup.offsetHeight;
        let left = screenX + 12, top = screenY - popH / 2;
        if (left + popW > window.innerWidth - 10) left = screenX - popW - 12;
        if (top < 10) top = 10;
        if (top + popH > window.innerHeight - 10) top = window.innerHeight - popH - 10;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
      }

      fetch('/api/rpg/shrine/stories')
        .then(r => {
          if (!r.ok) {
            // 插件未加载时 404
            contentEl.innerHTML = '<div class="zone-inv-empty">'
              + 'This board is disabled in Solana Game Life<br>'
              + '<span>Use protocol zones for economy actions.</span>'
              + '</div>';
            return null;
          }
          return r.json();
        })
        .then(data => { if (data) renderShrineContent(contentEl, msgEl, data.stories || []); })
        .catch(() => {
          contentEl.innerHTML = '<div class="zone-inv-empty">'
            + 'This board is disabled in Solana Game Life<br>'
            + '<span>Use protocol zones for economy actions.</span>'
            + '</div>';
        });
    }

    function renderShrineContent(contentEl, msgEl, stories) {
      let html = '<div class="shrine-stories">';
      if (stories.length === 0) {
        html += '<div class="shrine-empty">No stories yet.<br>Be the first explorer to write one.</div>';
      } else {
        for (const s of stories) {
          const t = new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          html += '<div class="shrine-story">';
          html += `<span class="shrine-story-text">${escapeHtml(s.text)}</span>`;
          html += `<span class="shrine-story-meta">— ${escapeHtml(s.author)} ${t}</span>`;
          html += '</div>';
        }
      }
      html += '</div>';
      html += '<div class="shrine-input-row">';
      html += '<input class="shrine-input" type="text" maxlength="200" placeholder="Write a protocol story...">';
      html += '<button class="shrine-submit">Post</button>';
      html += '</div>';
      contentEl.innerHTML = html;

      const input = contentEl.querySelector('.shrine-input');
      const btn = contentEl.querySelector('.shrine-submit');
      function submitStory() {
        const text = (input.value || '').trim();
        if (!text) return;
        btn.disabled = true;
        fetch('/api/rpg/shrine/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.ok) {
              renderShrineContent(contentEl, msgEl, data.stories);
              if (msgEl) { msgEl.textContent = 'Story recorded'; setTimeout(() => { msgEl.textContent = ''; }, 2000); }
            } else {
              if (msgEl) msgEl.textContent = 'Post failed';
            }
          })
          .catch(() => { if (msgEl) msgEl.textContent = 'Request failed'; })
          .finally(() => { btn.disabled = false; });
      }
      btn.addEventListener('click', submitStory);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitStory(); });
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // 暴露到全局作用域（供 HTML onclick 调用）
    window.showZonePopup = showZonePopup;
    window.closeZonePopup = closeZonePopup;
    window.supplyZone = supplyZone;

    // 页面脚本只启动一次，真正的重连交给 EventSource 自己处理。
    initialize();
