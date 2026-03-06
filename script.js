

// script.js - Versão Aprimorada (com correções de margem inferior + render responsivo + estrada com road.png)
const canvas = document.getElementById('game-canvas'),
  ctx = canvas.getContext('2d'),
  ui = document.getElementById('ui-layer');
const el = id => document.getElementById(id);

// Declarar variáveis globais necessárias
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
  arrows: el('arrow-count'),
  kills: el('final-kills'),
  finalLevel: el('final-level'),
  reward: el('level-coins')
};

// Helpers de layout
const cx = () => canvas.width / 2;

// ✅ CONTROLE DA DISTÂNCIA DAS TROPAS DO RODAPÉ
const BOTTOM_PADDING = 140; // ↑ aumente para ficar mais longe (ex: 160, 200)

function positionHorde() {
  // mantém um mínimo para não subir demais em telas pequenas
  h.y = Math.max(160, canvas.height - BOTTOM_PADDING);
}

// Resize responsivo
function resize() {
  canvas.width = Math.min(window.innerWidth, 500);
  canvas.height = Math.min(window.innerHeight, 900);

  // Recentraliza X (evita ficar “torto” em telas menores)
  h.x = cx();
  h.targetX = cx();

  positionHorde();
}
window.addEventListener('resize', resize);

// CONFIGURAÇÕES EXPANDIDAS
// CONFIGURAÇÕES EXPANDIDAS - Versão Operação Cavalo de Troia
const CFG = {
  speed: 80, // Reduzido para 80 para ser mais devagar (aprox. 2 unidades/seg)
  bulletSpeedMult: 3,
  maxWarriors: 20,
  spawnRate: 3,
  weapons: {
    spear: { r: 80, fr: 0.2, dmg: 5, area: 0, color: '#ffd966', name: 'LANÇA' },
    bow: { r: 350, fr: 0.5, dmg: 4, area: 0, color: '#6fff6f', name: 'ARCO' },
    cannon: { r: 250, fr: 1.2, dmg: 15, area: 60, color: '#ff6f6f', name: 'CANHÃO' }
  },
  skills: {
    arrow: { cost: 5, cd: 3, name: 'SETAS', icon: '🏹', color: '#6fff6f' },
    shield: { cost: 15, cd: 12, name: 'ESCUDO', icon: '🛡️', color: '#6f9fff' },
    fire: { cost: 20, cd: 15, name: 'FOGO', icon: '🔥', color: '#ff6f6f' },
    heal: { cost: 10, cd: 8, name: 'CURA', icon: '💊', color: '#6fff9f' }
  },
  combos: {
    5: { mult: 1.5, name: 'DOBRO' },
    10: { mult: 2.0, name: 'TRIPLO' },
    20: { mult: 3.0, name: 'SUPREMO' }
  }
};

// ESTADO EXPANDIDO
let state = 'MENU',
  lastTime = 0,
  level = 1,
  coins = 0,
  energy = 100,
  arrows = 15,
  totalKills = 0,
  dist = 0,
  gSpeed = CFG.speed,
  shake = 0,
  time = 0,
  combo = 1,
  comboT = 0,
  sShield = 0,
  entities = [],
  particles = [],
  projectiles = [],
  decors = [],
  floatingTexts = [],
  achievements = [],
  bulletPool = [];

let lastTap = 0;
let shotsSimultaneous = 1;

