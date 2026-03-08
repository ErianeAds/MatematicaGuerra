// ============================================
// LEGIÕES MÍTICAS: A IRA DE TROIA
// Script principal - Versão Épica Sombria
// ============================================

// ============================================
// INICIALIZAÇÃO DOS ELEMENTOS DO DOM
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui-layer');
const el = id => document.getElementById(id);

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let gateY = -1200;
let bossLevelY = -3000;

const screens = {
  menu: el('main-menu'),
  over: el('game-over-screen'),
  victory: el('victory-screen')
};

const txt = {
  level: el('level-indicator'),
  coins: el('coin-count'),
  energy: el('energy-count'),
  kills: el('final-kills'),
  finalLevel: el('final-level'),
  reward: el('level-coins'),
  levelNum: el('level-num')
};

// ============================================
// CONFIGURAÇÕES DO JOGO - TEMA SOMBRIO
// ============================================

const BOTTOM_PADDING = 140;

// Paleta de cores sombria para tema de Troia
const PALETTE = {
  // Céu noturno com tons de púrpura e vermelho
  skyTop: '#0a0508',
  skyBottom: '#1a0f0f',
  roadTint: 'rgba(70, 30, 30, 0.25)',
  sideSand: '#2a1a1a',
  laneLine: '#8b4513',
  cream: '#d4a373',
  creamDark: '#9c6b3f',
  // Tons de bronze e sangue
  bronze: '#cd7f32',
  bronzeDark: '#8b5a2b',
  blood: '#8b0000',
  bloodLight: '#b22222',
  // Cores para elementos do jogo
  enemyRed: '#8b1a1a',
  risk: '#b22222',
  bonus: '#daa520',
  // Efeitos especiais
  gold: '#ffd700',
  goldDark: '#b8860b',
  fire: '#ff4500',
  ice: '#4682b4',
  poison: '#2e8b57',
  magic: '#9370db'
};

function getSceneScale() {
  return Math.max(0.82, Math.min(1.02, canvas.width / 430));
}

function getLaneOffset() {
  return Math.min(122 * getSceneScale(), canvas.width * 0.24);
}

function positionHorde() {
  const bottomPadding = Math.max(108, canvas.height * 0.16);
  h.y = Math.max(150, canvas.height - bottomPadding);
}

// ============================================
// CONFIGURAÇÕES EXPANDIDAS
// ============================================

const CFG = {
  speed: 98,
  eSpeed: 35,
  eReg: 6,
  bulletSpeedMult: 3,
  maxWarriors: 20,
  spawnRate: 3,
  modifierMin: 1,
  modifierMax: 8,
  hazardDamageMin: 1,
  hazardDamageMax: 6,

  weapons: {
    spear: { r: 80, fr: 0.2, dmg: 5, area: 0, color: PALETTE.gold, name: 'LANÇA' },
    bow: { r: 350, fr: 0.5, dmg: 4, area: 0, color: PALETTE.fire, name: 'ARCO' },
    cannon: { r: 250, fr: 1.2, dmg: 15, area: 60, color: PALETTE.blood, name: 'CANHÃO' }
  },

  skills: {
    arrow: { cost: 5, cd: 3, name: 'SETAS', icon: '🏹', color: PALETTE.fire },
    shield: { cost: 15, cd: 12, name: 'ESCUDO', icon: '🛡️', color: PALETTE.ice },
    fire: { cost: 20, cd: 15, name: 'FOGO', icon: '🔥', color: PALETTE.blood },
    heal: { cost: 10, cd: 8, name: 'CURA', icon: '💊', color: PALETTE.poison }
  },

  combos: {
    5: { mult: 1.5, name: 'DOBRO' },
    10: { mult: 2.0, name: 'TRIPLO' },
    20: { mult: 3.0, name: 'SUPREMO' }
  }
};

// ============================================
// ESTADO DO JOGO
// ============================================

let state = 'MENU';
let lastTime = 0;
let level = 1;
let coins = 0;
let energy = 100;
let totalKills = 0;
let dist = 0;
let gSpeed = CFG.speed;
let shake = 0;
let time = 0;
let combo = 1;
let comboT = 0;
let sShield = 0;

let entities = [];
let particles = [];
let projectiles = [];
let decors = [];
let floatingTexts = [];
let achievements = [];

let lastTap = 0;
let shotsSimultaneous = 1;
let gateRowCounter = 0;

// ============================================
// OBJETO DA HORDA
// ============================================

let h = {
  x: 250,
  y: 750,
  count: 1,
  targetX: 250,
  dCount: 1,
  units: [],
  vx: 0,
  tilt: 0,
  dodge: 0,
  weapon: 'spear',
  wTimers: { spear: 0, bow: 0, cannon: 0 },
  cooldowns: { arrow: 0, shield: 0, fire: 0, heal: 0 },
  firePower: 1,
  shootSpeed: 1,
  critChance: 0.05,
  critMultiplier: 2,
  armor: 1,
  speedBoost: 1,
  luck: 1,
  kills: 0
};

// ============================================
// SISTEMA DE PARTÍCULAS SOMBRIO
// ============================================

