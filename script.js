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

// --- NOVAS CONFIGURAÇÕES ---
const CONFIG = {
    DIRECAO: 'CIMA',
    VELOCIDADE_BASE: 250,
    VELOCIDADE_INIMIGO: 70,
    SENSIBILIDADE: 3.5,
    DIFICULDADE: 1.0,
    COR_PRIMARIA: '#c91a1a',
    COR_SECUNDARIA: '#ffd966',
    MAX_ENERGY: 100,
    ENERGY_RECHARGE: 6,
    WEAPON_STATS: {
        spear: { range: 80, fireRate: 0.2, damage: 5, area: 0 },
        bow: { range: 350, fireRate: 0.5, damage: 4, area: 0 },
        cannon: { range: 250, fireRate: 1.2, damage: 15, area: 60 }
    },
    SHIELD_DURATION: 5,
    COMBO_MULTIPLIER: 1.0
};

// Game State
let gameState = 'MENU';
let lastTime = 0;
let level = 1;
let coins = 0;
let energy = 100;
let arrows = 5;
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
let skillCooldowns = { arrow: 0, shield: 0, fire: 0, heal: 0 };
let weaponTimers = { spear: 0, bow: 0, cannon: 0 };

// Selected weapon
let currentWeapon = 'spear';
let entities = [];
let decorations = [];

function applyShake(amt) { shakeAmount = Math.max(shakeAmount, amt); }

// Audio Context
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playPopSound(freq = 400, type = 'sine', duration = 0.1, vol = 0.05) {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + duration);
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
}

// Particle System
let particles = [];
function spawnParticles(x, y, color, count, type = 'explosion') {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        let speed = type === 'explosion' ? Math.random() * 250 + 100 : Math.random() * 120 + 40;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0, color: color,
            size: Math.random() * (type === 'cannon' ? 8 : 5) + 2,
            type: type
        });
    }
}

// Floating UI Texts
function spawnFloatingText(x, y, text, type = 'positive', size = '2.2rem') {
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.innerText = text;
    el.style.fontSize = size;
    const rect = canvas.getBoundingClientRect();
    const uiRect = uiLayer.getBoundingClientRect();
    el.style.left = `${x + (rect.left - uiRect.left)}px`;
    el.style.top = `${y + (rect.top - uiRect.top)}px`;
    uiLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// Player
let horde = {
    x: canvas.width / 2,
    y: canvas.height * 0.82,
    count: 10,
    targetX: canvas.width / 2,
    displayCount: 10,
    units: [],
    vx: 0,
    tilt: 0,
    bounce: 1.0,
    attackPower: 1.0,
    dodgeFrames: 0
};

class HordeUnit {
    constructor() {
        this.relX = (Math.random() - 0.5) * 20;
        this.relY = (Math.random() - 0.5) * 20;
        this.targetRelX = this.relX;
        this.targetRelY = this.relY;
        this.scale = 0;
        this.bob = Math.random() * Math.PI * 2;
        this.attackAnimation = 0;
    }
    update(dt, radius) {
        if (this.scale < 1) this.scale += dt * 4;
        this.bob += dt * 12;
        if (this.attackAnimation > 0) this.attackAnimation -= dt * 8;
        let dist = Math.sqrt(this.relX * this.relX + this.relY * this.relY);
        if (dist > radius || Math.random() > 0.98) {
            let angle = Math.random() * Math.PI * 2;
            let range = Math.random() * radius * 0.95;
            this.targetRelX = Math.cos(angle) * range;
            this.targetRelY = Math.sin(angle) * range;
        }
        this.relX += (this.targetRelX - this.relX) * 6 * dt;
        this.relY += (this.targetRelY - this.relY) * 6 * dt;
    }
}

function updateHordeCount(newCount) {
    let oldCount = horde.count;
    horde.count = Math.floor(newCount);
    if (horde.count < 0) horde.count = 0;
    const VISUAL_LIMIT = 100;
    const targetVisuals = Math.min(horde.count, VISUAL_LIMIT);
    const diff = targetVisuals - horde.units.length;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) horde.units.push(new HordeUnit());
    } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) if (horde.units.length > 0) horde.units.pop();
    }
    horde.attackPower = 1.0 + Math.floor(horde.count / 50) * 0.2;
    if (newCount > oldCount) {
        combo++;
        comboMultiplier = Math.min(3.0, 1.0 + combo * 0.1);
        comboTimeout = 3.0;
    } else if (newCount < oldCount) {
        combo = 0; comboMultiplier = 1.0;
    }
}

