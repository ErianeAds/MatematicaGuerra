// ============================================
// LEGIÕES MÍTICAS: A IRA DE TROIA
// Script principal do jogo
// ============================================

// ============================================
// INICIALIZAÇÃO DOS ELEMENTOS DO DOM
// ============================================

// Canvas e contexto de desenho
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui-layer');

// Função auxiliar para pegar elementos por ID
const el = id => document.getElementById(id);

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

// Posições iniciais
let gateY = -1200;          // Posição Y do portão
let bossLevelY = -3000;     // Posição Y do chefe

// Telas do jogo
const screens = {
  menu: el('main-menu'),
  over: el('game-over-screen'),
  victory: el('victory-screen')
};

// Elementos de texto da UI
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
// CONFIGURAÇÕES DO JOGO
// ============================================

// Espaçamento inferior da horda (distância da base da tela)
const BOTTOM_PADDING = 140;

// Função para posicionar a horda na tela
function positionHorde() {
  // Mantém um mínimo para não subir demais em telas pequenas
  h.y = Math.max(160, canvas.height - BOTTOM_PADDING);
}

// ============================================
// CONFIGURAÇÕES EXPANDIDAS
// ============================================

const CFG = {
  speed: 80,                    // Velocidade base do jogo
  eSpeed: 35,                   // Velocidade dos inimigos
  eReg: 6,                      // Regeneração de energia por segundo
  bulletSpeedMult: 3,           // Multiplicador de velocidade dos projéteis
  maxWarriors: 20,              // Máximo de guerreiros
  spawnRate: 3,                 // Taxa de spawn
  modifierMin: 1,               // Valor mínimo dos obstáculos numéricos
  modifierMax: 8,               // Valor máximo dos obstáculos numéricos

  // Armas disponíveis
  weapons: {
    spear: { r: 80, fr: 0.2, dmg: 5, area: 0, color: '#ffd966', name: 'LANÇA' },
    bow: { r: 350, fr: 0.5, dmg: 4, area: 0, color: '#6fff6f', name: 'ARCO' },
    cannon: { r: 250, fr: 1.2, dmg: 15, area: 60, color: '#ff6f6f', name: 'CANHÃO' }
  },

  // Habilidades especiais
  skills: {
    arrow: { cost: 5, cd: 3, name: 'SETAS', icon: '🏹', color: '#6fff6f' },
    shield: { cost: 15, cd: 12, name: 'ESCUDO', icon: '🛡️', color: '#6f9fff' },
    fire: { cost: 20, cd: 15, name: 'FOGO', icon: '🔥', color: '#ff6f6f' },
    heal: { cost: 10, cd: 8, name: 'CURA', icon: '💊', color: '#6fff9f' }
  },

  // Combos e multiplicadores
  combos: {
    5: { mult: 1.5, name: 'DOBRO' },
    10: { mult: 2.0, name: 'TRIPLO' },
    20: { mult: 3.0, name: 'SUPREMO' }
  }
};

// ============================================
// ESTADO DO JOGO
// ============================================

let state = 'MENU';              // Estado atual: MENU, PLAYING
let lastTime = 0;                // Último timestamp para delta time
let level = 1;                   // Nível atual
let coins = 0;                   // Moedas do jogador
let energy = 100;                // Energia atual
let totalKills = 0;              // Total de mortes
let dist = 0;                    // Distância percorrida
let gSpeed = CFG.speed;          // Velocidade do jogo
let shake = 0;                   // Intensidade do tremor de tela
let time = 0;                    // Tempo global do jogo
let combo = 1;                   // Multiplicador de combo atual
let comboT = 0;                  // Tempo restante do combo
let sShield = 0;                 // Duração do escudo

// Arrays para entidades do jogo
let entities = [];               // Entidades (inimigos, itens, etc)
let particles = [];              // Partículas
let projectiles = [];            // Projéteis
let decors = [];                 // Decorações de cenário
let floatingTexts = [];          // Textos flutuantes
let achievements = [];           // Conquistas desbloqueadas

// Controle de toque duplo para disparo
let lastTap = 0;
let shotsSimultaneous = 1;       // Número de tiros simultâneos
let gateRowCounter = 0;          // Identificador dos pares de portões

// ============================================
// OBJETO DA HORDA (JOGADOR)
// ============================================