const ParticleSystem = {
  spawn(x, y, color, count, type = 'normal') {
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 200 + 100;
      let life = Math.random() * 0.8 + 0.4;
      let size = Math.random() * 8 + 3;

      if (type === 'explosion') {
        speed = Math.random() * 400 + 200;
        size = Math.random() * 12 + 5;
      } else if (type === 'sparkle') {
        speed = Math.random() * 100 + 50;
        size = Math.random() * 4 + 2;
      }

      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        l: life,
        color,
        s: size,
        type,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  },

  spawnTrail(x, y, color) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
      l: 0.3,
      color,
      s: Math.random() * 3 + 2,
      type: 'trail',
      rotation: 0,
      rotSpeed: 0
    });
  },

  spawnBlood(x, y, amount = 10) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300 - 100,
        l: 0.8,
        color: `rgba(139, 0, 0, ${Math.random() * 0.8 + 0.2})`,
        s: Math.random() * 8 + 4,
        type: 'blood',
        gravity: 500
      });
    }
  },

  spawnMagic(x, y, color = PALETTE.gold) {
    for (let i = 0; i < 15; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200 - 100,
        l: 1,
        color: color,
        s: Math.random() * 6 + 2,
        type: 'magic',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  },

  spawnDust(x, y) {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + 10,
        vx: (Math.random() - 0.5) * 50,
        vy: -Math.random() * 50,
        l: 0.5,
        color: `rgba(100, 50, 20, ${Math.random() * 0.5})`,
        s: Math.random() * 10 + 5,
        type: 'dust'
      });
    }
  },

  spawnFire(x, y, amount = 8) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 200 - 100,
        l: 0.6,
        color: `rgba(255, ${Math.random() * 100 + 50}, 0, ${Math.random() * 0.8 + 0.2})`,
        s: Math.random() * 10 + 5,
        type: 'fire',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 5
      });
    }
  }
};

// ============================================
// SISTEMA DE TEXTO FLUTUANTE
// ============================================

const FloatingText = {
  add(x, y, text, type = 'positive') {
    floatingTexts.push({
      x, y,
      text,
      type,
      life: 1,
      vy: -60,
      vx: (Math.random() - 0.5) * 20
    });
  }
};

const spawnP = (x, y, color, n, type) => ParticleSystem.spawn(x, y, color, n, type);
const floating = (x, y, str, cls) => FloatingText.add(x, y, str, cls);

// ============================================
// SISTEMA DE ÁUDIO
// ============================================

let audioCtx;
const sounds = {
  attack: [300, 400, 500],
  hit: [150, 200],
  kill: [600, 800],
  collect: [700, 800, 900],
  skill: [400, 500, 600],
  levelUp: [200, 300, 400, 500],
  boss: [80, 120, 160],
  victory: [300, 400, 500, 600, 700]
};

const playSnd = (freq, type = 'sine', dur = 0.1, vol = 0.05, detune = 0) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (detune) o.detune.setValueAtTime(detune, audioCtx.currentTime);

    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

    o.connect(g);
    g.connect(audioCtx.destination);

    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) { }
};

const playSoundEffect = (type, variation = 0) => {
  if (!sounds[type]) return;
  const freq = sounds[type][variation % sounds[type].length] || sounds[type][0];
  const wave = type === 'boss' ? 'sawtooth' : type === 'hit' ? 'triangle' : 'sine';
  const vol = type === 'boss' ? 0.15 : 0.08;
  playSnd(freq, wave, 0.15, vol, Math.random() * 50);
};

// ============================================
// SISTEMA DE COMBOS
// ============================================

const updateCombo = kills => {
  combo = Math.min(30, combo + kills);
  comboT = 3;

  for (let [threshold, data] of Object.entries(CFG.combos)) {
    if (combo >= threshold && !achievements.includes(`combo_${threshold}`)) {
      achievements.push(`combo_${threshold}`);
      FloatingText.add(cx(), canvas.height * 0.45, `${data.name} COMBO!`, 'special');
      playSoundEffect('levelUp', 2);

      if (threshold == 5) h.critChance += 0.05;
      if (threshold == 10) h.firePower += 0.5;
      if (threshold == 20) h.speedBoost += 0.3;
    }
  }
};

// ============================================
// SISTEMA DE BACKGROUND SOMBRIO
// ============================================

const roadImg = new Image();
roadImg.src = 'road.png';

let roadReady = false;
roadImg.onload = () => (roadReady = true);
roadImg.onerror = () => console.warn('Não carregou road.png');

const soldierImg = new Image();
soldierImg.src = 'soldier.png';
let soldierReady = false;
soldierImg.onload = () => (soldierReady = true);
soldierImg.onerror = () => console.warn('Não carregou soldier.png');

const BG_SPEED_FACTOR = 1;