// Input
let isDragging = false;
let lastMouseX = 0;
let mouseVelocity = 0;
function handleInteractionStart(x) {
    if (gameState !== 'PLAYING') return;
    isDragging = true; lastMouseX = x; horde.targetX = Math.max(50, Math.min(canvas.width - 50, x));
}
function handleInteractionMove(x) {
    if (!isDragging || gameState !== 'PLAYING') return;
    mouseVelocity = x - lastMouseX; lastMouseX = x; horde.targetX = Math.max(50, Math.min(canvas.width - 50, x));
    // Dodge trigger on fast swipe
    if (Math.abs(mouseVelocity) > 25 && horde.dodgeFrames <= 0) {
        horde.dodgeFrames = 0.4; currentSpeedMult = 1.5; applyShake(4);
    }
}
function handleInteractionEnd() { isDragging = false; mouseVelocity = 0; }

canvas.addEventListener('mousedown', (e) => handleInteractionStart(e.clientX - canvas.getBoundingClientRect().left));
window.addEventListener('mousemove', (e) => handleInteractionMove(e.clientX - canvas.getBoundingClientRect().left));
window.addEventListener('mouseup', handleInteractionEnd);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteractionStart(e.touches[0].clientX - canvas.getBoundingClientRect().left); }, { passive: false });
window.addEventListener('touchmove', (e) => { e.preventDefault(); handleInteractionMove(e.touches[0].clientX - canvas.getBoundingClientRect().left); }, { passive: false });
window.addEventListener('touchend', handleInteractionEnd);

// Skills
function useSkill(skillId, cost, cooldown, effect) {
    if (energy < cost) { spawnFloatingText(canvas.width / 2, canvas.height / 2, '⚡ SEM ENERGIA!', 'negative'); return false; }
    if (skillCooldowns[skillId] > 0) return false;
    energy -= cost; skillCooldowns[skillId] = cooldown; effect(); updateUI(); return true;
}

skillArrow.addEventListener('click', () => useSkill('arrow', 5, 3, () => { arrows += 10; spawnFloatingText(horde.x, horde.y - 60, '+10 🏹', 'positive'); playPopSound(900); }));
skillShield.addEventListener('click', () => useSkill('shield', 15, 12, () => {
    activeShield = true; shieldTimer = CONFIG.SHIELD_DURATION;
    const badge = document.createElement('div'); badge.className = 'effect-badge'; badge.id = 'shield-badge'; badge.innerHTML = '🛡️ ESCUDO'; activeEffects.appendChild(badge);
    playPopSound(400, 'square', 0.4);
}));
skillFire.addEventListener('click', () => useSkill('fire', 20, 15, () => {
    let killed = 0;
    entities.forEach(e => {
        if (e instanceof EnemyGroup) {
            let dy = (e.y + distanceTravelled);
            if (dy > 0 && dy < canvas.height) {
                let k = Math.min(e.units.length, 25);
                for (let i = 0; i < k; i++) { let u = e.units.pop(); spawnParticles(e.x + u.rx, dy + u.ry, '#ff4444', 6); killed++; }
                e.flashTimer = 0.4;
            }
        }
    });
    totalKills += killed; spawnFloatingText(canvas.width / 2, canvas.height / 2, `🔥 ${killed} DESTRUÍDOS!`, 'positive', '3.2rem');
    playPopSound(150, 'sawtooth', 0.6, 0.1); applyShake(15);
}));
skillHeal.addEventListener('click', () => useSkill('heal', 12, 10, () => {
    let heal = Math.floor(horde.count * 0.4) + 10; updateHordeCount(horde.count + heal);
    spawnFloatingText(horde.x, horde.y - 40, `+${heal} 💊`, 'positive'); spawnParticles(horde.x, horde.y, '#00ff88', 30); playPopSound(1100);
}));

// Weapons selector
weapons.forEach(w => w.addEventListener('click', () => {
    weapons.forEach(btn => btn.classList.remove('active')); w.classList.add('active'); currentWeapon = w.dataset.weapon;
    spawnFloatingText(canvas.width / 2, canvas.height / 2, w.querySelector('span:last-child').innerText, 'positive');
    playPopSound(500, 'sine', 0.1, 0.03);
}));

