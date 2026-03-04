const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');

// UI Elements
const uiMainMenu = document.getElementById('main-menu');
const uiGameOver = document.getElementById('game-over-screen');
const uiVictory = document.getElementById('victory-screen');

const btnStart = document.getElementById('start-btn');
const btnRestart = document.getElementById('restart-btn');
const btnNextLevel = document.getElementById('next-level-btn');
const uiProgressBar = document.getElementById('progress-bar');

const txtLevelIndicator = document.getElementById('level-indicator');
const txtCoinCount = document.getElementById('coin-count');
const txtEnergyCount = document.getElementById('energy-count');
const txtArrowCount = document.getElementById('arrow-count');
const txtFinalLevel = document.getElementById('final-level');
const txtFinalKills = document.getElementById('final-kills');
const txtLevelCoins = document.getElementById('level-coins');
const endMessage = document.getElementById('end-message');
const endTitle = document.getElementById('end-title');

// Skill elements
const skillArrow = document.getElementById('skill-arrow');
const skillShield = document.getElementById('skill-shield');
const skillFire = document.getElementById('skill-fire');
const skillHeal = document.getElementById('skill-heal');
const weapons = document.querySelectorAll('.weapon');
const activeEffects = document.getElementById('active-effects');

// Resize handling
function resize() {
    canvas.width = window.innerWidth > 500 ? 500 : window.innerWidth;
    canvas.height = window.innerHeight > 900 ? 900 : window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- NOVAS CONFIGURAÇÕES (THEME CHINÊS) ---
const CONFIG = {
    DIRECAO: 'CIMA',
    VELOCIDADE_BASE: 250,
    VELOCIDADE_INIMIGO: 60,
    SENSIBILIDADE: 3.2,
    DIFICULDADE: 1.0,
    COR_PRIMARIA: '#c91a1a',
    COR_SECUNDARIA: '#ffd966',
    MAX_ENERGY: 100,
    ENERGY_RECHARGE: 5,
    ARROW_DAMAGE: 3,
    FIRE_DAMAGE: 8,
    SHIELD_DURATION: 3,
    COMBO_MULTIPLIER: 1.0
};

// Game State
let gameState = 'MENU';
let lastTime = 0;
let level = 1;
let coins = 0;
let energy = 100;
let arrows = 0;
let totalKills = 0;
let distanceTravelled = 0;
let gameSpeed = CONFIG.VELOCIDADE_BASE;
let currentSpeedMult = 1.0;
let shakeAmount = 0;
let gameTime = 0;
let combo = 0;
let comboMultiplier = 1.0;
let comboTimeout = 0;

// Active effects
let activeShield = false;
let shieldTimer = 0;
let fireDamageBoost = 0;
let skillCooldowns = {
    arrow: 0,
    shield: 0,
    fire: 0,
    heal: 0
};

// Selected weapon
let currentWeapon = 'spear';

let entities = [];

function applyShake(amt) {
    shakeAmount = Math.max(shakeAmount, amt);
}

// Audio Context
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playPopSound(freq = 400, type = 'sine', duration = 0.1) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Particle System
let particles = [];
function spawnParticles(x, y, color, count, type = 'explosion') {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        let speed = type === 'explosion' ? Math.random() * 300 + 100 : Math.random() * 100 + 50;
        let life = type === 'explosion' ? 1.2 : 0.8;
        let size = type === 'explosion' ? Math.random() * 8 + 3 : Math.random() * 4 + 2;

        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: life,
            color: color,
            size: size,
            type: type
        });
    }
}