let h = {
  x: 250,
  y: 750,
  count: 1, // Começa com 1 conforme design doc
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

// aplica resize já com h existente
resize();

// =========================
// BACKGROUND (road.png) - NOVO
// =========================
const roadImg = new Image();
roadImg.src = 'road.png'; // mesma pasta do script.js

let roadReady = false;
roadImg.onload = () => (roadReady = true);
roadImg.onerror = () => console.warn('Não carregou road.png (verifique nome/pasta).');

// Velocidade visual do fundo (acompanha a “caminhada”)
const BG_SPEED_FACTOR = 1; // 0.7 mais suave, 1 normal, 1.2 mais rápido

function drawRoadBackground() {
  const cw = canvas.width;
  const ch = canvas.height;

  // fallback se ainda não carregou
  if (!roadReady) {
    ctx.fillStyle = '#3d2a1a';
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  // loop vertical baseado em dist
  const offset = (dist * BG_SPEED_FACTOR) % ch;

  // desenha 2 “telas” pra emendar
  ctx.drawImage(roadImg, 0, -offset, cw, ch);
  ctx.drawImage(roadImg, 0, ch - offset, cw, ch);
}

// SISTEMA DE ÁUDIO EXPANDIDO
let audioCtx;
const sounds = {
  attack: [400, 600, 800],
  hit: [200, 300],
  kill: [800, 1200],
  collect: [900, 1000, 1100],
  skill: [500, 700, 900],
  levelUp: [300, 500, 800, 1200],
  boss: [100, 200, 300],
  victory: [400, 600, 800, 1000, 1200]
};

const playSnd = (freq, type = 'sine', dur = 0.1, vol = 0.05, detune = 0) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
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

// SISTEMA DE PARTÍCULAS AVANÇADO
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
        x,
        y,
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
      x,
      y,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
      l: 0.3,
      color,
      s: Math.random() * 3 + 2,
      type: 'trail',
      rotation: 0,
      rotSpeed: 0
    });
  }
};

// SISTEMA DE FLOATING TEXT
const FloatingText = {
  add(x, y, text, type = 'positive') {
    floatingTexts.push({
      x,
      y,
      text,
      type,
      life: 1,
      vy: -60,
      vx: (Math.random() - 0.5) * 20
    });
  }
};

// SISTEMA DE COMBOS
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

const spawnP = (x, y, color, n, type) => ParticleSystem.spawn(x, y, color, n, type);
const floating = (x, y, str, cls) => FloatingText.add(x, y, str, cls);

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

// INPUT MELHORADO COM DOUBLE TAP
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
        ParticleSystem.spawnTrail(h.x, h.y, '#ffd966');
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

// SKILLS EXPANDIDAS
const useSkill = (id, cost, cd, fn) => {
  if (energy < cost || h.cooldowns[id] > 0) return false;
  energy -= cost;
  h.cooldowns[id] = cd;
  fn();
  updateUI();
  playSoundEffect('skill', Math.floor(Math.random() * 3));

  ParticleSystem.spawn(h.x, h.y, CFG.skills[id].color, 15, 'explosion');
  FloatingText.add(h.x, h.y, CFG.skills[id].icon, 'special');

  return true;
};

el('skill-arrow').addEventListener('click', () =>
  useSkill('arrow', 5, 3, () => {
    arrows += 15;
    floating(h.x, h.y, '+15 🏹', 'positive');
  })
);

el('skill-shield').addEventListener('click', () =>
  useSkill('shield', 15, 12, () => {
    sShield = 6;
    h.armor = 2;
    let b = document.createElement('div');
    b.className = 'effect-badge';
    b.id = 'sb';
    b.innerHTML = '🛡️ ESCUDO + ARMADURA';
    el('active-effects').appendChild(b);
  })
);

el('skill-fire').addEventListener('click', () =>
  useSkill('fire', 20, 15, () => {
    let k = 0;
    entities.forEach(e => {
      if (e.type === 'enemy' && e.y + dist > 0 && e.y + dist < canvas.height) {
        let n = Math.min(e.u.length, 30);
        for (let i = 0; i < n; i++) e.u.pop();
        k += n;
        e.f = 0.5;
        e.burning = 3;
      }
    });
    totalKills += k;
    h.kills += k;
    updateCombo(k);
    floating(cx(), canvas.height * 0.5, `🔥 ${k} ABATIDOS`, 'positive');
    shake = 20;
  })
);

el('skill-heal').addEventListener('click', () =>
  useSkill('heal', 10, 8, () => {
    let n = Math.floor(h.count * 0.4) + 8;
    updateHorde(h.count + n);
    floating(h.x, h.y, `+${n} 💊`, 'positive');
    spawnP(h.x, h.y, '#6fff9f', 25, 'heal');
  })
);

// SELEÇÃO DE ARMAS COM FEEDBACK
document.querySelectorAll('.weapon').forEach(w =>
  w.addEventListener('click', () => {
    h.weapon = w.dataset.weapon;
    document.querySelectorAll('.weapon').forEach(x => x.classList.remove('active'));
    w.classList.add('active');
    playSoundEffect('attack', 2);
    ParticleSystem.spawn(h.x, h.y, CFG.weapons[h.weapon].color, 8, 'sparkle');
  })
);