// Projectiles
let projectiles = [];
class Projectile {
    constructor(x, y, tx, ty, type) {
        this.x = x; this.y = y; this.sx = x; this.sy = y; this.tx = tx; this.ty = ty; this.type = type;
        this.progress = 0; let stats = CONFIG.WEAPON_STATS[type === 'arrow' ? 'bow' : 'cannon'];
        this.speed = type === 'arrow' ? 12 : 5; this.dmg = stats.damage; this.area = stats.area;
    }
    update(dt) {
        this.progress += this.speed * dt;
        let t = Math.min(1, this.progress);
        this.x = this.sx + (this.tx - this.sx) * t;
        this.y = this.sy + (this.ty - this.sy) * t - Math.sin(t * Math.PI) * (this.type === 'cannon' ? 100 : 30);
        return this.progress >= 1;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.fillStyle = this.type === 'arrow' ? '#ffd966' : '#2d1a0a';
        ctx.beginPath();
        if (this.type === 'arrow') ctx.arc(0, 0, 4, 0, Math.PI * 2);
        else ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        if (this.type === 'cannon') { ctx.strokeStyle = '#c91a1a'; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.restore();
    }
    onHit() {
        if (this.type === 'cannon') {
            spawnParticles(this.x, this.y, '#ff4444', 30, 'cannon'); applyShake(10);
            playPopSound(100, 'square', 0.4, 0.1);
            entities.forEach(e => {
                if (e instanceof EnemyGroup) {
                    let dist = Math.sqrt((this.x - e.x) ** 2 + (this.y - (e.y + distanceTravelled)) ** 2);
                    if (dist < this.area + 50) {
                        let k = Math.min(e.units.length, Math.floor(this.dmg * comboMultiplier));
                        for (let i = 0; i < k; i++) e.units.pop(); totalKills += k; e.flashTimer = 0.2;
                    }
                }
            });
        }
    }
}

// Entities
class Gate {
    constructor(y, tL, vL, tR, vR) { this.y = y; this.tL = tL; this.vL = vL; this.tR = tR; this.vR = vR; this.passed = false; }
    draw(ctx, dy) {
        let drawY = this.y + dy; if (drawY < -200 || drawY > canvas.height + 200) return;
        ctx.fillStyle = '#5d3a1a'; ctx.fillRect(0, drawY, canvas.width / 2 - 5, 100); ctx.fillRect(canvas.width / 2 + 5, drawY, canvas.width / 2 - 5, 100);
        // Roofs
        ctx.fillStyle = '#c91a1a';
        ctx.beginPath(); ctx.moveTo(0, drawY); ctx.lineTo(canvas.width / 4, drawY - 40); ctx.lineTo(canvas.width / 2 - 5, drawY); ctx.fill();
        ctx.beginPath(); ctx.moveTo(canvas.width / 2 + 5, drawY); ctx.lineTo(canvas.width * 3 / 4, drawY - 40); ctx.lineTo(canvas.width, drawY); ctx.fill();
        // Text
        ctx.fillStyle = '#ffd966'; ctx.textAlign = 'center'; ctx.font = 'bold 30px "Noto Serif SC"';
        ctx.fillText(`${this.tL}${this.vL}`, canvas.width / 4, drawY + 60); ctx.fillText(`${this.tR}${this.vR}`, canvas.width * 3 / 4, drawY + 60);
    }
    checkCollision(hx, hy, dy) {
        if (this.passed) return;
        let drawY = this.y + dy;
        if (hy > drawY && hy < drawY + 100) {
            this.passed = true;
            let onLeft = hx < canvas.width / 2;
            let type = onLeft ? this.tL : this.tR; let val = onLeft ? this.vL : this.vR;
            let n = horde.count;
            if (type === '+') n += val; else if (type === '-') n = Math.max(1, n - val); else if (type === '*') n *= val; else n = Math.max(1, Math.floor(n / val));
            let d = Math.floor(n) - horde.count;
            if (d > 0) { spawnFloatingText(hx, hy, `+${d}`, 'positive', '3rem'); applyShake(6); playPopSound(700); }
            else { spawnFloatingText(hx, hy, `${d}`, 'negative', '3rem'); applyShake(12); playPopSound(150, 'sawtooth'); }
            updateHordeCount(n);
        }
    }
}

class EnemyGroup {
    constructor(y, count, x, isArchers = false) {
        this.y = y; this.x = x; this.units = []; this.flashTimer = 0; this.isArchers = isArchers;
        for (let i = 0; i < count; i++) this.units.push({ rx: (Math.random() - 0.5) * 55, ry: (Math.random() - 0.5) * 55, l: i === 0 });
        this.shootTimer = 1 + Math.random();
    }
    update(dt) {
        let dy = this.y + distanceTravelled;
        if (Math.abs(dy - horde.y) < 600) {
            if (this.isArchers) { // Stay away but follow X
                this.x += (horde.x - this.x) * dt;
                this.shootTimer -= dt;
                if (this.shootTimer <= 0 && dy > 0 && dy < horde.y - 100) {
                    this.shootTimer = 2.0;
                    projectiles.push(new EnemyProjectile(this.x, dy, horde.x, horde.y));
                }
            } else { this.x += (horde.x - this.x) * dt * 2; }
        }
        this.y += CONFIG.VELOCIDADE_INIMIGO * dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
    }
    draw(ctx, dy) {
        let drawY = this.y + dy; if (drawY < -150 || drawY > canvas.height + 150) return;
        ctx.save(); if (this.flashTimer > 0) ctx.filter = 'brightness(200%)';
        this.units.forEach(u => {
            ctx.fillStyle = (this.isArchers ? '#b87c4b' : (u.l ? '#c91a1a' : '#8b4513'));
            ctx.beginPath(); ctx.arc(this.x + u.rx, drawY + u.ry, (u.l ? 11 : 8), 0, Math.PI * 2); ctx.fill();
            if (this.isArchers) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
        });
        ctx.restore();
        ctx.fillStyle = '#ffd966'; ctx.font = 'bold 16px Outfit'; ctx.fillText(this.units.length, this.x, drawY - 45);
    }
    checkCollision(hx, hy, dy, dt) {
        if (this.units.length <= 0) return;
        let ddy = this.y + dy; let dist = Math.sqrt((hx - this.x) ** 2 + (hy - ddy) ** 2);
        let pR = 40 + Math.sqrt(horde.count) * 2;
        // Projectile hits
        projectiles.forEach((p, i) => {
            if (p instanceof Projectile && p.progress >= 1) { // Manual hit check on completion for area
                let d = Math.sqrt((p.x - this.x) ** 2 + (p.y - ddy) ** 2);
                if (d < (p.area || 50)) {
                    let k = Math.min(this.units.length, Math.floor(p.dmg * comboMultiplier));
                    for (let j = 0; j < k; j++) { let u = this.units.pop(); spawnParticles(this.x + u.rx, ddy + u.ry, '#ff4444', 3); }
                    totalKills += k; p.onHit?.(); projectiles.splice(i, 1);
                }
            }
        });
        // Melee hit
        if (dist < pR + 50) {
            let dmg = Math.ceil(150 * dt * horde.attackPower * comboMultiplier);
            for (let i = 0; i < dmg && this.units.length > 0; i++) {
                let u = this.units.pop();
                if (horde.dodgeFrames <= 0) updateHordeCount(horde.count - 1);
                spawnParticles(this.x + u.rx, ddy + u.ry, '#8b4513', 2);
            }
            if (horde.count <= 0) gameOver();
        }
    }
}

class EnemyProjectile {
    constructor(x, y, tx, ty) { this.x = x; this.y = y; this.sx = x; this.sy = y; this.tx = tx; this.ty = ty; this.p = 0; }
    update(dt) { this.p += 4 * dt; let t = Math.min(1, this.p); this.x = this.sx + (this.tx - this.sx) * t; this.y = this.sy + (this.ty - this.sy) * t; return this.p >= 1; }
    draw(ctx) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill(); }
    onHit() { if (horde.dodgeFrames <= 0 && !activeShield) updateHordeCount(horde.count - 5); applyShake(8); playPopSound(200, 'sawtooth'); }
}