let h = {
  x: 250,                        // Posição X
  y: 750,                        // Posição Y
  count: 1,                      // Número de guerreiros
  targetX: 250,                  // Posição alvo X (para suavização)
  dCount: 1,                     // Contador suavizado para exibição
  units: [],                      // Unidades individuais na horda
  vx: 0,                         // Velocidade X
  tilt: 0,                       // Inclinação visual
  dodge: 0,                      // Tempo de esquiva
  weapon: 'spear',                // Arma equipada
  wTimers: { spear: 0, bow: 0, cannon: 0 },  // Timers das armas
  cooldowns: { arrow: 0, shield: 0, fire: 0, heal: 0 },  // Cooldowns das habilidades
  firePower: 1,                   // Poder de fogo
  shootSpeed: 1,                  // Velocidade de tiro
  critChance: 0.05,               // Chance de crítico
  critMultiplier: 2,               // Multiplicador de crítico
  armor: 1,                       // Armadura
  speedBoost: 1,                  // Boost de velocidade
  luck: 1,                         // Sorte
  kills: 0                          // Mortes nesta sessão
};

// ============================================
// SISTEMA DE PARTÍCULAS AVANÇADO
// ============================================

const ParticleSystem = {
  // Método para spawnar partículas básicas
  spawn(x, y, color, count, type = 'normal') {
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 200 + 100;
      let life = Math.random() * 0.8 + 0.4;
      let size = Math.random() * 8 + 3;

      // Configurações específicas por tipo
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
        l: life,                    // Vida restante
        color,
        s: size,                     // Tamanho
        type,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  },

  // Método para spawnar rastro
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

  // NOVO: Efeito de sangue para inimigos
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
        gravity: 500  // Efeito de gravidade
      });
    }
  },

  // NOVO: Efeito mágico
  spawnMagic(x, y, color = '#bc8f3f') {
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

  // NOVO: Poeira do chão
  spawnDust(x, y) {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + 10,
        vx: (Math.random() - 0.5) * 50,
        vy: -Math.random() * 50,
        l: 0.5,
        color: `rgba(139, 69, 19, ${Math.random() * 0.5})`,
        s: Math.random() * 10 + 5,
        type: 'dust'
      });
    }
  }
};

// ============================================
// SISTEMA DE TEXTO FLUTUANTE
// ============================================

const FloatingText = {
  // Adiciona um texto flutuante
  add(x, y, text, type = 'positive') {
    floatingTexts.push({
      x, y,
      text,
      type,
      life: 1,           // Vida (opacidade)
      vy: -60,           // Velocidade vertical
      vx: (Math.random() - 0.5) * 20  // Velocidade horizontal aleatória
    });
  }
};

// Atalhos para facilitar o uso
const spawnP = (x, y, color, n, type) => ParticleSystem.spawn(x, y, color, n, type);
const floating = (x, y, str, cls) => FloatingText.add(x, y, str, cls);

// ============================================
// SISTEMA DE ÁUDIO
// ============================================

let audioCtx;
const sounds = {
  attack: [400, 600, 800],      // Frequências para ataque
  hit: [200, 300],               // Para acertos
  kill: [800, 1200],             // Para mortes
  collect: [900, 1000, 1100],    // Para coleta
  skill: [500, 700, 900],        // Para habilidades
  levelUp: [300, 500, 800, 1200], // Para subir de nível
  boss: [100, 200, 300],         // Para chefe
  victory: [400, 600, 800, 1000, 1200] // Para vitória
};

// Função para tocar um som simples
const playSnd = (freq, type = 'sine', dur = 0.1, vol = 0.05, detune = 0) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const o = audioCtx.createOscillator();  // Oscilador
    const g = audioCtx.createGain();         // Controlador de volume

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

// Toca um efeito sonoro pelo nome
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

// Atualiza o combo baseado no número de mortes
const updateCombo = kills => {
  combo = Math.min(30, combo + kills);  // Máximo 30
  comboT = 3;  // Duração do combo em segundos

  // Verifica se atingiu thresholds para combos especiais
  for (let [threshold, data] of Object.entries(CFG.combos)) {
    if (combo >= threshold && !achievements.includes(`combo_${threshold}`)) {
      achievements.push(`combo_${threshold}`);
      FloatingText.add(cx(), canvas.height * 0.45, `${data.name} COMBO!`, 'special');
      playSoundEffect('levelUp', 2);

      // Bônus por atingir combos
      if (threshold == 5) h.critChance += 0.05;
      if (threshold == 10) h.firePower += 0.5;
      if (threshold == 20) h.speedBoost += 0.3;
    }
  }
};