// DESENHO AVANÇADO
const drawMan = (x, y, headCol, bodyCol, plumeCol, size = 1, type = 'normal') => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);

  ctx.fillStyle = bodyCol;
  ctx.fillRect(-4, 0, 8, 10);

  ctx.shadowBlur = type === 'elite' ? 15 : 0;
  ctx.shadowColor = '#ffd966';
  ctx.fillStyle = headCol;
  ctx.beginPath();
  ctx.arc(0, -4, 5, 0, 7);
  ctx.fill();

  if (plumeCol) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = plumeCol;
    ctx.fillRect(-2, -9, 4, 5);

    if (type === 'elite') {
      ctx.fillStyle = '#ffd966';
      ctx.fillRect(-1, -11, 2, 3);
    }
  }

  ctx.fillStyle = '#aaa';
  ctx.fillRect(5, -2, 4, 2);

  ctx.restore();
};

const drawHouse = (x, y, side) => {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-20, -40, 40, 40);

  ctx.fillStyle = '#c91a1a';
  ctx.beginPath();
  ctx.moveTo(-25, -40);
  ctx.lineTo(0, -70);
  ctx.lineTo(25, -40);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ffd966';
  ctx.fillStyle = '#ffd966';
  ctx.fillRect(side === 'left' ? -12 : 8, -30, 8, 8);

  ctx.restore();
};

// ENTIDADES EXPANDIDAS
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
  }

  draw(dy) {
    let Y = this.y + dy;
    if (Y < -200 || Y > canvas.height + 200) return;

    ctx.save();
    ctx.translate(this.x, Y);

    if (this.burning > 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff4444';
    }

    if (this.type === 'gate') {
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-70, -40, 140, 100);

      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-45, -20, 25, 70);
      ctx.fillRect(20, -20, 25, 70);

      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffd966';
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 24px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('🚪', 0, -50);
      ctx.font = 'bold 20px Outfit';
      ctx.fillText(`${this.v[0]}${this.v[1]}${this.v[2]}${this.v[3]}`, 0, 20);
    } else if (this.type === 'enemy') {
      if (this.f > 0) ctx.filter = 'brightness(200%)';
      if (this.burning > 0) ctx.filter = 'brightness(150%) hue-rotate(-30deg)';

      this.u.forEach((u, i) => {
        let isLeader = i === 0;
        let xOffset = u.x + Math.sin(time * 3 + i) * 2;
        let yOffset = u.y + Math.cos(time * 2 + i) * 2;

        drawMan(
          xOffset,
          yOffset,
          isLeader ? '#c91a1a' : '#8b4513',
          isLeader ? '#5d3a1a' : '#3d2a1a',
          isLeader ? '#ffd966' : null,
          u.l ? 1.2 : 1,
          u.type || 'normal'
        );
      });
    } else if (this.type === 'cart') { // Carroça
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-25, -20, 50, 30);
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-32, 5, 12, 12);
      ctx.fillRect(20, 5, 12, 12);
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('🛒', 0, 0);
    } else if (this.type === 'trojan') { // Cavalo de Troia
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 24px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('🐴', 0, 8);
    } else if (this.type === 'boss') {
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-120, -100, 240, 240);

      ctx.fillStyle = '#c91a1a';
      ctx.fillRect(-70, -50, 140, 180);

      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(-30, -80, 15, 0, 7);
      ctx.arc(30, -80, 15, 0, 7);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(-35, -85, 5, 0, 7);
      ctx.arc(25, -85, 5, 0, 7);
      ctx.fill();

      ctx.fillStyle = '#ffd966';
      ctx.fillRect(-100, -120, 200 * (this.v / (300 + level * 200)), 20);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-100, -120, 200, 20);

      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('CHEFÃO', 0, -150);
    } else if (this.type === 'coin') {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffd966';
      ctx.fillStyle = '#ffd966';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Outfit';
      ctx.fillText('💰', -10, 5);
    } else if (this.type === 'barrel') {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-20, -25, 40, 40);

      if (!this.dead) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 24px Outfit';
        ctx.fillText('💣', -10, 0);
      }
    } else if (this.type === 'powerup') {
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.v.color;
      ctx.fillStyle = this.v.color;
      ctx.font = 'bold 30px Outfit';
      ctx.fillText(this.v.icon, -15, 0);
    }

    ctx.restore();
  }
}