// Floating UI Texts
function spawnFloatingText(x, y, text, type = 'positive', size = '2rem') {
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.innerText = text;
    el.style.fontSize = size;

    const rect = canvas.getBoundingClientRect();
    const uiRect = uiLayer.getBoundingClientRect();
    const posX = x + (rect.left - uiRect.left);
    const posY = y + (rect.top - uiRect.top);

    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    uiLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// Player
let horde = {
    x: canvas.width / 2,
    y: canvas.height * 0.8,
    count: 10,
    targetX: canvas.width / 2,
    baseRadius: 2,
    displayCount: 10,
    units: [],
    auraPulse: 0,
    vx: 0,
    tilt: 0,
    bounce: 1.0,
    attackPower: 1.0,
    defense: 1.0,
    criticalChance: 0.05,
    criticalMultiplier: 2.0
};

class HordeUnit {
    constructor() {
        this.relX = (Math.random() - 0.5) * 20;
        this.relY = (Math.random() - 0.5) * 20;
        this.targetRelX = this.relX;
        this.targetRelY = this.relY;
        this.scale = 0;
        this.bob = Math.random() * Math.PI * 2;
        this.type = Math.floor(Math.random() * 3);
        this.attackAnimation = 0;
    }

    update(dt, radius) {
        if (this.scale < 1) this.scale += dt * 5;
        this.bob += dt * 15;

        if (this.attackAnimation > 0) {
            this.attackAnimation -= dt * 5;
        }

        let dist = Math.sqrt(this.relX * this.relX + this.relY * this.relY);
        if (dist > radius || Math.random() > 0.98) {
            let angle = Math.random() * Math.PI * 2;
            let range = Math.random() * radius * 0.9;
            this.targetRelX = Math.cos(angle) * range;
            this.targetRelY = Math.sin(angle) * range;
        }

        this.relX += (this.targetRelX - this.relX) * 4 * dt;
        this.relY += (this.targetRelY - this.relY) * 4 * dt;
    }
}

function updateHordeCount(newCount) {
    let oldCount = horde.count;
    horde.count = Math.floor(newCount);
    if (horde.count < 0) horde.count = 0;
    if (horde.count > 999) horde.count = 999;

    const VISUAL_LIMIT = 150;
    const targetVisuals = Math.min(horde.count, VISUAL_LIMIT);
    const diff = targetVisuals - horde.units.length;

    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            horde.units.push(new HordeUnit());
        }
    } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
            if (horde.units.length > 0) {
                horde.units.pop();
            }
        }
    }

    horde.attackPower = 1.0 + Math.floor(horde.count / 50) * 0.2;
    horde.criticalChance = 0.05 + Math.floor(horde.count / 100) * 0.02;

    if (newCount > oldCount) {
        combo++;
        comboMultiplier = Math.min(3.0, 1.0 + combo * 0.1);
        comboTimeout = 2.0;
    } else if (newCount < oldCount) {
        combo = 0;
        comboMultiplier = 1.0;
    }
}

// Input
let isDragging = false;
let lastMouseX = 0;
let mouseVelocity = 0;

function handleInteractionStart(x) {
    if (gameState !== 'PLAYING') return;
    isDragging = true;
    lastMouseX = x;
    horde.targetX = x;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
}

function handleInteractionMove(x) {
    if (!isDragging || gameState !== 'PLAYING') return;
    mouseVelocity = x - lastMouseX;
    lastMouseX = x;
    horde.targetX = x;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
}

function handleInteractionEnd() {
    isDragging = false;
    mouseVelocity = 0;
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleInteractionStart(e.clientX - rect.left);
});
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleInteractionMove(e.clientX - rect.left);
});
window.addEventListener('mouseup', handleInteractionEnd);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    handleInteractionStart(e.touches[0].clientX - rect.left);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    handleInteractionMove(e.touches[0].clientX - rect.left);
}, { passive: false });
window.addEventListener('touchend', handleInteractionEnd);

// Projectiles
let projectiles = [];