function drawRoadBackground() {
  const cw = canvas.width;
  const ch = canvas.height;

  // Fundo noturno com gradiente dramático
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, '#0a0508');
  grad.addColorStop(0.3, '#1a0f0f');
  grad.addColorStop(0.7, '#2a1a1a');
  grad.addColorStop(1, '#1a0f0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Efeito de chamas distantes
  ctx.fillStyle = 'rgba(139, 0, 0, 0.1)';
  for (let i = 0; i < 3; i++) {
    let x = Math.random() * cw;
    let y = Math.random() * ch;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Estrada de terra escura
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(cw * 0.15, 0, cw * 0.7, ch);

  // Marcas de carroça
  ctx.strokeStyle = '#3a2a2a';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 40]);
  for (let i = 0; i < 2; i++) {
    let x = cw * (0.3 + i * 0.4);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ch);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Laterais com ruínas
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(0, 0, cw * 0.15, ch);
  ctx.fillRect(cw * 0.85, 0, cw * 0.15, ch);

  // Tochas nas laterais
  for (let side of ['left', 'right']) {
    let x = side === 'left' ? cw * 0.1 : cw * 0.9;
    for (let i = 0; i < 3; i++) {
      let y = (ch / 3) * i + 50;
      
      // Poste
      ctx.fillStyle = '#4a3a3a';
      ctx.fillRect(x - 5, y - 20, 10, 40);
      
      // Fogo
      let gradient = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 15);
      gradient.addColorStop(0, '#ff4500');
      gradient.addColorStop(0.5, '#ff8c00');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y - 30, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================
// SISTEMA DE DESENHO AVANÇADO
// ============================================

function drawCharacter(ctx, x, y, type = 'player', variant = 'normal') {
  ctx.save();
  ctx.translate(x, y);

  // Sombra projetada
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 5;

  if (type === 'player') {
    if (soldierReady) {
      const imgWidth = 40;
      const imgHeight = 60;
      if (variant === 'elite') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = PALETTE.gold;
      }
      ctx.drawImage(soldierImg, -imgWidth / 2, -imgHeight + 10, imgWidth, imgHeight);
    } else {
      // Legionário Romano - versão sombria
      
      // Armadura de bronze escura
      ctx.fillStyle = PALETTE.bronzeDark;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Detalhes da armadura
      ctx.strokeStyle = PALETTE.goldDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.lineTo(8, -5);
      ctx.stroke();
      
      // Capacete com crista vermelha
      ctx.fillStyle = PALETTE.bronze;
      ctx.beginPath();
      ctx.ellipse(0, -18, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Crista (pluma vermelha)
      ctx.fillStyle = PALETTE.blood;
      ctx.fillRect(-10, -28, 20, 8);
      
      // Olhos brilhantes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-4, -20, 2, 0, Math.PI * 2);
      ctx.arc(4, -20, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-4, -20, 1, 0, Math.PI * 2);
      ctx.arc(4, -20, 1, 0, Math.PI * 2);
      ctx.fill();
      
      // Escudo
      ctx.fillStyle = PALETTE.bloodDark;
      ctx.beginPath();
      ctx.ellipse(15, -5, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

  } else if (type === 'enemy') {
    // Guerreiro Troiano - versão sombria
    ctx.fillStyle = PALETTE.enemyRed;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Armadura troiana
    ctx.fillStyle = '#4a3a3a';
    ctx.fillRect(-10, -5, 20, 10);

    // Capacete com crista
    ctx.fillStyle = '#6a5a5a';
    ctx.beginPath();
    ctx.ellipse(0, -18, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crista vermelha
    ctx.fillStyle = PALETTE.blood;
    ctx.fillRect(-8, -28, 16, 8);

    // Olhos vermelhos
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-4, -20, 2, 0, Math.PI * 2);
    ctx.arc(4, -20, 2, 0, Math.PI * 2);
    ctx.fill();

    // Lança
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, -15);
    ctx.lineTo(30, 5);
    ctx.stroke();

  } else if (type === 'trojan') {
    // Cavalo de Troia - versão sombria
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabeça
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath();
    ctx.ellipse(25, -10, 15, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Olho vermelho
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(32, -12, 3, 0, Math.PI * 2);
    ctx.fill();

    // Rodas com pontas
    ctx.fillStyle = '#2a2a2a';
    for (let x of [-20, 20]) {
      ctx.beginPath();
      ctx.arc(x, 15, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Raios
      ctx.strokeStyle = '#8a8a8a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let angle = (i * Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * 3, 15 + Math.sin(angle) * 3);
        ctx.lineTo(x + Math.cos(angle) * 8, 15 + Math.sin(angle) * 8);
        ctx.stroke();
      }
    }

    // Chamas saindo do cavalo
    ctx.fillStyle = 'rgba(255, 69, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(0, -10, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================
// SISTEMA DE ATMOSFERA
// ============================================

class Atmosphere {
  constructor() {
    this.rain = [];
    this.sparks = [];
    this.fog = [];
    this.embers = [];
  }

  update(dt) {
    const cw = canvas.width;
    const ch = canvas.height;

    // Efeito de cinzas (sempre presente)
    if (Math.random() > 0.95) {
      this.embers.push({
        x: Math.random() * cw,
        y: -10,
        vx: (Math.random() - 0.5) * 20,
        vy: Math.random() * 50 + 30,
        life: 1,
        size: Math.random() * 4 + 2
      });
    }

    // Desenha cinzas
    this.embers = this.embers.filter(e => {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt * 0.5;

      if (e.y > ch + 20 || e.life <= 0) return false;

      ctx.save();
      ctx.globalAlpha = e.life * 0.5;
      ctx.fillStyle = '#ff8c00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff4500';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return true;
    });

    // Efeito de fogo distante (quando perto do chefe)
    if (state === 'PLAYING' && entities.some(e => e.type === 'boss' && !e.dead)) {
      ctx.fillStyle = 'rgba(255, 69, 0, 0.1)';
      for (let i = 0; i < 3; i++) {
        let x = Math.random() * cw;
        let y = Math.random() * ch;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

const atmosphere = new Atmosphere();

// ============================================
// FUNÇÕES DE CONTROLE DA HORDA
// ============================================

function updateHorde(n) {
  let old = h.count;
  h.count = Math.max(0, Math.floor(n));
  const target = Math.min(h.count, 100);

  while (h.units.length < target) {
    h.units.push({
      rx: 0,
      ry: 0,
      tx: 0,
      ty: 0,
      b: Math.random() * Math.PI * 2,
      s: 0,
      type: Math.random() > 0.9 ? 'elite' : 'normal',
      offset: Math.random() * Math.PI * 2
    });
  }

  while (h.units.length > target) h.units.pop();

  if (n > old) {
    updateCombo(1);
    playSoundEffect('kill');
  } else if (n < old) combo = 1;
}

// ============================================
// SISTEMA DE INPUT
// ============================================

const input = (x, isTap = false) => {
  if (state === 'PLAYING') {
    h.targetX = Math.max(40, Math.min(canvas.width - 40, x));

    if (isTap) {
      const now = Date.now();
      const delay = now - lastTap;

      if (delay < 300 && delay > 10) {
        fireProjectile();
      }
      lastTap = now;

      if (Math.abs(x - h.x) > 100 && h.dodge <= 0) {
        h.dodge = 0.4;
        ParticleSystem.spawnTrail(h.x, h.y, PALETTE.gold);
      }
    }
  }
};

function fireProjectile() {
  const bulletSpeed = CFG.speed * CFG.bulletSpeedMult;
  for (let i = 0; i < shotsSimultaneous; i++) {
    const offsetX = (i - (shotsSimultaneous - 1) / 2) * 20;
    projectiles.push({
      x: h.x + offsetX,
      y: h.y,
      vy: -bulletSpeed,
      vx: 0,
      active: true,
      type: 'bullet',
      p: 0
    });
  }
  playSoundEffect('attack');
}

canvas.addEventListener('mousemove', e => input(e.clientX - canvas.getBoundingClientRect().left));
canvas.addEventListener('mousedown', e => input(e.clientX - canvas.getBoundingClientRect().left, true));

canvas.addEventListener(
  'touchmove',
  e => {
    e.preventDefault();
    input(e.touches[0].clientX - canvas.getBoundingClientRect().left);
  },
  { passive: false }
);

canvas.addEventListener(
  'touchstart',
  e => {
    e.preventDefault();
    input(e.touches[0].clientX - canvas.getBoundingClientRect().left, true);
  },
  { passive: false }
);

// ============================================
// SISTEMA DE HABILIDADES
// ============================================

const useSkill = (id, cost, cd, fn) => {
  if (energy < cost || h.cooldowns[id] > 0) return false;
  energy -= cost;
  h.cooldowns[id] = cd;
  fn();
  updateUI();
  playSoundEffect('skill', Math.floor(Math.random() * 3));

  ParticleSystem.spawn(h.x, h.y, CFG.skills[id].color, 15, 'explosion');
  ParticleSystem.spawnFire(h.x, h.y, 10);
  FloatingText.add(h.x, h.y, CFG.skills[id].icon, 'special');

  return true;
};

// ============================================
// SISTEMA DE MODIFICADORES
// ============================================

function randomModifierOperation() {
  const roll = Math.random();
  if (roll < 0.55) return '+';
  if (roll < 0.8) return '-';
  return 'x';
}

function randomModifierValue(op) {
  if (op === 'x') return Math.random() > 0.5 ? 2 : 3;
  return Math.floor(Math.random() * (CFG.modifierMax - CFG.modifierMin + 1)) + CFG.modifierMin;
}

function buildGatePair() {
  const positivePool = [
    { op: '+', value: Math.max(2, randomModifierValue('+')) },
    { op: 'x', value: 2 },
    { op: '+', value: Math.max(3, randomModifierValue('+')) }
  ];

  const negativePool = [
    { op: '-', value: Math.min(6, Math.max(1, randomModifierValue('-'))) },
    { op: '-', value: Math.min(8, Math.max(2, randomModifierValue('-'))) },
    { op: 'x', value: 3 }
  ];

  let left = positivePool[Math.floor(Math.random() * positivePool.length)];
  let right = negativePool[Math.floor(Math.random() * negativePool.length)];

  if (Math.random() > 0.5) [left, right] = [right, left];

  return { left, right };
}

function findGatePairMembers(rowId) {
  return entities.filter(e => e.type === 'modifier' && e.rowId === rowId && !e.dead);
}

function resolveGateRow(rowId, chosenSide, screenY) {
  const pair = findGatePairMembers(rowId);
  if (!pair.length) return;

  pair.forEach(member => {
    if (member.side === chosenSide) {
      applyModifier(member, screenY);
    } else {
      member.passed = true;
    }
    member.dead = true;
  });
}

function applyModifier(modifier, screenY) {
  if (modifier.passed) return;
  modifier.passed = true;

  let before = h.count;
  let after = before;

  if (modifier.op === '+') after = before + modifier.value;
  else if (modifier.op === '-') after = before - modifier.value;
  else if (modifier.op === 'x') after = before * modifier.value;

  after = Math.max(0, Math.min(999, Math.floor(after)));
  updateHorde(after);

  const sign = modifier.op === 'x' ? `x${modifier.value}` : `${modifier.op}${modifier.value}`;
  const positive = after >= before;
  floating(modifier.x, screenY - 10, `${sign} GUERREIROS`, positive ? 'positive' : 'negative');
  
  if (positive) {
    ParticleSystem.spawnMagic(modifier.x, screenY, PALETTE.gold);
    ParticleSystem.spawn(modifier.x, screenY, PALETTE.gold, 18, 'explosion');
  } else {
    ParticleSystem.spawnBlood(modifier.x, screenY, 15);
    ParticleSystem.spawn(modifier.x, screenY, PALETTE.blood, 18, 'explosion');
  }
  
  playSoundEffect(positive ? 'skill' : 'hit');

  if (after <= 0) fail();
}

function randomHazardDamage(base = 0) {
  return Math.max(
    CFG.hazardDamageMin,
    Math.min(
      CFG.hazardDamageMax + level,
      base + Math.floor(Math.random() * 3) + 1
    )
  );
}

function buildHazardRow(y, laneOffset) {
  const types = ['wall', 'saw', 'blocker'];
  const chosenType = types[Math.floor(Math.random() * types.length)];
  const sceneScale = getSceneScale();

  const hazard = new Entity(chosenType, cx(), y, randomHazardDamage(level));
  hazard.w = chosenType === 'wall' ? canvas.width * 0.28 : 104 * sceneScale;
  hazard.h = chosenType === 'wall' ? 78 * sceneScale : 104 * sceneScale;
  hazard.damage = hazard.v;

  if (chosenType !== 'wall') {
    hazard.x = Math.random() > 0.5 ? cx() - laneOffset : cx() + laneOffset;
  }

  return hazard;
}

// ============================================
// CLASSE DE ENTIDADES
// ============================================

class Entity {
  constructor(t, x, y, val) {
    this.type = t;
    this.x = x;
    this.y = y;
    this.v = val;
    this.dead = false;
    this.u = [];
    this.f = 0;
    this.burning = 0;
    this.frozen = 0;
    this.poisoned = 0;
    this.op = null;
    this.value = 0;
    this.w = 90;
    this.h = 110;
    this.passed = false;
    this.side = null;
    this.rowId = null;
    this.damage = 0;
    this.spin = Math.random() * Math.PI * 2;
  }

  draw(dy) {
    let Y = this.y + dy;
    if (Y < -200 || Y > canvas.height + 200) return;

    ctx.save();
    ctx.translate(this.x, Y);

    if (this.burning > 0) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ff4500';
    }

    if (this.type === 'modifier') {
      const positive = this.op === '+' || this.op === 'x';
      const label = this.op === 'x' ? `x${this.value}` : `${this.op}${this.value}`;
      const gateHeight = this.h + 78;
      
      // Estrutura de pedra escura
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-this.w / 2 - 15, -gateHeight / 2, 20, gateHeight);
      ctx.fillRect(this.w / 2 - 5, -gateHeight / 2, 20, gateHeight);
      
      // Portal com efeito de brilho
      ctx.shadowBlur = 30;
      ctx.shadowColor = positive ? '#00ff00' : '#ff0000';
      
      ctx.fillStyle = positive ? '#2a5a2a' : '#5a2a2a';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 18);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Borda dourada
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 18);
      ctx.stroke();
      
      // Texto brilhante
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 10);
      
      ctx.font = 'bold 16px Cinzel';
      ctx.fillText(positive ? 'BÊNÇÃO' : 'MALDIÇÃO', 0, 40);

    } else if (this.type === 'wall') {
      // Muralha de pedra com detalhes
      ctx.fillStyle = '#4a4a4a';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff0000';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
      ctx.fill();
      
      // Textura de pedra
      ctx.fillStyle = '#6a6a6a';
      for (let i = -2; i <= 2; i++) {
        for (let j = -1; j <= 1; j++) {
          ctx.fillRect(i * 40 - 20, j * 30 - 10, 30, 20);
        }
      }
      
      // Dano em vermelho
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 24px Cinzel';
      ctx.fillText(`-${this.damage}`, 0, 0);

    } else if (this.type === 'saw') {
      // Serra giratória com efeito de fogo
      this.spin += 0.1;
      ctx.rotate(this.spin);
      
      // Dentes da serra
      ctx.fillStyle = '#8a8a8a';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5, -50, 10, 25);
      }
      
      // Centro
      ctx.fillStyle = '#ff4500';
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.rotate(-this.spin);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Cinzel';
      ctx.fillText(`-${this.damage}`, 0, 70);

    } else if (this.type === 'blocker') {
      // Escudo gigante
      ctx.fillStyle = '#4a2a2a';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff0000';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
      ctx.fill();
      
      // Detalhes de escudo
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Cinzel';
      ctx.fillText(`-${this.damage}`, 0, 10);

    } else if (this.type === 'enemy') {
      if (this.f > 0) ctx.filter = 'brightness(200%)';
      if (this.burning > 0) ctx.filter = 'brightness(150%) hue-rotate(-30deg)';

      this.u.forEach((u, i) => {
        let xOffset = u.x + Math.sin(time * 3 + i) * 2;
        let yOffset = u.y + Math.cos(time * 2 + i) * 2;

        drawCharacter(ctx, xOffset, yOffset, 'enemy', u.type || 'normal');
      });

    } else if (this.type === 'cart') {
      // Carroça de guerra
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(-30, -20, 60, 35);
      
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-20, -30, 40, 15);
      
      // Rodas
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(-20, 15, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, 15, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Ouro
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '30px Arial';
      ctx.fillText('💰', 0, -30);

    } else if (this.type === 'trojan') {
      drawCharacter(ctx, 0, 0, 'trojan');

    } else if (this.type === 'boss') {
      const s = getSceneScale();

      // Chefe épico
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#ff0000';
      
      // Corpo
      ctx.fillStyle = '#8b0000';
      ctx.beginPath();
      ctx.roundRect(-80 * s, -70 * s, 160 * s, 160 * s, 20 * s);
      ctx.fill();
      
      // Armadura
      ctx.fillStyle = '#cd7f32';
      ctx.beginPath();
      ctx.roundRect(-60 * s, -50 * s, 120 * s, 120 * s, 15 * s);
      ctx.fill();
      
      // Cabeça com chamas
      ctx.fillStyle = '#ff4500';
      ctx.beginPath();
      ctx.arc(0, -30 * s, 30 * s, 0, Math.PI * 2);
      ctx.fill();
      
      // Olhos
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-15 * s, -40 * s, 5 * s, 0, Math.PI * 2);
      ctx.arc(15 * s, -40 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-15 * s, -40 * s, 2 * s, 0, Math.PI * 2);
      ctx.arc(15 * s, -40 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      
      // Barra de vida
      const maxHp = this.maxV || (140 + level * 180);
      
      // Fundo da barra
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-90 * s, -120 * s, 180 * s, 20 * s);
      
      // Vida atual
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(-90 * s, -120 * s, 180 * s * Math.max(0, this.v / maxHp), 20 * s);
      
      // Borda
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3 * s;
      ctx.strokeRect(-90 * s, -120 * s, 180 * s, 20 * s);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${20 * s}px Cinzel`;
      ctx.textAlign = 'center';
      ctx.fillText(`PRÍNCIPE DE TROIA`, 0, -150 * s);
    }

    ctx.restore();
  }
}

// ============================================
// SISTEMA DE RESIZE
// ============================================

function resize() {
  canvas.width = Math.min(window.innerWidth, 500);
  canvas.height = Math.min(window.innerHeight, 900);

  h.x = cx();
  h.targetX = cx();

  positionHorde();
}

const cx = () => canvas.width / 2;
window.addEventListener('resize', resize);

// ============================================
// SISTEMA DE CARREGAMENTO DE FASES
// ============================================

function loadLevel(l) {
  level = l;
  state = 'PLAYING';
  dist = 0;
  totalKills = 0;
  h.kills = 0;
  entities = [];
  projectiles = [];
  decors = [];
  floatingTexts = [];
  energy = 100;
  combo = 1;
  shotsSimultaneous = 1;
  gateRowCounter = 0;
  h.dodge = 0;

  h.firePower = 1;
  h.shootSpeed = 1;
  updateHorde(1);

  const levelLength = 4200 + l * 1500;
  gateY = -levelLength + 1000;

  for (let i = 0; i < levelLength / 300; i++) {
    let y = -400 - i * 400;
    let type = Math.random();

    if (y < -levelLength + canvas.height * 0.55) continue;

    const laneOffset = getLaneOffset();

    if (i > 1 && i % 3 === 0) {
      const gateRow = buildGatePair();
      const rowId = ++gateRowCounter;

      const left = new Entity('modifier', cx() - laneOffset, y, 0);
      left.op = gateRow.left.op;
      left.value = gateRow.left.value;
      left.w = 102 * getSceneScale();
      left.h = 112 * getSceneScale();
      left.side = 'left';
      left.rowId = rowId;

      const right = new Entity('modifier', cx() + laneOffset, y, 0);
      right.op = gateRow.right.op;
      right.value = gateRow.right.value;
      right.w = 102 * getSceneScale();
      right.h = 112 * getSceneScale();
      right.side = 'right';
      right.rowId = rowId;

      entities.push(left, right);
      continue;
    }

    if (i > 2 && i % 5 === 0) {
      entities.push(buildHazardRow(y, laneOffset));
      continue;
    }

    if (type < 0.25) {
      entities.push(new Entity('cart', Math.random() * (canvas.width - 120) + 60, y));
    } else if (type < 0.5) {
      let e = new Entity('trojan', cx(), y);
      e.swing = Math.random() * Math.PI;
      entities.push(e);
    } else {
      let e = new Entity('enemy', Math.random() * (canvas.width - 180) + 90, y, 5 + level);
      for (let j = 0; j < e.v; j++) {
        e.u.push({
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 40,
          type: j === 0 ? 'leader' : 'normal'
        });
      }
      entities.push(e);
    }
  }

  const boss = new Entity('boss', cx(), -levelLength + canvas.height * 0.18, 140 + l * 180);
  boss.maxV = boss.v;
  boss.w = 190 * getSceneScale();
  boss.h = 190 * getSceneScale();
  bossLevelY = boss.y;
  entities.push(boss);

  for (let i = 0; i < levelLength / 280; i++) {
    decors.push({ x: 30, y: -i * 280, type: 'house', side: 'left' });
    decors.push({ x: canvas.width - 30, y: -i * 280, type: 'house', side: 'right' });
  }

  updateUI();
  ParticleSystem.spawnMagic(cx(), canvas.height * 0.45, PALETTE.gold);
  FloatingText.add(cx(), canvas.height * 0.45, `CERCO A TROIA - NÍVEL ${l}`, 'special');
}

// ============================================
// FUNÇÕES DE FIM DE JOGO
// ============================================

function fail() {
  state = 'MENU';
  screens.over.classList.add('active');
  txt.kills.innerText = totalKills;
  txt.finalLevel.innerText = level;

  if (totalKills > localStorage.getItem('record')) {
    localStorage.setItem('record', totalKills);
  }
  
  // Efeito de derrota
  for (let i = 0; i < 20; i++) {
    ParticleSystem.spawnBlood(cx(), canvas.height / 2, 1);
  }
}

function win() {
  state = 'MENU';
  screens.victory.classList.add('active');
  let r = Math.floor(h.count * (2 + level * 0.3) * h.firePower * combo);
  coins += r;
  txt.reward.innerText = r;

  if (combo > 20) coins += 50;

  playSoundEffect('victory');
  
  // Efeito de vitória
  for (let i = 0; i < 30; i++) {
    ParticleSystem.spawnMagic(cx() + (Math.random() - 0.5) * 200, 
                              canvas.height / 2 + (Math.random() - 0.5) * 200, 
                              PALETTE.gold);
  }
}

// ============================================
// ATUALIZAÇÃO DA INTERFACE
// ============================================

function updateUI() {
  txt.levelNum.innerText = level;
  txt.coins.innerText = coins;
  txt.energy.innerText = Math.floor(energy);

  let progress = Math.min(1, Math.abs(dist / bossLevelY));
  el('progress-bar').style.width = progress * 100 + '%';
}

// ============================================
// GAME LOOP PRINCIPAL
// ============================================

function gameLoop(t) {
  let dt = (t - lastTime) / 1000;
  if (dt > 0.1 || isNaN(dt)) dt = 0.016;
  lastTime = t;

  if (state === 'PLAYING') {
    time += dt;
    dist += gSpeed * h.speedBoost * (h.dodge > 0 ? 2.0 : 1) * dt;

    if (sShield > 0) {
      sShield -= dt;
      if (sShield <= 0) h.armor = 1;
    }

    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) combo = 1;
    }

    for (let s in h.cooldowns) h.cooldowns[s] = Math.max(0, h.cooldowns[s] - dt);
    energy = Math.min(100, energy + CFG.eReg * dt);

    if (h.dodge > 0) h.dodge -= dt;

    h.vx += ((h.targetX - h.x) * 10 - h.vx) * dt * 8;
    h.x += h.vx * dt;
    h.tilt = h.vx * 0.0015;
    h.dCount += (h.count - h.dCount) * dt * 7;

    let rad = 35 + Math.sqrt(h.count) * 2.5;
    h.units.forEach((u, idx) => {
      u.b += dt * 15;

      let d = Math.sqrt(u.rx * u.rx + u.ry * u.ry);
      if (d > rad || Math.random() > 0.97) {
        let a = Math.random() * Math.PI * 2,
          r = Math.random() * rad;
        u.tx = Math.cos(a) * r;
        u.ty = Math.sin(a) * r;
      }
      u.rx += (u.tx - u.rx) * 7 * dt;
      u.ry += (u.ty - u.ry) * 7 * dt;

      if (u.type === 'elite' && Math.random() > 0.95) {
        ParticleSystem.spawnTrail(h.x + u.rx, h.y + u.ry, PALETTE.gold);
      }
    });

    projectiles = projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (Math.random() > 0.7) ParticleSystem.spawnTrail(p.x, p.y, PALETTE.gold);

      if (p.y < -100 || p.y > canvas.height + 100) return false;

      for (let e of entities) {
        if (e.dead) continue;
        let ey = e.y + dist;
        let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - ey) ** 2);

        if (d < 50) {
          if (e.type === 'cart') {
            shotsSimultaneous = Math.min(5, shotsSimultaneous + 1);
            h.shootSpeed += 0.2;
            floating(e.x, ey, '🚀 TIROS +1', 'positive');
            ParticleSystem.spawnMagic(e.x, ey, PALETTE.gold);
            e.dead = true;

          } else if (e.type === 'trojan') {
            if (h.count < CFG.maxWarriors) {
              updateHorde(h.count + 1);
              floating(e.x, ey, '⚔️ +1 GUERREIRO', 'positive');
            } else {
              energy = 100;
              floating(e.x, ey, '⚡ ENERGIA FULL', 'special');
            }
            ParticleSystem.spawnMagic(e.x, ey, PALETTE.gold);
            e.dead = true;

          } else if (e.type === 'enemy') {
            if (e.u.length > 0) {
              e.u.pop();
              ParticleSystem.spawnBlood(p.x, p.y, 8);

              if (e.u.length === 0) {
                e.dead = true;
                ParticleSystem.spawnMagic(p.x, p.y, PALETTE.blood);
                ParticleSystem.spawnFire(p.x, p.y, 5);
              }
              h.kills++;
              totalKills++;
              updateCombo(1);
            }

          } else if (e.type === 'boss') {
            e.v -= 10 * h.firePower;
            ParticleSystem.spawnBlood(p.x, p.y, 5);
            if (e.v <= 0) win();
          }

          if (e.dead || e.type === 'boss' || e.type === 'enemy') {
            ParticleSystem.spawn(p.x, p.y, PALETTE.gold, 8, 'sparkle');
            return false;
          }
        }
      }
      return true;
    });

    entities = entities.filter(e => !e.dead);

    entities.forEach(e => {
      let Y = e.y + dist;

      if (e.type === 'cart') {
        e.y += 50 * dt;

      } else if (e.type === 'trojan') {
        e.swing += dt * 3;
        e.x = cx() + Math.sin(e.swing) * Math.min(120, canvas.width * 0.26);

      } else if (e.type === 'modifier') {
        if (e.passed) return;

        const triggerY = h.y - 24;
        const rowCrossed = Y >= triggerY;

        if (rowCrossed) {
          const chosenSide = h.x <= cx() ? 'left' : 'right';
          resolveGateRow(e.rowId, chosenSide, Y);
          shake = 6;
        } else if (Y > h.y + 150) {
          resolveGateRow(e.rowId, h.x <= cx() ? 'left' : 'right', Y);
        }

      } else if (e.type === 'wall' || e.type === 'saw' || e.type === 'blocker') {
        const dx = Math.abs(h.x - e.x);
        const dy = Math.abs(h.y - Y);
        const hitW = e.type === 'wall' ? e.w / 2 + 26 : e.w / 2;
        const hitH = e.type === 'wall' ? e.h / 2 + 20 : e.h / 2 + 12;

        if (dx < hitW && dy < hitH && !e.passed) {
          e.passed = true;
          if (h.dodge <= 0 && sShield <= 0) {
            updateHorde(h.count - e.damage);
            floating(e.x, Y - 20, `-${e.damage} GUERREIROS`, 'negative');
            ParticleSystem.spawnBlood(e.x, Y, 15);
            ParticleSystem.spawn(e.x, Y, PALETTE.blood, 22, 'explosion');
            shake = 14;
            playSoundEffect('hit');
          } else {
            floating(e.x, Y - 20, 'BLOQUEADO', 'special');
            ParticleSystem.spawn(e.x, Y, PALETTE.ice, 10, 'sparkle');
          }
          e.dead = true;
          if (h.count <= 0) fail();
        } else if (Y > h.y + 160) {
          e.dead = true;
        }

      } else if (e.type === 'enemy') {
        let d = Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2);
        if (d < 60) {
          if (h.dodge <= 0 && sShield <= 0) {
            updateHorde(h.count - 1);
            ParticleSystem.spawnBlood(h.x, h.y, 5);
            shake = 10;
          }
          if (Math.random() > 0.9) e.u.pop();
          if (h.count <= 0) fail();
        }

      } else if (e.type === 'boss') {
        if (h.y < Y + 170 && h.y > Y - 90) {
          e.v -= 50 * dt;
          if (h.dodge <= 0 && sShield <= 0) {
            updateHorde(h.count - 5 * dt);
            ParticleSystem.spawnBlood(h.x, h.y, 3);
          }
          if (h.count <= 0) fail();
        }
      }
    });

    updateUI();
    if (shake > 0) shake -= dt * 50;
  }

  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();

  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  drawRoadBackground();

  decors.forEach(d => {
    let dy = d.y + dist;
    if (dy > -150 && dy < ch + 150) {
      drawHouse(d.x, dy, d.side);
    }
  });

  entities.forEach(e => e.draw(dist));

  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Projétil com efeito de fogo
    ctx.shadowBlur = 20;
    ctx.shadowColor = PALETTE.gold;
    
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });

  if (state === 'PLAYING') {
    ctx.save();
    ctx.translate(h.x, h.y);

    if (sShield > 0) {
      ctx.strokeStyle = PALETTE.ice;
      ctx.lineWidth = 8;
      ctx.shadowBlur = 30;
      ctx.shadowColor = PALETTE.ice;
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.stroke();
    }

    h.units.forEach((u, i) => {
      let x = u.rx + Math.sin(time * 5 + i) * 2;
      let y = u.ry + Math.cos(time * 4 + i) * 2;

      drawCharacter(ctx, x, y + Math.sin(u.b) * 4, 'player', u.type || 'normal');
    });

    ctx.restore();

    ctx.shadowBlur = 30;
    ctx.shadowColor = PALETTE.gold;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 36px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ ' + Math.floor(h.dCount), h.x, h.y - 90);

    if (combo > 1) {
      ctx.fillStyle = combo > 10 ? PALETTE.blood : PALETTE.gold;
      ctx.font = 'bold 28px Cinzel';
      ctx.fillText('x' + combo.toFixed(1), h.x + 80, h.y - 120);
    }
  }

  particles.forEach((p, i) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.gravity) p.vy += p.gravity * dt;

    p.l -= dt * (p.type === 'trail' ? 3 : 1.5);

    if (p.l <= 0) {
      particles.splice(i, 1);
    } else {
      ctx.globalAlpha = p.l;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;

      if (p.type === 'sparkle' || p.type === 'magic' || p.type === 'fire') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation + p.rotSpeed * dt);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  floatingTexts.forEach((f, i) => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt * 1.5;

    ctx.globalAlpha = f.life;
    ctx.shadowBlur = 20;

    if (f.type === 'positive') {
      ctx.fillStyle = '#00ff00';
      ctx.shadowColor = '#00ff00';
    } else if (f.type === 'negative') {
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000';
    } else if (f.type === 'critical' || f.type === 'special') {
      ctx.fillStyle = PALETTE.gold;
      ctx.shadowColor = PALETTE.gold;
      ctx.font = 'bold 28px Cinzel';
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
    }

    ctx.font = 'bold 24px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);

    if (f.life <= 0) floatingTexts.splice(i, 1);
  });

  atmosphere.update(dt);

  if (state === 'MENU') {
    if (Math.random() > 0.95) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 30,
        vy: -Math.random() * 80 - 40,
        l: 2,
        color: `rgba(255, ${Math.random() * 100 + 100}, 0, ${Math.random() * 0.5})`,
        s: Math.random() * 4 + 2,
        type: 'menu_particle'
      });
    }
  }

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// ============================================
// EVENT LISTENERS DOS BOTÕES
// ============================================

el('start-btn').addEventListener('click', () => {
  screens.menu.classList.remove('active');
  totalKills = 0;
  loadLevel(1);
});

el('restart-btn').addEventListener('click', () => {
  screens.over.classList.remove('active');
  totalKills = 0;
  loadLevel(level);
});

el('next-level-btn').addEventListener('click', () => {
  screens.victory.classList.remove('active');
  loadLevel(level + 1);
});

// ============================================
// FUNÇÃO PARA DESENHAR CASAS
// ============================================

function drawHouse(x, y, side) {
  const s = Math.max(0.78, getSceneScale() * 0.9);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Casa em ruínas
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(-20, -40, 40, 40);

  // Telhado
  ctx.fillStyle = '#5a3a2a';
  ctx.beginPath();
  ctx.moveTo(-25, -40);
  ctx.lineTo(0, -65);
  ctx.lineTo(25, -40);
  ctx.closePath();
  ctx.fill();

  // Porta
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-8, -20, 16, 20);

  // Janela com luz
  ctx.fillStyle = '#ffaa00';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(side === 'left' ? -15 : 5, -35, 10, 10);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ============================================
// INICIALIZAÇÃO
// ============================================

resize();

// Efeito inicial
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    ParticleSystem.spawnMagic(cx(), canvas.height / 2, PALETTE.gold);
  }, i * 200);
}

requestAnimationFrame(gameLoop);