// CARREGAMENTO DE FASE EXPANDIDO
function loadLevel(l) {
  level = l;
  state = 'PLAYING';
  entities = [];
  decors = [];
  projectiles = [];
  dist = 0;
  gSpeed = CFG.speed;
  shotsSimultaneous = 1;

  h.firePower = 1;
  h.shootSpeed = 1;
  updateHorde(1); // Começa com 1 conforme design

  // Gerar percurso
  const levelLength = 5000 + l * 2000;

  // Crossover de entidades
  for (let i = 0; i < levelLength / 300; i++) {
    let y = -400 - i * 400;
    let type = Math.random();

    if (type < 0.3) {
      // Carroça
      entities.push(new Entity('cart', Math.random() * (canvas.width - 100) + 50, y));
    } else if (type < 0.6) {
      // Cavalo de Troia
      let e = new Entity('trojan', cx(), y);
      e.swing = Math.random() * Math.PI; // Para o zigzag
      entities.push(e);
    } else {
      // Legião Inimiga
      let e = new Entity('enemy', Math.random() * (canvas.width - 150) + 75, y);
      let count = 3 + l + Math.floor(Math.random() * 5);
      for (let j = 0; j < count; j++) {
        e.u.push({
          x: (Math.random() - 0.5) * 80,
          y: (Math.random() - 0.5) * 40,
          l: j === 0
        });
      }
      entities.push(e);
    }
  }

  // Boss no final
  bossLevelY = -levelLength;
  entities.push(new Entity('boss', cx(), bossLevelY, 100 + l * 200));

  // Decoração lateral
  for (let i = 0; i < levelLength / 280; i++) {
    decors.push({ x: 40, y: -i * 280, type: 'house', side: 'left' });
    decors.push({ x: canvas.width - 40, y: -i * 280, type: 'house', side: 'right' });
  }

  playSoundEffect('levelUp', 3);
  FloatingText.add(cx(), canvas.height * 0.45, `OPERAÇÃO CAVALO DE TROIA - NÍVEL ${l}`, 'special');
}