class Projectile {
    constructor(x, y, targetX, targetY, type) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.type = type;
        this.progress = 0;
        this.speed = type === 'arrow' ? 8 : 5;
        this.damage = type === 'arrow' ? CONFIG.ARROW_DAMAGE : CONFIG.FIRE_DAMAGE;
        this.active = true;
        this.angle = 0;
    }

    update(dt) {
        this.progress += this.speed * dt;
        this.angle += 10 * dt;
        if (this.progress >= 1) {
            this.active = false;
            return true;
        }
        let t = this.progress;
        this.x = this.startX + (this.targetX - this.startX) * t;
        this.y = this.startY + (this.targetY - this.startY) * t - 50 * Math.sin(t * Math.PI);
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        if (this.type === 'arrow') {
            ctx.fillStyle = '#ffd966';
            ctx.fillRect(-10, -2, 20, 4);
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// Enemies
class EnemyUnit {
    constructor(isLeader = false) {
        this.relX = (Math.random() - 0.5) * 40;
        this.relY = (Math.random() - 0.5) * 40;
        this.isLeader = isLeader;
        this.type = Math.floor(Math.random() * 3);
        this.attackCooldown = 0;
        this.speedBoost = (Math.random() > 0.7) ? Math.random() * 50 : 0;
    }
}

class EnemyGroup {
    constructor(y, count, xOffset, type = 'mixed') {
        this.y = y;
        this.x = xOffset;
        this.initialCount = count;
        this.units = [];
        this.dispersing = false;
        this.flashTimer = 0;
        for (let i = 0; i < count; i++) {
            this.units.push(new EnemyUnit(i === 0));
        }
    }

    update(dt) {
        if (this.units.length === 0) return;
        let worldHordeY = (CONFIG.DIRECAO === 'CIMA' ? -distanceTravelled + horde.y : distanceTravelled + horde.y);
        let distY = Math.abs(this.y - worldHordeY);
        if (!this.dispersing && distY < 500) {
            this.x += (horde.x - this.x) * dt * 2;
        }
        let move = CONFIG.VELOCIDADE_INIMIGO * dt;
        if (CONFIG.DIRECAO === 'CIMA') this.y += move;
        else this.y -= move;

        if (this.dispersing) {
            for (let u of this.units) {
                u.relX += (u.relX > 0 ? 400 : -400) * dt;
                u.relY += (CONFIG.DIRECAO === 'CIMA' ? -200 : 200) * dt;
            }
        }
        if (this.flashTimer > 0) this.flashTimer -= dt;
    }

    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 100 || drawY < -100) return;
        ctx.save();
        if (this.flashTimer > 0) ctx.filter = 'brightness(200%)';
        for (let u of this.units) {
            ctx.fillStyle = u.isLeader ? '#c91a1a' : '#8b4513';
            ctx.beginPath(); ctx.arc(this.x + u.relX, drawY + u.relY, u.isLeader ? 10 : 7, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#ffd966'; ctx.textAlign = 'center'; ctx.fillText(this.units.length, this.x, drawY - 40);
    }

    checkCollision(hx, hy, dy, dt) {
        if (this.units.length === 0 || this.dispersing) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        let dist = Math.sqrt((hx - this.x) ** 2 + (hy - drawY) ** 2);
        let pRad = 30 + Math.sqrt(horde.count) * 2;

        if (dist < pRad + 50) {
            let kills = Math.ceil(100 * dt * horde.attackPower);
            for (let i = 0; i < kills && this.units.length > 0; i++) {
                let u = this.units.pop();
                if (u.isLeader && this.units.length > 0) this.dispersing = true;
                updateHordeCount(horde.count - 1);
                spawnParticles(this.x + u.relX, drawY + u.relY, '#ff4444', 2);
            }
            if (horde.count <= 0) gameOver();
        }
    }
}

// Boss
class Boss {
    constructor(y, count) {
        this.y = y; this.count = count; this.maxCount = count;
        this.height = 200;
    }
    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        ctx.fillStyle = '#8b4513'; ctx.fillRect(0, drawY, canvas.width, this.height);
        ctx.fillStyle = '#c91a1a'; ctx.fillRect(canvas.width / 2 - 50, drawY + 20, 100, 150);
        ctx.fillStyle = '#ffd966'; ctx.font = '40px Outfit'; ctx.fillText('龍', canvas.width / 2 - 20, drawY + 100);
        ctx.fillStyle = 'white'; ctx.fillText(Math.floor(this.count), canvas.width / 2 - 30, drawY - 20);
    }
    update(dt) { }
    checkCollision(hx, hy, dy, dt) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (hy < drawY + this.height && hy > drawY) {
            let dmg = 200 * dt;
            this.count -= dmg;
            updateHordeCount(horde.count - dmg);
            if (this.count <= 0) victory();
            else if (horde.count <= 0) gameOver();
        }
    }
}