// ============================================
// SISTEMA DE BACKGROUND (ESTRADA)
// ============================================

// Carrega a imagem da estrada
const roadImg = new Image();
roadImg.src = 'road.png';

let roadReady = false;
roadImg.onload = () => (roadReady = true);
roadImg.onerror = () => console.warn('Não carregou road.png (verifique nome/pasta).');

// Carrega a imagem do soldado
const soldierImg = new Image();
soldierImg.src = 'soldier.png';
let soldierReady = false;
soldierImg.onload = () => (soldierReady = true);
soldierImg.onerror = () => console.warn('Não carregou soldier.png.');

// Fator de velocidade do fundo
const BG_SPEED_FACTOR = 1;

// Função para desenhar o fundo com a estrada
function drawRoadBackground() {
  const cw = canvas.width;
  const ch = canvas.height;

  // Fallback se a imagem não carregou
  if (!roadReady) {
    ctx.fillStyle = '#3d2a1a';
    ctx.fillRect(0, 0, cw, ch);
    return;
  }

  // Loop vertical baseado na distância percorrida
  const offset = (dist * BG_SPEED_FACTOR) % ch;

  // Desenha duas telas para criar loop infinito
  ctx.drawImage(roadImg, 0, -offset, cw, ch);
  ctx.drawImage(roadImg, 0, ch - offset, cw, ch);
}

// ============================================
// SISTEMA DE DESENHO AVANÇADO DE PERSONAGENS
// ============================================