// GAMELOOP OTIMIZADO E EXPANDIDO
function gameLoop(t) {
  let dt = (t - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTime = t;

  if (state === 'PLAYING') {
    time += dt;
    dist += gSpeed * h.speedBoost * (h.dodge > 0 ? 2.0 : 1) * dt;
    energy = Math.min(100, energy + CFG.eReg * dt * h.luck);

    if (sShield > 0) {
      sShield -= dt;
      if (sShield <= 0) {
        el('sb')?.remove();
        h.armor = 1;
      }
    }

    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) {
        combo = 1;
        h.critChance = 0.05 + level * 0.01;
      }
    }

    for (let s in h.cooldowns) h.cooldowns[s] = Math.max(0, h.cooldowns[s] - dt);
    for (let w in h.wTimers) h.wTimers[w] = Math.max(0, h.wTimers[w] - dt);

    if (h.dodge > 0) h.dodge -= dt;
    h.vx += ((h.targetX - h.x) * 10 - h.vx) * dt * 8; // Suavizado o movimento lateral
    h.x += h.vx * dt;
    h.tilt = h.vx * 0.0015; // Ajustado tilt para novo multiplicador de velocidade
    h.dCount += (h.count - h.dCount) * dt * 7;

    let rad = 35 + Math.sqrt(h.count) * 2.5;
    h.units.forEach((u, idx) => {
      u.b += dt * 15;
      u.s = Math.min(1, u.s + dt * 5);

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
        ParticleSystem.spawnTrail(h.x + u.rx, h.y + u.ry, '#ffd966');
      }
    });

    // PROJÉTEIS (Object Pool Logic Simplified)
    projectiles = projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Trail
      if (Math.random() > 0.7) ParticleSystem.spawnTrail(p.x, p.y, '#ffd966');

      // Check collision with screen boundaries
      if (p.y < -100 || p.y > canvas.height + 100) return false;

      // Colisão com Entidades
      for (let e of entities) {
        if (e.dead) continue;
        let ey = e.y + dist;
        let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - ey) ** 2);

        if (d < 50) {
          if (e.type === 'cart') {
            shotsSimultaneous = Math.min(5, shotsSimultaneous + 1);
            h.shootSpeed += 0.2;
            floating(e.x, ey, '🚀 TIROS +1', 'positive');
            e.dead = true;
          } else if (e.type === 'trojan') {
            if (h.count < CFG.maxWarriors) {
              updateHorde(h.count + 1);
              floating(e.x, ey, '⚔️ +1 GUERREIRO', 'positive');
            } else {
              energy = Math.min(100, energy + 20);
              floating(e.x, ey, '⚡ ENERGIA FULL', 'special');
            }
            e.dead = true;
          } else if (e.type === 'enemy') {
            if (e.u.length > 0) {
              e.u.pop();
              if (e.u.length === 0) e.dead = true;
              h.kills++;
              totalKills++;
              updateCombo(1);
            }
          } else if (e.type === 'boss') {
            e.v -= 10 * h.firePower;
            if (e.v <= 0) win();
          }

          if (e.dead || e.type === 'boss' || e.type === 'enemy') {
            ParticleSystem.spawn(p.x, p.y, '#ffd966', 8, 'sparkle');
            return false;
          }
        }
      }
      return true;
    });

    entities = entities.filter(e => !e.dead);

    // ATUALIZAÇÃO DAS ENTIDADES
    entities.forEach(e => {
      let Y = e.y + dist;

      if (e.type === 'cart') {
        e.y += 50 * dt; // Carroça desce mais devagar (50px/s em vez de 100)
      } else if (e.type === 'trojan') {
        e.swing += dt * 3;
        e.x = cx() + Math.sin(e.swing) * 150; // Zigzag
      } else if (e.type === 'enemy') {
        // Colisão direta com a horda
        let d = Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2);
        if (d < 100 && e.u.length > 0) {
          if (h.dodge <= 0 && sShield <= 0) {
            updateHorde(h.count - 10 * dt);
          }
          if (Math.random() > 0.9) e.u.pop();
          if (h.count <= 0) fail();
        }
      } else if (e.type === 'boss') {
        if (h.y < Y + 220 && h.y > Y - 50) {
          e.v -= 50 * dt;
          if (h.dodge <= 0 && sShield <= 0) updateHorde(h.count - 5 * dt);
          if (e.v <= 0) win();
          if (h.count <= 0) fail();
        }
      }
    });

    // ARMAS AUTOMÁTICAS DESATIVADAS - Foco em Tiro Manual (Double Tap)
    updateUI();
    if (shake > 0) shake -= dt * 50;
  }

  // =========================
  // RENDERIZAÇÃO PRINCIPAL (RESPONSIVA)
  // =========================
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // ✅ Fundo/estrada com a imagem road.png (loop infinito)
  drawRoadBackground();

  // Decorações
  decors.forEach(d => {
    let dy = d.y + dist;
    if (dy > -150 && dy < ch + 150) {
      if (d.type === 'house') drawHouse(d.x, dy, d.side);
      else {
        d.s += 0.05;
        ctx.fillStyle = d.type === 'lantern' ? '#ffaa00' : '#2d5a2d';
        ctx.shadowBlur = d.type === 'lantern' ? 20 : 0;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.arc(d.x + Math.sin(d.s) * 5, dy, 12, 0, 7);
        ctx.fill();
      }
    }
  });

  // Entidades
  entities.forEach(e => e.draw(dist));

  // Projéteis (Balas Manuais)
  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = '#ffd966';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffaa00';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Rastro de luz
    ctx.fillStyle = 'rgba(255, 217, 102, 0.3)';
    ctx.fillRect(-3, 0, 6, 20);

    ctx.restore();
  });

  // HORDA DO JOGADOR
  if (state === 'PLAYING') {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.tilt);

    if (sShield > 0) {
      ctx.strokeStyle = '#6f9fff';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#6f9fff';
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, 7);
      ctx.stroke();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 65, 0, 7);
      ctx.stroke();
    }

    h.units.forEach((u, i) => {
      let x = u.rx + Math.sin(time * 5 + i) * 2;
      let y = u.ry + Math.cos(time * 4 + i) * 2;

      drawMan(
        x,
        y + Math.sin(u.b) * 4,
        i === 0 ? '#ff6f6f' : '#c91a1a',
        '#5d3a1a',
        i === 0 ? '#ffd966' : u.type === 'elite' ? '#6fff9f' : null,
        1,
        u.type || 'normal'
      );
    });

    ctx.restore();

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffd966';
    ctx.fillStyle = '#ffd966';
    ctx.font = 'bold 30px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ ' + Math.floor(h.dCount), h.x, h.y - 70);

    if (combo > 1) {
      ctx.fillStyle = combo > 10 ? '#ff6f6f' : '#ffd966';
      ctx.font = 'bold 24px Outfit';
      ctx.fillText('x' + combo.toFixed(1), h.x + 60, h.y - 90);
    }

    if (h.firePower > 1) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 18px Outfit';
      ctx.fillText('🔥 ' + h.firePower.toFixed(1) + 'x', h.x - 60, h.y - 90);
    }
  }

  // PARTÍCULAS
  particles.forEach((p, i) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.type === 'explosion') p.vy += 200 * dt;

    p.l -= dt * (p.type === 'trail' ? 3 : 1.5);

    if (p.l <= 0) particles.splice(i, 1);
    else {
      ctx.globalAlpha = p.l;
      ctx.fillStyle = p.color;

      if (p.type === 'sparkle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation + p.rotSpeed * dt);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, 7);
        ctx.fill();
      }
    }
  });

  // FLOATING TEXTS
  floatingTexts.forEach((f, i) => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt * 1.5;

    ctx.globalAlpha = f.life;
    ctx.shadowBlur = 10;

    if (f.type === 'positive') {
      ctx.fillStyle = '#6fff6f';
      ctx.shadowColor = '#00ff00';
    } else if (f.type === 'negative') {
      ctx.fillStyle = '#ff6f6f';
      ctx.shadowColor = '#ff0000';
    } else if (f.type === 'critical') {
      ctx.fillStyle = '#ffd966';
      ctx.shadowColor = '#ffaa00';
      ctx.font = 'bold 24px "Noto Serif SC"';
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
    }

    ctx.font = 'bold 20px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);

    if (f.life <= 0) floatingTexts.splice(i, 1);
  });

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// UI UPDATES
function updateUI() {
  txt.level.innerText = `⚔️ NÍVEL ${level}`;
  txt.coins.innerText = coins;
  txt.energy.innerText = Math.floor(energy);
  txt.arrows.innerText = arrows;

  let progress = Math.min(1, Math.abs(dist - gateY) / 1800);
  el('progress-bar').style.width = progress * 100 + '%';

  Object.keys(h.cooldowns).forEach(s => {
    let e = document.getElementById(`skill-${s}`);
    if (e) {
      if (h.cooldowns[s] > 0) {
        e.classList.add('cooldown');
        e.querySelector('.cooldown-overlay').innerText = Math.ceil(h.cooldowns[s]) + 's';
      } else {
        e.classList.remove('cooldown');
      }
    }
  });
}