// World Objects
class Gate {
    constructor(y, typeL, valL, typeR, valR) {
        this.y = y; this.typeL = typeL; this.valL = valL; this.typeR = typeR; this.valR = valR;
        this.height = 100; this.passed = false;
    }
    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        ctx.fillStyle = '#5d3a1a'; ctx.fillRect(0, drawY, canvas.width / 2, this.height);
        ctx.fillRect(canvas.width / 2, drawY, canvas.width / 2, this.height);
        ctx.fillStyle = '#ffd966'; ctx.textAlign = 'center';
        ctx.fillText(`${this.typeL}${this.valL}`, canvas.width / 4, drawY + 60);
        ctx.fillText(`${this.typeR}${this.valR}`, canvas.width * 3 / 4, drawY + 60);
    }
    checkCollision(hx, hy, dy) {
        if (this.passed) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (hy < drawY + this.height && hy > drawY) {
            this.passed = true;
            let val = hx < canvas.width / 2 ? this.valL : this.valR;
            let type = hx < canvas.width / 2 ? this.typeL : this.typeR;
            let n = horde.count;
            if (type === '+') n += val; else if (type === '-') n -= val; else if (type === '*') n *= val; else n /= val;
            updateHordeCount(n);
            playPopSound(600);
        }
    }
}

class Coin {
    constructor(y, x) { this.y = y; this.x = x; this.collected = false; }
    draw(ctx, dy) {
        if (this.collected) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        ctx.fillStyle = '#ffd966'; ctx.beginPath(); ctx.arc(this.x, drawY, 10, 0, Math.PI * 2); ctx.fill();
    }
    checkCollision(hx, hy, dy) {
        if (this.collected) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (Math.sqrt((hx - this.x) ** 2 + (hy - drawY) ** 2) < 40) {
            this.collected = true; coins++; playPopSound(800);
        }
    }
}

// Logic
function loadLevel(l) {
    level = l; txtLevelIndicator.innerText = `Nível ${level}`;
    entities = []; distanceTravelled = 0; gameSpeed = CONFIG.VELOCIDADE_BASE + l * 10;
    updateHordeCount(10); horde.x = canvas.width / 2;
    let currY = 0;
    for (let i = 0; i < 6; i++) {
        currY -= 600;
        entities.push(new Gate(currY, '+', 10, '*', 2));
        entities.push(new EnemyGroup(currY + 300, 10 + l * 5, Math.random() * canvas.width));
        entities.push(new Coin(currY + 450, Math.random() * canvas.width));
    }
    bossLevelY = currY - 800;
    entities.push(new Boss(bossLevelY, 100 + l * 100));
}

function update(dt) {
    if (gameState !== 'PLAYING') return;
    gameTime += dt; distanceTravelled += gameSpeed * dt;
    energy = Math.min(100, energy + dt * 5);
    updateHordeCount(horde.count);

    let targetVX = (horde.targetX - horde.x) * 10;
    horde.vx += (targetVX - horde.vx) * dt * 8;
    horde.x += horde.vx * dt;

    for (let e of entities) { e.update?.(dt); e.checkCollision(horde.x, horde.y, distanceTravelled, dt); }
    uiProgressBar.style.width = `${Math.min(100, (distanceTravelled / Math.abs(bossLevelY)) * 100)}%`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5d3a1a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let e of entities) e.draw(ctx, distanceTravelled);
    if (gameState === 'PLAYING') {
        ctx.fillStyle = '#c91a1a';
        for (let u of horde.units) {
            ctx.beginPath(); ctx.arc(horde.x + u.relX, horde.y + u.relY, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffd966'; ctx.fillText(horde.count, horde.x, horde.y - 40);
    }
}

function gameOver() { gameState = 'MENU'; uiGameOver.classList.add('active'); }
function victory() { gameState = 'MENU'; uiVictory.classList.add('active'); }

function gameLoop(time) {
    let dt = (time - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = time;
    update(dt); draw(); requestAnimationFrame(gameLoop);
}

btnStart.addEventListener('click', () => { uiMainMenu.classList.remove('active'); loadLevel(1); gameState = 'PLAYING'; });
btnRestart.addEventListener('click', () => { uiGameOver.classList.remove('active'); loadLevel(level); gameState = 'PLAYING'; });
btnNextLevel.addEventListener('click', () => { uiVictory.classList.remove('active'); loadLevel(level + 1); gameState = 'PLAYING'; });

requestAnimationFrame(gameLoop);
