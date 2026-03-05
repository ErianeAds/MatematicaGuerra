// script.js - Versão Aprimorada (com correções de margem inferior + render responsivo)
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
// =========================
// BACKGROUND (road.png)
// =========================
const roadImg = new Image();
roadImg.src = "./road.png.png"; // mesma pasta do script.js

let roadReady = false;
roadImg.onload = () => (roadReady = true);
roadImg.onerror = () => console.warn("Não carregou road.png (verifique nome/pasta).");

// Velocidade visual do fundo (pode ser igual ao dist)
const BG_SPEED_FACTOR = 1; // 1 = acompanha o jogo, 0.5 mais lento, 1.5 mais rápido

function drawRoadBackground() {
  const cw = canvas.width;
  const ch = canvas.height;

  // Se ainda não carregou, fallback simples
  if (!roadReady) {
    ctx.fillStyle = "#3d2a1a";
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  // Faz o looping vertical usando a própria altura da imagem
  const imgH = roadImg.naturalHeight || roadImg.height;
  const imgW = roadImg.naturalWidth || roadImg.width;

  // offset baseado na distância percorrida
  const offset = (dist * BG_SPEED_FACTOR) % ch;

  // Desenha duas vezes para “emendar”
  ctx.drawImage(roadImg, 0, -offset, cw, ch);
  ctx.drawImage(roadImg, 0, ch - offset, cw, ch);
}
// CONFIGURAÇÕES EXPANDIDAS
const CFG = {
  speed: 250,
  eSpeed: 35,
  eReg: 6,
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
  achievements = [];

let h = {
  x: 250,
  y: 750,
  count: 12,
  targetX: 250,
  dCount: 12,
  units: [],
  vx: 0,
  tilt: 0,
  dodge: 0,
  weapon: 'spear',
  wTimers: { spear: 0, bow: 0, cannon: 0 },
  cooldowns: { arrow: 0, shield: 0, fire: 0, heal: 0 },
  firePower: 1,
  critChance: 0.05,
  critMultiplier: 2,
  armor: 1,
  speedBoost: 1,
  luck: 1,
  kills: 0
};

// aplica resize já com h existente
resize();

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
  } catch (e) {}
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

// INPUT MELHORADO
const input = (x, isTap = false) => {
  if (state === 'PLAYING') {
    h.targetX = Math.max(40, Math.min(canvas.width - 40, x));
    if (isTap && Math.abs(x - h.x) > 100 && h.dodge <= 0) {
      h.dodge = 0.4;
      ParticleSystem.spawnTrail(h.x, h.y, '#ffd966');
    }
  }
};

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
  dist = 0;
  gSpeed = CFG.speed + l * 20;

  h.firePower = 1 + level * 0.1;
  h.critChance = 0.05 + level * 0.01;
  h.armor = 1;
  h.luck = 1 + level * 0.05;

  updateHorde(15 + l * 3);

  gateY = -1200;
  entities.push(new Entity('gate', cx(), gateY, ['+', 10 + l, '-', 2, '*', 2]));

  for (let i = 0; i < 3; i++) {
    entities.push(new Entity('barrel', canvas.width * 0.2 + Math.random() * (canvas.width * 0.6), gateY - 200 - i * 400, { dmg: 5 }));
  }

  entities.push(new Entity('powerup', canvas.width * 0.35, gateY - 500, { icon: '⚡', color: '#ffff6f', buff: 'speed' }));
  entities.push(new Entity('powerup', canvas.width * 0.65, gateY - 800, { icon: '💥', color: '#ff6f6f', buff: 'crit' }));

  for (let i = 0; i < 6 + l * 3; i++) {
    let e = new Entity('enemy', canvas.width * 0.3 + Math.random() * (canvas.width * 0.4), gateY - 200 - i * 280);
    let unitCount = 8 + l * 4;

    for (let j = 0; j < unitCount; j++) {
      e.u.push({
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 60,
        l: j === 0,
        type: Math.random() > 0.8 ? 'elite' : 'normal'
      });
    }
    entities.push(e);
  }

  bossLevelY = gateY - 1800;
  entities.push(new Entity('boss', cx(), gateY - 1800, 300 + l * 250));

  for (let i = 0; i < 8; i++) {
    entities.push(new Entity('coin', canvas.width * 0.1 + Math.random() * (canvas.width * 0.8), gateY - 400 - i * 250));
  }

  // decoração
  for (let i = 0; i < 25; i++) {
    decors.push({ x: 40, y: -i * 280, type: 'house', side: 'left' });
    decors.push({ x: canvas.width - 40, y: -i * 280, type: 'house', side: 'right' });
  }

  for (let i = 0; i < 40; i++) {
    decors.push({
      x: Math.random() > 0.5 ? 20 : canvas.width - 20,
      y: -i * 350,
      type: Math.random() > 0.5 ? 'lantern' : 'bamboo',
      s: Math.random() * 6
    });
  }

  playSoundEffect('levelUp', 3);
  FloatingText.add(cx(), canvas.height * 0.45, `NÍVEL ${l}`, 'special');
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
    h.vx += ((h.targetX - h.x) * 18 - h.vx) * dt * 12;
    h.x += h.vx * dt;
    h.tilt = h.vx * 0.0008;
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

    // PROJÉTEIS EXPANDIDOS
    projectiles = projectiles.filter(p => {
      p.p += (p.type === 'arrow' ? 15 : 7) * dt;
      let T = Math.min(1, p.p);

      if (p.type === 'arrow') {
        p.x = p.sx + (p.tx - p.sx) * T;
        p.y = p.sy + (p.ty - p.sy) * T - Math.sin(T * Math.PI) * 70;
      } else {
        p.x = p.sx + (p.tx - p.sx) * T;
        p.y = p.sy + (p.ty - p.sy) * T;
      }

      if (Math.random() > 0.7) {
        ParticleSystem.spawnTrail(p.x, p.y, p.type === 'arrow' ? '#ffd966' : '#ff4444');
      }

      if (p.p >= 1) {
        shake = p.type === 'cannon' ? 15 : 8;

        let dmg = p.dmg || (p.type === 'arrow' ? 4 : 15);

        if (Math.random() < h.critChance) {
          dmg *= h.critMultiplier;
          FloatingText.add(p.x, p.y, 'CRÍTICO!', 'critical');
        }

        if (p.type === 'cannon') {
          ParticleSystem.spawn(p.x, p.y, '#ff4444', 25, 'explosion');
          playSoundEffect('hit', 2);

          entities.forEach(e => {
            if (e.type === 'enemy') {
              let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - (e.y + dist)) ** 2);
              if (d < 130) {
                let kills = Math.min(e.u.length, Math.floor(dmg * h.firePower));
                for (let j = 0; j < kills; j++) e.u.pop();
                totalKills += kills;
                h.kills += kills;
                e.f = 0.3;
                updateCombo(kills);
              }
            }
            if (e.type === 'barrel') {
              let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - (e.y + dist)) ** 2);
              if (d < 120) {
                h.firePower += 0.6;
                floating(e.x, e.y + dist, '🔥 PODER +60%', 'positive');
                ParticleSystem.spawn(e.x, e.y + dist, '#ffaa00', 35, 'explosion');
                e.dead = true;
                playSoundEffect('skill', 2);
              }
            }
          });
        } else if (p.type === 'arrow' && p.target) {
          if (p.target.u.length > 0) {
            p.target.u.pop();
            totalKills++;
            h.kills++;
            updateCombo(1);
            ParticleSystem.spawn(p.x, p.y, '#ffd966', 8, 'sparkle');
            playSoundEffect('hit');
          }
        }
        return false;
      }
      return true;
    });

    entities = entities.filter(e => !e.dead);

    // ATUALIZAÇÃO DAS ENTIDADES
    entities.forEach(e => {
      let Y = e.y + dist;

      if (e.type === 'gate' && h.y > Y && h.y < Y + 100) {
        let onL = h.x < canvas.width / 2,
          op = onL ? e.v[0] : e.v[2],
          val = onL ? e.v[1] : e.v[3],
          n = h.count;

        if (op === '+') n += val;
        else if (op === '-') n -= val;
        else if (op === '*') n *= val;
        else n = Math.max(1, Math.floor(n / val));

        updateHorde(n);
        e.dead = true;
        ParticleSystem.spawn(e.x, Y, '#ffd966', 20, 'explosion');
        playSoundEffect(op === '+' ? 'collect' : 'hit');
      }

      if (e.type === 'enemy') {
        if (e.u.length === 0) {
          e.dead = true;
          totalKills += 5;
          h.kills += 5;
          coins += 2;
          ParticleSystem.spawn(e.x, Y, '#ff6f6f', 15, 'explosion');
          playSoundEffect('kill');
          return;
        }

        if (e.burning > 0) {
          e.burning -= dt;
          if (Math.random() > 0.9) {
            e.u.pop();
            ParticleSystem.spawn(
              e.x + (Math.random() - 0.5) * 50,
              Y + (Math.random() - 0.5) * 50,
              '#ff4444',
              3,
              'sparkle'
            );
          }
        }

        let d = Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2);

        if (d < 120) {
          let dmg = Math.ceil(180 * dt * (h.count / 50 + 1) * (combo / 15 + 1) * h.firePower / h.armor);

          for (let i = 0; i < dmg && e.u.length > 0; i++) {
            e.u.pop();
            if (h.dodge <= 0 && sShield <= 0) {
              updateHorde(h.count - 1);
            }
          }

          if (h.count <= 0) fail();

          if (Math.random() > 0.7) {
            ParticleSystem.spawn(e.x, Y, '#ffffff', 5, 'sparkle');
          }
        }

        projectiles.forEach(p => {
          if (p.type === 'arrow' && Math.sqrt((p.x - e.x) ** 2 + (p.y - Y) ** 2) < 70) {
            e.u.pop();
            totalKills++;
            h.kills++;
            updateCombo(1);
            p.p = 1;
            e.f = 0.3;
            ParticleSystem.spawn(p.x, p.y, '#ffd966', 5, 'sparkle');
          }
        });

        if (Math.abs(Y - h.y) < 600) {
          e.x += (h.x - e.x) * dt * 1.8;
        }
        e.y += CFG.eSpeed * dt * (1 + level * 0.1);

        if (e.f > 0) e.f -= dt;
        if (e.burning > 0) e.burning -= dt;
      }

      if (e.type === 'boss') {
        if (h.y < Y + 220 && h.y > Y - 50) {
          let d = 350 * dt * (combo / 20 + 1) * h.firePower;
          let isCrit = Math.random() < h.critChance;
          if (isCrit) d *= h.critMultiplier;

          e.v -= d;

          if (h.dodge <= 0 && sShield <= 0) {
            let damageToHorde = (d * 0.3) / h.armor;
            updateHorde(h.count - damageToHorde);
          }

          if (isCrit) {
            FloatingText.add(e.x, Y, 'CRÍTICO!', 'critical');
            ParticleSystem.spawn(e.x, Y, '#ff4444', 20, 'explosion');
          }

          if (e.v <= 0) {
            win();
            ParticleSystem.spawn(e.x, Y, '#ffd966', 50, 'explosion');
          }

          if (Math.random() > 0.98) {
            ParticleSystem.spawn(e.x, Y, '#ff0000', 15, 'explosion');
            if (Math.random() > 0.5) {
              updateHorde(h.count - 2);
            }
            playSoundEffect('boss');
          }
        }
      }

      if (e.type === 'powerup' && Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2) < 60) {
        if (e.v.buff === 'speed') {
          h.speedBoost += 0.3;
          FloatingText.add(h.x, h.y, '⚡ VELOCIDADE +30%', 'positive');
        } else if (e.v.buff === 'crit') {
          h.critChance += 0.1;
          FloatingText.add(h.x, h.y, '💥 CRÍTICO +10%', 'positive');
        }
        ParticleSystem.spawn(e.x, Y, e.v.color, 20, 'explosion');
        playSoundEffect('collect', 2);
        e.dead = true;
      }

      if (e.type === 'coin' && Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2) < 60) {
        coins += 2;
        energy = Math.min(100, energy + 8);
        ParticleSystem.spawn(e.x, Y, '#ffd966', 10, 'sparkle');
        playSoundEffect('collect');
        e.dead = true;
      }

      if (e.type === 'barrel' && Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2) < 60) {
        h.firePower += 0.4;
        h.critChance += 0.03;
        floating(h.x, h.y, '🔥 PODER +40%', 'positive');
        ParticleSystem.spawn(e.x, Y, '#ffaa00', 25, 'explosion');
        e.dead = true;
        playSoundEffect('skill');
      }
    });

    // ARMAS AUTOMÁTICAS
    let target = entities.find(
      e => e.type === 'enemy' && Math.abs(e.y + dist - h.y) < CFG.weapons[h.weapon].r && e.u.length > 0
    );
    if (target && h.wTimers[h.weapon] <= 0) {
      if (h.weapon === 'bow' && arrows > 0) {
        projectiles.push({
          sx: h.x,
          sy: h.y,
          x: h.x,
          y: h.y,
          tx: target.x,
          ty: target.y + dist,
          p: 0,
          type: 'arrow',
          dmg: 4 * h.firePower,
          target: target
        });
        arrows--;
        h.wTimers.bow = 0.4;
        playSoundEffect('attack');
      } else if (h.weapon === 'cannon') {
        projectiles.push({
          sx: h.x,
          sy: h.y,
          x: h.x,
          y: h.y,
          tx: target.x,
          ty: target.y + dist,
          p: 0,
          type: 'cannon',
          dmg: 15 * h.firePower
        });
        h.wTimers.cannon = 1.0;
        playSoundEffect('attack', 1);
      } else if (h.weapon === 'spear' && Math.abs(target.x - h.x) < 100) {
        let kills = Math.min(target.u.length, Math.floor(5 * h.firePower));
        for (let i = 0; i < kills; i++) target.u.pop();
        totalKills += kills;
        h.kills += kills;
        updateCombo(kills);
        ParticleSystem.spawn(target.x, target.y + dist, '#ffd966', 10, 'sparkle');
        h.wTimers.spear = 0.3;
        playSoundEffect('hit');
      }
    }

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

  // Fundo
  ctx.fillStyle = '#3d2a1a';
  ctx.fillRect(0, 0, cw, ch);

   
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

  // Projéteis
  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    let angle = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    ctx.rotate(angle);

    let isArrow = p.type === 'arrow';
    let gradient = ctx.createLinearGradient(-15, 0, 15, 0);

    if (isArrow) {
      gradient.addColorStop(0, '#fff6bf');
      gradient.addColorStop(0.5, '#ffd966');
      gradient.addColorStop(1, '#ffaa00');
    } else {
      gradient.addColorStop(0, '#ffbfbf');
      gradient.addColorStop(0.5, '#ff6f6f');
      gradient.addColorStop(1, '#ff0000');
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = isArrow ? 4 : 6;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = isArrow ? '#ffd966' : '#ff4444';

    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();

    if (isArrow) {
      ctx.fillStyle = '#ffd966';
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(10, -5);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();
    }

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

// DICAS DE JOGO
const tips = [
  '💡 Use o ESCUDO antes de enfrentar grupos grandes!',
  '💡 Combine CANHÃO com BARRIS para dano massivo!',
  '💡 Mantenha o COMBO para multiplicar seu poder!',
  '💡 Flechas são ótimas para inimigos distantes!',
  '💡 A LANÇA causa dano em área!',
  '💡 Power-ups roxos aumentam seu crítico!',
  '💡 Cada 10 de combo aumenta seu dano!'
];

setInterval(() => {
  if (state === 'PLAYING') {
    let tip = tips[Math.floor(Math.random() * tips.length)];
    floating(cx(), canvas.height * 0.25, tip, 'positive');
  }
}, 30000);