// GAME OVER E VITÓRIA
function fail() {
  state = 'MENU';
  screens.over.classList.add('active');
  txt.kills.innerText = totalKills;
  txt.finalLevel.innerText = level;

  if (totalKills > localStorage.getItem('record')) {
    localStorage.setItem('record', totalKills);
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
}

// EVENT LISTENERS
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

// INICIALIZAÇÃO
requestAnimationFrame(gameLoop);

// DICAS DE JOGO - Operação Cavalo de Troia
const tips = [
  '💡 Toque DUAS VEZES para atirar em inimigos!',
  '💡 Acerte a CARROÇA para aumentar seus disparos simultâneos!',
  '💡 Use o CAVALO DE TROIA para ganhar mais aliados!',
  '💡 Cuidado com a LEGIÃO INIMIGA no topo da tela!',
  '💡 Você pode ter no máximo 20 guerreiros!',
  '💡 Aqueça os tambores para a batalha final contra o MONSTRO!',
  '💡 Tiros simultâneos ajudam a limpar o caminho mais rápido!'
];

setInterval(() => {
  if (state === 'PLAYING') {
    let tip = tips[Math.floor(Math.random() * tips.length)];
    floating(cx(), canvas.height * 0.25, tip, 'positive');
  }
}, 30000);














l