// Função para desenhar personagens com detalhes
function drawCharacter(ctx, x, y, type = 'player', variant = 'normal') {
  ctx.save();
  ctx.translate(x, y);

  // Sombra projetada
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;

  if (type === 'player') {
    if (soldierReady) {
      // Usa o sprite do soldado se estiver pronto
      const imgWidth = 40;
      const imgHeight = 60;
      if (variant === 'elite') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd966';
      }
      ctx.drawImage(soldierImg, -imgWidth / 2, -imgHeight + 10, imgWidth, imgHeight);
    } else {
      // Fallback: Legionário Romano procedural
      ctx.fillStyle = '#8b4513'; // Armadura de bronze
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Capacete
      ctx.fillStyle = '#c0c0c0'; // Capacete prateado
      ctx.beginPath();
      ctx.ellipse(0, -18, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crista (pluma vermelha)
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-8, -26, 16, 8);
    }

  } else if (type === 'enemy') {
    // Guerreiro Troiano
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Capacete (estilo Troiano)
    ctx.fillStyle = '#daa520';
    ctx.beginPath();
    ctx.ellipse(0, -18, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pluma
    ctx.fillStyle = variant === 'elite' ? '#ffd700' : '#ff6347';
    ctx.fillRect(-4, -26, 8, 10);

    // Espada
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(25, 5);
    ctx.stroke();

  } else if (type === 'trojan') {
    // Cavalo de Troia
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabeça
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(20, -8, 10, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Olho
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(25, -10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(26, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Rodas
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.arc(-15, 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15, 10, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================
// SISTEMA DE ATMOSFERA (CHUVA, NEVOA, ETC)
// ============================================

class Atmosphere {
  constructor() {
    this.rain = [];      // Gotas de chuva
    this.sparks = [];    // Faíscas
    this.fog = [];       // Nevoeiro
  }

  // Atualiza e desenha os efeitos atmosféricos
  update(dt) {
    // Efeito de chuva quando perto do chefe
    if (state === 'PLAYING' && entities.some(e => e.type === 'boss' && !e.dead)) {
      for (let i = 0; i < 5; i++) {
        this.rain.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speed: Math.random() * 500 + 200,
          length: Math.random() * 20 + 10
        });
      }
    }

    // Atualiza e desenha a chuva
    this.rain = this.rain.filter(r => {
      r.y += r.speed * dt;
      if (r.y > canvas.height) return false;

      ctx.save();
      ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 5, r.y - r.length);
      ctx.stroke();
      ctx.restore();

      return true;
    });

    // Efeito de nevoeiro
    if (state === 'PLAYING' && Math.random() > 0.95) {
      this.fog.push({
        x: -100,
        y: Math.random() * canvas.height,
        speed: Math.random() * 30 + 20,
        opacity: Math.random() * 0.3 + 0.2
      });
    }

    // Atualiza e desenha o nevoeiro
    this.fog = this.fog.filter(f => {
      f.x += f.speed * dt;
      if (f.x > canvas.width + 100) return false;

      ctx.save();
      ctx.globalAlpha = f.opacity;
      ctx.fillStyle = 'rgba(200, 200, 200, 0.1)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 100, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return true;
    });
  }
}

// Cria a instância da atmosfera
const atmosphere = new Atmosphere();

// ============================================
// FUNÇÕES DE CONTROLE DA HORDA
// ============================================

// Atualiza o número de guerreiros na horda
function updateHorde(n) {
  let old = h.count;
  h.count = Math.max(0, Math.floor(n));
  const target = Math.min(h.count, 100);

  // Adiciona novas unidades se necessário
  while (h.units.length < target) {
    h.units.push({
      rx: 0,  // Posição relativa X
      ry: 0,  // Posição relativa Y
      tx: 0,  // Posição alvo X
      ty: 0,  // Posição alvo Y
      b: Math.random() * Math.PI * 2,  // Fase para animação
      s: 0,   // Fator de suavização
      type: Math.random() > 0.9 ? 'elite' : 'normal',  // Tipo da unidade
      offset: Math.random() * Math.PI * 2  // Offset para animação
    });
  }

  // Remove unidades extras
  while (h.units.length > target) h.units.pop();

  // Efeitos sonoros e de combo
  if (n > old) {
    updateCombo(1);
    playSoundEffect('kill');
  } else if (n < old) combo = 1;
}

// ============================================
// SISTEMA DE INPUT (TOQUE E MOVIMENTO)
// ============================================

// Processa input do jogador
const input = (x, isTap = false) => {
  if (state === 'PLAYING') {
    // Move a horda para a posição X do toque
    h.targetX = Math.max(40, Math.min(canvas.width - 40, x));

    // Se foi um toque (tap)
    if (isTap) {
      const now = Date.now();
      const delay = now - lastTap;

      // Double tap para atirar
      if (delay < 300 && delay > 10) {
        fireProjectile();
      }
      lastTap = now;

      // Efeito de esquiva se toque longe da posição atual
      if (Math.abs(x - h.x) > 100 && h.dodge <= 0) {
        h.dodge = 0.4;
        ParticleSystem.spawnTrail(h.x, h.y, '#ffd966');
      }
    }
  }
};

// Função para disparar projéteis
function fireProjectile() {
  const bulletSpeed = CFG.speed * CFG.bulletSpeedMult;
  for (let i = 0; i < shotsSimultaneous; i++) {
    const offsetX = (i - (shotsSimultaneous - 1) / 2) * 20;
    projectiles.push({
      x: h.x + offsetX,
      y: h.y,
      vy: -bulletSpeed,  // Velocidade vertical (para cima)
      vx: 0,
      active: true,
      type: 'bullet',
      p: 0
    });
  }
  playSoundEffect('attack');
}

// Event listeners para mouse
canvas.addEventListener('mousemove', e => input(e.clientX - canvas.getBoundingClientRect().left));
canvas.addEventListener('mousedown', e => input(e.clientX - canvas.getBoundingClientRect().left, true));

// Event listeners para toque (mobile)
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

// Função genérica para usar habilidades
const useSkill = (id, cost, cd, fn) => {
  if (energy < cost || h.cooldowns[id] > 0) return false;
  energy -= cost;
  h.cooldowns[id] = cd;
  fn();
  updateUI();
  playSoundEffect('skill', Math.floor(Math.random() * 3));

  // Efeitos visuais
  ParticleSystem.spawn(h.x, h.y, CFG.skills[id].color, 15, 'explosion');
  FloatingText.add(h.x, h.y, CFG.skills[id].icon, 'special');

  return true;
};


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
  ParticleSystem.spawn(modifier.x, screenY, positive ? '#6fff6f' : '#ff6f6f', 18, positive ? 'magic' : 'explosion');
  playSoundEffect(positive ? 'skill' : 'hit');

  if (after <= 0) fail();
}

// ============================================
// CLASSE DE ENTIDADES
// ============================================

class Entity {
  constructor(t, x, y, val) {
    this.type = t;        // Tipo: 'enemy', 'boss', 'cart', etc
    this.x = x;           // Posição X
    this.y = y;           // Posição Y
    this.v = val;         // Valor (vida, quantidade, etc)
    this.dead = false;    // Se está morta
    this.u = [];          // Unidades (para grupos)
    this.f = 0;           // Flash (quando toma dano)
    this.burning = 0;     // Tempo queimando
    this.frozen = 0;      // Tempo congelado
    this.poisoned = 0;    // Tempo envenenado
    this.op = null;       // Operador para obstáculos modificadores
    this.value = 0;       // Valor do modificador
    this.w = 90;          // Largura da entidade/obstáculo
    this.h = 110;         // Altura da entidade/obstáculo
    this.passed = false;  // Já foi acionado
    this.side = null;     // Lado do portão: left/right
    this.rowId = null;    // Identificador do par de portões
  }

  // Desenha a entidade
  draw(dy) {
    let Y = this.y + dy;
    if (Y < -200 || Y > canvas.height + 200) return;

    ctx.save();
    ctx.translate(this.x, Y);

    // Efeito de queimadura
    if (this.burning > 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff4444';
    }

    // Desenha baseado no tipo
    if (this.type === 'gate') {
      // Portão da cidade
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-70, -40, 140, 100);
      ctx.fillStyle = '#2a1f15';
      ctx.fillRect(-60, -30, 120, 90);
      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 40px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('🚪', 0, -50);

    } else if (this.type === 'modifier') {
      const positive = this.op === '+' || this.op === 'x';
      const label = this.op === 'x' ? `x${this.value}` : `${this.op}${this.value}`;
      const gateHeight = this.h + 55;
      const panelInset = 12;
      const postWidth = 14;

      // pilares do portão
      ctx.fillStyle = '#c9cdd6';
      ctx.fillRect(-this.w / 2 - 10, -gateHeight / 2, postWidth, gateHeight);
      ctx.fillRect(this.w / 2 - 4, -gateHeight / 2, postWidth, gateHeight);

      // base/placa
      ctx.shadowBlur = 22;
      ctx.shadowColor = positive ? 'rgba(111,255,111,0.45)' : 'rgba(255,111,111,0.45)';
      ctx.fillStyle = positive ? 'rgba(50, 170, 90, 0.92)' : 'rgba(190, 65, 65, 0.92)';
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(-this.w / 2 + panelInset, -this.h / 2 + panelInset, this.w - panelInset * 2, this.h - panelInset * 2);

      ctx.strokeStyle = positive ? '#d7ffe0' : '#ffd6d6';
      ctx.lineWidth = 4;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      // topo do portão
      ctx.fillStyle = positive ? '#1e6b39' : '#8c2323';
      ctx.fillRect(-this.w / 2 - 6, -this.h / 2 - 18, this.w + 12, 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 8);
      ctx.font = 'bold 12px Cinzel';
      ctx.fillText('GUERREIROS', 0, 30);

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.w / 2 + 6, -this.h / 2 + 6, 16, this.h - 12);
      ctx.globalAlpha = 1;

    } else if (this.type === 'enemy') {
      // Inimigos (Legião Troiana)
      if (this.f > 0) ctx.filter = 'brightness(200%)';
      if (this.burning > 0) ctx.filter = 'brightness(150%) hue-rotate(-30deg)';

      this.u.forEach((u, i) => {
        let xOffset = u.x + Math.sin(time * 3 + i) * 2;
        let yOffset = u.y + Math.cos(time * 2 + i) * 2;

        // Usa o novo sistema de desenho
        drawCharacter(
          ctx,
          xOffset,
          yOffset,
          'enemy',
          u.type || 'normal'
        );
      });

    } else if (this.type === 'cart') {
      // Carroça
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-25, -20, 50, 30);
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-15, -25, 30, 10);
      ctx.fillStyle = '#ffd966';
      ctx.textAlign = 'center';
      ctx.fillText('🛒', 0, 0);

    } else if (this.type === 'trojan') {
      // Cavalo de Troia (usa o novo sistema)
      drawCharacter(ctx, 0, 0, 'trojan');

    } else if (this.type === 'boss') {
      // Chefe
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(-120, -100, 240, 240);
      ctx.fillStyle = '#2a1f15';
      ctx.fillRect(-100, -80, 200, 200);

      // Barra de vida
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-100, -120, 200, 20);
      ctx.fillStyle = '#bc8f3f';
      ctx.fillRect(-100, -120, 200 * (this.v / (300 + level * 200)), 20);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(-100, -120, 200, 20);

      ctx.fillStyle = '#ffd966';
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('CHEFÃO TROIANO', 0, -150);
    }

    ctx.restore();
  }
}