class Boss {
    constructor(y, count) { this.y = y; this.count = count; this.max = count; }
    draw(ctx, dy) {
        let drawY = this.y + dy; ctx.fillStyle = '#5d3a1a'; ctx.fillRect(0, drawY, canvas.width, 260);
        ctx.fillStyle = '#c91a1a'; ctx.fillRect(canvas.width / 2 - 80, drawY + 40, 160, 220);
        ctx.fillStyle = '#ffd966'; ctx.beginPath(); ctx.arc(canvas.width / 2, drawY + 120, 50, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '900 36px Outfit'; ctx.fillText(Math.floor(this.count), canvas.width / 2, drawY - 40);
    }
    update(dt) { }
    checkCollision(hx, hy, dy, dt) {
        let drawY = this.y + dy;
        if (hy < drawY + 260 && hy > drawY) {
            let d = 300 * dt * comboMultiplier; this.count -= d;
            if (horde.dodgeFrames <= 0 && !activeShield) updateHordeCount(horde.count - d * 0.5);
            applyShake(10); if (this.count <= 0) victory(); else if (horde.count <= 0) gameOver();
        }
    }
}

class Coin {
    constructor(y, x) { this.y = y; this.x = x; this.collected = false; }
    draw(ctx, dy) { if (!this.collected) { let dY = this.y + dy; ctx.fillStyle = CONFIG.COR_SECUNDARIA; ctx.beginPath(); ctx.arc(this.x, dY, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } }
    checkCollision(hx, hy, dy) { if (!this.collected && Math.sqrt((hx - this.x) ** 2 + (hy - (this.y + dy)) ** 2) < 50) { this.collected = true; coins++; energy = Math.min(100, energy + 5); playPopSound(900); spawnParticles(this.x, this.y + dy, '#ffd966', 15, 'sparkle'); } }
}

// Main logic
function loadLevel(l) {
    level = l; txtLevelIndicator.innerText = `⚔️ NÍVEL ${level}`;
    entities = []; decorations = []; distanceTravelled = 0; gameTime = 0; gameSpeed = CONFIG.VELOCIDADE_BASE + l * 15;
    updateHordeCount(12 + l * 3); horde.x = canvas.width / 2; arrows = 5 + l;
    let cy = 0;
    for (let i = 0; i < 8; i++) {
        cy -= 600;
        entities.push(new Gate(cy, '+', 15 + l * 2, '*', 2));
        if (Math.random() > 0.4) entities.push(new EnemyGroup(cy + 300, 10 + l * 6, 100 + Math.random() * (canvas.width - 200), Math.random() > 0.7));
        entities.push(new Coin(cy + 450, 50 + Math.random() * (canvas.width - 100)));
    }
    bossLevelY = cy - 1000; entities.push(new Boss(bossLevelY, 250 + l * 200));
    for (let d = 0; d < 40; d++) decorations.push({ x: Math.random() > 0.5 ? 20 : canvas.width - 20, y: -d * 450, type: Math.random() > 0.5 ? 'lantern' : 'bamboo', color: Math.random() > 0.7 ? '#c91a1a' : '#ffd966', s: Math.random() * 10 });
    updateUI();
}

function update(dt) {
    if (gameState !== 'PLAYING') return;
    gameTime += dt; distanceTravelled += gameSpeed * currentSpeedMult * dt;
    energy = Math.min(100, energy + CONFIG.ENERGY_RECHARGE * dt);
    currentSpeedMult = 1.0;
    if (horde.dodgeFrames > 0) { horde.dodgeFrames -= dt; currentSpeedMult = 1.8; }
    if (activeShield) { shieldTimer -= dt; if (shieldTimer <= 0) { activeShield = false; document.getElementById('shield-badge')?.remove(); } }
    if (comboTimeout > 0) { comboTimeout -= dt; if (comboTimeout <= 0) { combo = 0; comboMultiplier = 1.0; } }
    for (let s in skillCooldowns) if (skillCooldowns[s] > 0) skillCooldowns[s] -= dt;
    for (let w in weaponTimers) if (weaponTimers[w] > 0) weaponTimers[w] -= dt;

    projectiles = projectiles.filter(p => {
        let done = p.update(dt);
        if (done && p instanceof EnemyProjectile) { p.onHit(); return false; }
        return !done;
    });

    // Auto-fire logic
    let target = entities.find(e => e instanceof EnemyGroup && e.units.length > 0 && Math.abs(e.y + distanceTravelled - horde.y) < CONFIG.WEAPON_STATS[currentWeapon].range);
    if (target && weaponTimers[currentWeapon] <= 0) {
        if (currentWeapon === 'bow' && arrows > 0) {
            projectiles.push(new Projectile(horde.x, horde.y, target.x, target.y + distanceTravelled, 'arrow'));
            arrows--; weaponTimers.bow = CONFIG.WEAPON_STATS.bow.fireRate;
            playPopSound(800, 'sine', 0.1, 0.02);
        } else if (currentWeapon === 'cannon') {
            projectiles.push(new Projectile(horde.x, horde.y, target.x, target.y + distanceTravelled, 'cannon'));
            weaponTimers.cannon = CONFIG.WEAPON_STATS.cannon.fireRate;
            playPopSound(100, 'square', 0.4, 0.08); applyShake(5);
        }
    }

    let rad = 35 + Math.sqrt(horde.count) * 2;
    horde.units.forEach(u => u.update(dt, rad));
    let tVX = (horde.targetX - horde.x) * 15; horde.vx += (tVX - horde.vx) * dt * 12; horde.x += horde.vx * dt;
    horde.tilt = (horde.vx * 0.0008);
    horde.displayCount += (horde.count - horde.displayCount) * dt * 8;
    entities.forEach(e => e.checkCollision(horde.x, horde.y, distanceTravelled, dt));
    entities.forEach(e => e.update?.(dt));
    uiProgressBar.style.width = `${Math.min(100, (distanceTravelled / Math.abs(bossLevelY)) * 100)}%`;
    if (horde.count <= 0) gameOver();
    updateUI();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height); grad.addColorStop(0, '#3d2a1a'); grad.addColorStop(1, '#1a0a0a'); ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Road
    ctx.fillStyle = 'rgba(200, 50, 50, 0.05)'; ctx.fillRect(canvas.width / 2 - 60, 0, 120, canvas.height);

    decorations.forEach(d => {
        let dy = d.y + distanceTravelled; if (dy < -200 || dy > canvas.height + 200) return;
        d.s += 0.05; ctx.save(); ctx.translate(d.x + Math.sin(d.s) * 8, dy);
        if (d.type === 'lantern') {
            ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd966'; ctx.beginPath(); ctx.arc(0, -24, 6, 0, Math.PI * 2); ctx.fill();
        } else { ctx.fillStyle = '#2d5a2d'; ctx.fillRect(-6, -40, 12, 80); ctx.fillStyle = '#3d7a3d'; ctx.fillRect(-8, -10, 16, 4); }
        ctx.restore();
    });

    projectiles.forEach(p => p.draw(ctx));
    entities.forEach(e => e.draw(ctx, distanceTravelled));

    if (gameState === 'PLAYING') {
        ctx.save(); ctx.translate(horde.x, horde.y); ctx.rotate(horde.tilt);
        if (horde.dodgeFrames > 0) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffd966'; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        if (activeShield) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 45 + Math.sqrt(horde.count) * 2.5, 0, Math.PI * 2); ctx.stroke(); }
        horde.units.forEach(u => {
            ctx.fillStyle = '#c91a1a'; ctx.beginPath(); ctx.arc(u.relX, u.relY + Math.sin(u.bob) * 4, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd966'; ctx.fillRect(u.relX - 1, u.relY - (currentWeapon === 'cannon' ? 12 : 10), 2, 6);
        });
        ctx.restore();
        ctx.fillStyle = (comboMultiplier > 1.5 ? '#ff4444' : '#ffd966'); ctx.font = 'bold 24px Outfit'; ctx.textAlign = 'center'; ctx.fillText('⚔️ ' + Math.floor(horde.displayCount), horde.x, horde.y - 55);
    }

    particles.forEach((p, i) => {
        p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
        else { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.type === 'cannon' ? p.life * 2 : 1), 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1.0;
}

function updateUI() {
    txtCoinCount.innerText = coins; txtEnergyCount.innerText = Math.floor(energy); txtArrowCount.innerText = arrows;
    for (let s in skillCooldowns) {
        let el = document.getElementById(`skill-${s}`);
        if (skillCooldowns[s] > 0) { el.classList.add('cooldown'); el.querySelector('.cooldown-overlay').innerText = Math.ceil(skillCooldowns[s]) + 's'; }
        else el.classList.remove('cooldown');
    }
}

function gameOver() { gameState = 'MENU'; uiGameOver.classList.add('active'); txtFinalLevel.innerText = level; txtFinalKills.innerText = totalKills; }
function victory() { gameState = 'MENU'; uiVictory.classList.add('active'); let rew = Math.floor(horde.count * (1 + level * 0.25)); coins += rew; txtLevelCoins.innerText = rew; }

function gameLoop(time) {
    if (!lastTime) lastTime = time;
    let dt = (time - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = time;
    update(dt); draw(); requestAnimationFrame(gameLoop);
}

btnStart.addEventListener('click', () => { initAudio(); uiMainMenu.classList.remove('active'); loadLevel(1); gameState = 'PLAYING'; });
btnRestart.addEventListener('click', () => { uiGameOver.classList.remove('active'); loadLevel(level); gameState = 'PLAYING'; });
btnNextLevel.addEventListener('click', () => { uiVictory.classList.remove('active'); loadLevel(level + 1); gameState = 'PLAYING'; });

requestAnimationFrame(gameLoop);