// ============================================
// SISTEMA DE RESIZE (REDIMENSIONAMENTO)
// ============================================

function resize() {
  canvas.width = Math.min(window.innerWidth, 500);
  canvas.height = Math.min(window.innerHeight, 900);

  // Recentraliza X
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
  updateHorde(1); // Começa com 1 guerreiro

  // Gera o percurso da fase
  const levelLength = 5000 + l * 2000;
  gateY = -levelLength + 1000;

  // Gera entidades ao longo do caminho
  for (let i = 0; i < levelLength / 300; i++) {
    let y = -400 - i * 400;
    let type = Math.random();

    if (i > 1 && i % 3 === 0) {
      const laneOffset = Math.min(138, canvas.width * 0.28);
      const gateRow = buildGatePair();
      const rowId = ++gateRowCounter;

      const left = new Entity('modifier', cx() - laneOffset, y, 0);
      left.op = gateRow.left.op;
      left.value = gateRow.left.value;
      left.w = 110;
      left.h = 120;
      left.side = 'left';
      left.rowId = rowId;

      const right = new Entity('modifier', cx() + laneOffset, y, 0);
      right.op = gateRow.right.op;
      right.value = gateRow.right.value;
      right.w = 110;
      right.h = 120;
      right.side = 'right';
      right.rowId = rowId;

      entities.push(left, right);
      continue;
    }

    if (type < 0.25) {
      // Carroça (dá tiros simultâneos)
      entities.push(new Entity('cart', Math.random() * (canvas.width - 100) + 50, y));
    } else if (type < 0.5) {
      // Cavalo de Troia (dá guerreiros)
      let e = new Entity('trojan', cx(), y);
      e.swing = Math.random() * Math.PI; // Para movimento em zigzag
      entities.push(e);
    } else {
      // Legião Inimiga
      let e = new Entity('enemy', Math.random() * (canvas.width - 200) + 100, y, 5 + level);
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

  // Chefe final
  bossLevelY = -levelLength;
  entities.push(new Entity('boss', cx(), bossLevelY, 100 + l * 200));

  // Decorações laterais (casas)
  for (let i = 0; i < levelLength / 280; i++) {
    decors.push({ x: 40, y: -i * 280, type: 'house', side: 'left' });
    decors.push({ x: canvas.width - 40, y: -i * 280, type: 'house', side: 'right' });
  }

  updateUI();
  FloatingText.add(cx(), canvas.height * 0.45, `INICIANDO O CERCO - NÍVEL ${l}`, 'special');
}

// ============================================
// FUNÇÕES DE FIM DE JOGO
// ============================================

function fail() {
  state = 'MENU';
  screens.over.classList.add('active');
  txt.kills.innerText = totalKills;
  txt.finalLevel.innerText = level;

  // Salva recorde
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

// ============================================
// ATUALIZAÇÃO DA INTERFACE
// ============================================

function updateUI() {
  txt.levelNum.innerText = level;
  txt.coins.innerText = coins;
  txt.energy.innerText = Math.floor(energy);

  // Barra de progresso
  let progress = Math.min(1, Math.abs(dist / gateY));
  el('progress-bar').style.width = progress * 100 + '%';
}

// ============================================
// GAME LOOP PRINCIPAL
// ============================================

function gameLoop(t) {
  // Calcula delta time (tempo entre frames)
  let dt = (t - lastTime) / 1000;
  if (dt > 0.1 || isNaN(dt)) dt = 0.016; // Limita ou corrige se NaN
  lastTime = t;

  // ==========================================
  // ATUALIZAÇÃO DA LÓGICA (estado PLAYING)
  // ==========================================
  if (state === 'PLAYING') {
    time += dt;
    dist += gSpeed * h.speedBoost * (h.dodge > 0 ? 2.0 : 1) * dt;

    // Atualiza escudo
    if (sShield > 0) {
      sShield -= dt;
      if (sShield <= 0) h.armor = 1;
    }

    // Atualiza combo
    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) combo = 1;
    }

    // Atualiza cooldowns
    for (let s in h.cooldowns) h.cooldowns[s] = Math.max(0, h.cooldowns[s] - dt);
    energy = Math.min(100, energy + CFG.eReg * dt);

    // Atualiza esquiva
    if (h.dodge > 0) h.dodge -= dt;

    // Movimento suavizado da horda
    h.vx += ((h.targetX - h.x) * 10 - h.vx) * dt * 8;
    h.x += h.vx * dt;
    h.tilt = h.vx * 0.0015;
    h.dCount += (h.count - h.dCount) * dt * 7;

    // Atualiza posições das unidades na horda
    let rad = 35 + Math.sqrt(h.count) * 2.5;
    h.units.forEach((u, idx) => {
      u.b += dt * 15;

      // Movimento suave para posições aleatórias
      let d = Math.sqrt(u.rx * u.rx + u.ry * u.ry);
      if (d > rad || Math.random() > 0.97) {
        let a = Math.random() * Math.PI * 2,
          r = Math.random() * rad;
        u.tx = Math.cos(a) * r;
        u.ty = Math.sin(a) * r;
      }
      u.rx += (u.tx - u.rx) * 7 * dt;
      u.ry += (u.ty - u.ry) * 7 * dt;

      // Trail para unidades de elite
      if (u.type === 'elite' && Math.random() > 0.95) {
        ParticleSystem.spawnTrail(h.x + u.rx, h.y + u.ry, '#ffd966');
      }
    });

    // ========================================
    // ATUALIZAÇÃO DOS PROJÉTEIS
    // ========================================
    projectiles = projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Trail dos projéteis
      if (Math.random() > 0.7) ParticleSystem.spawnTrail(p.x, p.y, '#ffd966');

      // Remove se sair da tela
      if (p.y < -100 || p.y > canvas.height + 100) return false;

      // Verifica colisão com entidades
      for (let e of entities) {
        if (e.dead) continue;
        let ey = e.y + dist;
        let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - ey) ** 2);

        if (d < 50) {
          if (e.type === 'cart') {
            // Carroça: aumenta tiros simultâneos
            shotsSimultaneous = Math.min(5, shotsSimultaneous + 1);
            h.shootSpeed += 0.2;
            floating(e.x, ey, '🚀 TIROS +1', 'positive');
            e.dead = true;

          } else if (e.type === 'trojan') {
            // Cavalo de Troia: ganha guerreiros
            if (h.count < CFG.maxWarriors) {
              updateHorde(h.count + 1);
              floating(e.x, ey, '⚔️ +1 GUERREIRO', 'positive');
            } else {
              energy = 100;
              floating(e.x, ey, '⚡ ENERGIA FULL', 'special');
            }
            e.dead = true;

          } else if (e.type === 'enemy') {
            // Inimigo: remove uma unidade
            if (e.u.length > 0) {
              e.u.pop();
              // Sangue!
              ParticleSystem.spawnBlood(p.x, p.y, 8);

              if (e.u.length === 0) {
                e.dead = true;
                // Efeito especial quando morre
                ParticleSystem.spawnMagic(p.x, p.y, '#ff0000');
              }
              h.kills++;
              totalKills++;
              updateCombo(1);
            }

          } else if (e.type === 'boss') {
            // Chefe: reduz vida
            e.v -= 10 * h.firePower;
            if (e.v <= 0) win();
          }

          if (e.dead || e.type === 'boss' || e.type === 'enemy') {
            ParticleSystem.spawn(p.x, p.y, '#ffd966', 8, 'sparkle');
            return false; // Remove projétil
          }
        }
      }
      return true;
    });

    // Remove entidades mortas
    entities = entities.filter(e => !e.dead);

    // ========================================
    // ATUALIZAÇÃO DAS ENTIDADES
    // ========================================
    entities.forEach(e => {
      let Y = e.y + dist;

      if (e.type === 'cart') {
        e.y += 50 * dt; // Carroça desce mais devagar

      } else if (e.type === 'trojan') {
        e.swing += dt * 3;
        e.x = cx() + Math.sin(e.swing) * 150; // Movimento em zigzag

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

      } else if (e.type === 'enemy') {
        // Colisão direta com a horda
        let d = Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2);
        if (d < 60) {
          if (h.dodge <= 0 && sShield <= 0) {
            updateHorde(h.count - 1);
            shake = 10;
          }
          if (Math.random() > 0.9) e.u.pop();
          if (h.count <= 0) fail();
        }

      } else if (e.type === 'boss') {
        // Colisão com o chefe
        if (h.y < Y + 220 && h.y > Y - 50) {
          e.v -= 50 * dt;
          if (h.dodge <= 0 && sShield <= 0) updateHorde(h.count - 5 * dt);
          if (h.count <= 0) fail();
        }
      }
    });

    updateUI();
    if (shake > 0) shake -= dt * 50;
  }

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();

  // Aplica tremor de tela
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // Desenha fundo com estrada
  drawRoadBackground();

  // Desenha decorações
  decors.forEach(d => {
    let dy = d.y + dist;
    if (dy > -150 && dy < ch + 150) {
      drawHouse(d.x, dy, d.side);
    }
  });

  // Desenha entidades
  entities.forEach(e => e.draw(dist));

  // Desenha projéteis
  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#ffd966';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Desenha a horda do jogador
  if (state === 'PLAYING') {
    ctx.save();
    ctx.translate(h.x, h.y);

    // Efeito de escudo
    if (sShield > 0) {
      ctx.strokeStyle = '#6f9fff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Desenha cada unidade da horda
    h.units.forEach((u, i) => {
      let x = u.rx + Math.sin(time * 5 + i) * 2;
      let y = u.ry + Math.cos(time * 4 + i) * 2;

      // Usa o novo sistema de desenho
      drawCharacter(
        ctx,
        x,
        y + Math.sin(u.b) * 4,
        'player',
        u.type || 'normal'
      );
    });

    ctx.restore();

    // Contador de guerreiros
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#bc8f3f';
    ctx.fillStyle = '#e6c7a2';
    ctx.font = 'bold 30px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️ ' + Math.floor(h.dCount), h.x, h.y - 80);

    // Indicador de combo
    if (combo > 1) {
      ctx.fillStyle = combo > 10 ? '#ff6f6f' : '#e6c7a2';
      ctx.font = 'bold 24px Cinzel';
      ctx.fillText('x' + combo.toFixed(1), h.x + 70, h.y - 100);
    }
  }

  // Desenha partículas
  particles.forEach((p, i) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Gravidade para partículas de sangue
    if (p.type === 'blood') p.vy += 500 * dt;

    p.l -= dt * (p.type === 'trail' ? 3 : 1.5);

    if (p.l <= 0) {
      particles.splice(i, 1);
    } else {
      ctx.globalAlpha = p.l;
      ctx.fillStyle = p.color;

      if (p.type === 'sparkle' || p.type === 'magic') {
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

  // Desenha textos flutuantes
  floatingTexts.forEach((f, i) => {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt * 1.5;

    ctx.globalAlpha = f.life;
    ctx.shadowBlur = 10;

    // Cor baseada no tipo
    if (f.type === 'positive') {
      ctx.fillStyle = '#6fff6f';
      ctx.shadowColor = '#00ff00';
    } else if (f.type === 'negative') {
      ctx.fillStyle = '#ff6f6f';
      ctx.shadowColor = '#ff0000';
    } else if (f.type === 'critical' || f.type === 'special') {
      ctx.fillStyle = '#ffd966';
      ctx.shadowColor = '#ffaa00';
      ctx.font = 'bold 24px Cinzel';
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
    }

    ctx.font = 'bold 20px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);

    if (f.life <= 0) floatingTexts.splice(i, 1);
  });

  // Desenha efeitos atmosféricos
  atmosphere.update(dt);

  // Efeitos de tela de menu
  if (state === 'MENU') {
    if (Math.random() > 0.9) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 20,
        vy: -Math.random() * 50 - 20,
        l: 2,
        color: `rgba(188, 143, 63, ${Math.random() * 0.5})`,
        s: Math.random() * 3 + 1,
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
// FUNÇÃO PARA DESENHAR CASAS (DECORAÇÃO)
// ============================================

function drawHouse(x, y, side) {
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
}

// ============================================
// INICIALIZAÇÃO DO JOGO
// ============================================

// Aplica resize inicial
resize();

// Inicia o game loop
requestAnimationFrame(gameLoop);