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

const txtFinalLevel = document.getElementById('final-level');
const txtLevelCoins = document.getElementById('level-coins');
const endMessage = document.getElementById('end-message');
const endTitle = document.getElementById('end-title');

// Resize handling
function resize() {
    canvas.width = window.innerWidth > 500 ? 500 : window.innerWidth;
    canvas.height = window.innerHeight > 900 ? 900 : window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- CONFIGURAÇÕES DO JOGO ---
const CONFIG = {
    DIRECAO: 'CIMA',      // 'CIMA' para correr para cima, 'BAIXO' para correr para baixo
    VELOCIDADE_BASE: 220,  // Velocidade de avanço automática reduzida
    VELOCIDADE_INIMIGO: 50, // Velocidade com que os inimigos avançam contra o jogador
    SENSIBILIDADE: 2.8,    // Velocidade de movimento lateral aumentada para desvios rápidos
    DIFICULDADE: 1.0,      // Multiplicador de spawn de perigos
    COR_PRIMARIA: '#00f0ff', // Cor anime da horda e portões bons
    COR_SECUNDARIA: '#ffcc00', // Dourado para moedas e super aura
    ESTILO: 'SELVA'        // Estilo visual principal
};

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, VICTORY
let lastTime = 0;
let level = 1;
let coins = 0;
let distanceTravelled = 0;
let gameSpeed = CONFIG.VELOCIDADE_BASE;
let currentSpeedMult = 1.0;
let shakeAmount = 0;
let gameTime = 0;

function applyShake(amt) {
    shakeAmount = Math.max(shakeAmount, amt);
}

// Audio Context for "pops"
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playPopSound(freq = 400, type = 'sine') {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// Particle System
let particles = [];
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Floating UI Texts
function spawnFloatingText(x, y, text, type = 'positive') {
    const el = document.createElement('div');
    el.className = `floating-text ${type}`;
    el.innerText = text;

    // Anime Impact Text scaling
    if (text.includes('x') || text.includes('!!')) {
        el.style.fontSize = '3.5rem';
        el.style.letterSpacing = '5px';
    }

    const rect = canvas.getBoundingClientRect();
    const uiRect = uiLayer.getBoundingClientRect();
    const posX = x + (rect.left - uiRect.left);
    const posY = y + (rect.top - uiRect.top);

    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    uiLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// Player (Horde)
let horde = {
    x: canvas.width / 2,
    y: canvas.height * 0.8,
    count: 10,
    targetX: canvas.width / 2,
    baseRadius: 2,
    displayCount: 10,
    units: [], // Dynamic units array
    auraPulse: 0
};

class HordeUnit {
    constructor() {
        this.relX = (Math.random() - 0.5) * 20;
        this.relY = (Math.random() - 0.5) * 20;
        this.targetRelX = this.relX;
        this.targetRelY = this.relY;
        this.scale = 0; // Starts small for "pop-in" effect
        this.rotation = Math.random() * Math.PI * 2;
    }

    update(dt, radius) {
        // Animate scale up
        if (this.scale < 1) this.scale += dt * 4;
        if (this.scale > 1) this.scale = 1;

        // Swarm behavior: move towards a random spot within the horde radius
        let dist = Math.sqrt(this.relX * this.relX + this.relY * this.relY);
        if (dist > radius || Math.random() > 0.98) {
            let angle = Math.random() * Math.PI * 2;
            let range = Math.random() * radius;
            this.targetRelX = Math.cos(angle) * range;
            this.targetRelY = Math.sin(angle) * range;
        }

        this.relX += (this.targetRelX - this.relX) * 5 * dt;
        this.relY += (this.targetRelY - this.relY) * 5 * dt;
    }
}

function updateHordeCount(newCount) {
    const diff = Math.floor(newCount) - horde.units.length;

    if (diff > 0) {
        // Spawn new units
        for (let i = 0; i < diff; i++) {
            horde.units.push(new HordeUnit());
        }
    } else if (diff < 0) {
        // Remove units (from the end for simplicity)
        for (let i = 0; i < Math.abs(diff); i++) {
            if (horde.units.length > 1) {
                horde.units.pop();
            }
        }
    }
    horde.count = horde.units.length;
}

// Input
let isDragging = false;

function handleInteractionStart(x) {
    if (gameState !== 'PLAYING') return;
    isDragging = true;
    horde.targetX = x;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
}

function handleInteractionMove(x) {
    if (!isDragging || gameState !== 'PLAYING') return;
    horde.targetX = x;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
}

function handleInteractionEnd() {
    isDragging = false;
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
    const rect = canvas.getBoundingClientRect();
    handleInteractionStart(e.touches[0].clientX - rect.left);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleInteractionMove(e.touches[0].clientX - rect.left);
}, { passive: false });
window.addEventListener('touchend', handleInteractionEnd);

// World Objects
let entities = [];

class Gate {
    constructor(y, typeL, valL, typeR, valR, canMove = false) {
        this.y = y;
        this.typeL = typeL; // '+', '-', '*', '/'
        this.valL = valL;
        this.typeR = typeR;
        this.valR = valR;
        this.height = 80;
        this.width = canvas.width;
        this.passed = false;
        this.canMove = canMove;
        this.xOffset = 0;
        this.moveDir = 1;
        this.moveSpeed = 80;
    }

    update(dt) {
        if (this.canMove) {
            this.xOffset += this.moveDir * this.moveSpeed * dt;
            if (this.xOffset > 50 || this.xOffset < -50) this.moveDir *= -1;
        }
    }

    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 200 || drawY < -200) return;

        let midX = canvas.width / 2 + this.xOffset;

        ctx.globalAlpha = 0.5;
        // Left Gate
        let colorL = (this.typeL === '+' || this.typeL === '*') ? CONFIG.COR_PRIMARIA : '#ff3366';
        ctx.fillStyle = colorL;
        ctx.fillRect(0, drawY, midX, this.height);

        // Right Gate
        let colorR = (this.typeR === '+' || this.typeR === '*') ? CONFIG.COR_PRIMARIA : '#ff3366';
        ctx.fillStyle = colorR;
        ctx.fillRect(midX, drawY, canvas.width - midX, this.height);
        ctx.globalAlpha = 1.0;

        ctx.lineWidth = 4;
        ctx.strokeStyle = colorL;
        ctx.strokeRect(0, drawY, midX, this.height);
        ctx.strokeStyle = colorR;
        ctx.strokeRect(midX, drawY, canvas.width - midX, this.height);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';

        // Pulse effect for gate text
        let p = Math.sin(gameTime * 10) * 0.1 + 1.0;
        ctx.save();
        ctx.scale(p, p);
        ctx.fillText(`${this.typeL}${this.valL}`, (midX / 2) / p, (drawY + this.height / 2 + 8) / p);
        ctx.fillText(`${this.typeR}${this.valR}`, (midX + (canvas.width - midX) / 2) / p, (drawY + this.height / 2 + 8) / p);
        ctx.restore();
    }

    checkCollision(hx, hy, dy) {
        if (this.passed) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        let midX = canvas.width / 2 + this.xOffset;
        if (hy < drawY + this.height && hy > drawY) {
            this.passed = true;
            let onLeft = hx < midX;
            let type = onLeft ? this.typeL : this.typeR;
            let val = onLeft ? this.valL : this.valR;

            let oldAmt = horde.count;
            if (type === '+') updateHordeCount(horde.count + val);
            if (type === '-') updateHordeCount(Math.max(1, horde.count - val));
            if (type === '*') updateHordeCount(horde.count * val);
            if (type === '/') updateHordeCount(Math.max(1, Math.floor(horde.count / val)));

            let diff = horde.count - oldAmt;
            if (diff > 0) {
                let msg = `+${diff}`;
                if (type === '*') msg = `X${val}!!`;
                spawnFloatingText(hx, hy, msg, 'positive');
                playPopSound(600 + Math.random() * 200, 'square');
                spawnParticles(hx, hy, '#00f0ff', 25);
                applyShake(5);
            } else if (diff < 0) {
                spawnFloatingText(hx, hy, `${diff}`, 'negative');
                playPopSound(200, 'sawtooth');
                spawnParticles(hx, hy, '#ff3366', 10);
                applyShake(10);
            }
        }
    }
}

class EnemyUnit {
    constructor(isLeader = false) {
        this.relX = (Math.random() - 0.5) * 40;
        this.relY = (Math.random() - 0.5) * 40;
        this.isLeader = isLeader;
        this.scale = 1.0;
        this.speedBoost = (Math.random() > 0.7) ? Math.random() * 60 : 0; // Spearhead boost
        this.dead = false;
    }
}

class EnemyGroup {
    constructor(y, count, xOffset) {
        this.y = y; // World Y coordinate
        this.count = count;
        this.initialCount = count;
        this.x = xOffset;
        this.flashTimer = 0;
        this.dispersing = false;
        this.units = [];

        // Visual Hierarchy: Formation based on count
        let width = Math.min(canvas.width * 0.8, 40 + Math.sqrt(count) * 15);
        let depth = 40 + Math.sqrt(count) * 10;

        for (let i = 0; i < count; i++) {
            let u = new EnemyUnit(i === 0); // First unit is leader
            // Formation: Wall if high count, Column if low
            if (count > 100) { // WALL
                u.relX = (Math.random() - 0.5) * width;
                u.relY = (Math.random() - 0.5) * depth;
            } else { // COLUMN
                u.relX = (Math.random() - 0.5) * 40;
                u.relY = (Math.random() - 0.5) * (count * 5);
            }
            this.units.push(u);
        }
    }

    update(dt) {
        if (this.units.length === 0) return;

        // Swarm AI: Move towards player (Funneling) as they get closer
        let worldHordeY = (CONFIG.DIRECAO === 'CIMA' ? -distanceTravelled + horde.y : distanceTravelled + horde.y);
        let distY = Math.abs(this.y - worldHordeY);

        if (!this.dispersing && distY < 600) {
            // Funneling: attraction increases as distance closes
            let attraction = (1 - (distY / 600)) * 2;
            this.x += (horde.x - this.x) * attraction * dt;
        }

        // Basic advancement
        let move = CONFIG.VELOCIDADE_INIMIGO * dt;
        if (CONFIG.DIRECAO === 'CIMA') this.y += move;
        else this.y -= move;

        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Dispersal logic
        if (this.dispersing) {
            for (let u of this.units) {
                u.relX += (u.relX > 0 ? 300 : -300) * dt;
                u.relY += (CONFIG.DIRECAO === 'CIMA' ? -200 : 200) * dt;
            }
        }
    }

    draw(ctx, dy) {
        if (this.units.length === 0) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 400 || drawY < -400) return;

        ctx.save();
        if (this.flashTimer > 0) {
            ctx.filter = 'brightness(200%)';
        }

        for (let u of this.units) {
            let ux = this.x + u.relX;
            let uy = drawY + u.relY + (CONFIG.DIRECAO === 'CIMA' ? u.speedBoost * 0.1 : -u.speedBoost * 0.1);

            let size = u.isLeader ? 8 : 5;
            ctx.fillStyle = u.isLeader ? '#990022' : '#ff3366';

            ctx.beginPath();
            ctx.arc(ux, uy, size, 0, Math.PI * 2);
            ctx.fill();

            if (u.isLeader) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        ctx.restore();

        // Badge
        if (!this.dispersing) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(this.x - 20, drawY - 60, 40, 20, 5);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(this.units.length, this.x, drawY - 45);
        }
    }

    checkCollision(hx, hy, dy, dt) {
        if (this.units.length === 0 || this.dispersing) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);

        let dx = hx - this.x;
        let pdy = hy - drawY;
        let dist = Math.sqrt(dx * dx + pdy * pdy);
        let playerRad = Math.min(70, 25 + Math.sqrt(horde.count) * 2.5);

        if (dist < playerRad + 50) { // Close enough to start individual unit combat
            let combatThisFrame = Math.ceil(150 * dt); // Units to kill per second
            let kills = 0;

            for (let i = 0; i < combatThisFrame; i++) {
                if (this.units.length > 0 && horde.units.length > 0) {
                    let u = this.units.pop();

                    // If leader dies, disperse the rest
                    if (u.isLeader && this.units.length > 0) {
                        this.dispersing = true;
                        spawnFloatingText(this.x, drawY, "DEBANDADA!", "negative");
                    }

                    updateHordeCount(horde.count - 1);
                    kills++;

                    // Particles for 1:1 annihilation
                    spawnParticles(this.x + u.relX, drawY + u.relY, '#ff3366', 2);
                    spawnParticles(hx, hy, '#00f0ff', 2);
                }
            }

            if (kills > 0) {
                playPopSound(100 + Math.random() * 50, 'sawtooth');
                applyShake(2);
                if (kills > 10) {
                    this.flashTimer = 0.05;
                    applyShake(5);
                }
                // Visual Knockback (push player slightly back)
                if (CONFIG.DIRECAO === 'CIMA') distanceTravelled -= 50 * dt;
                else distanceTravelled += 50 * dt;
            }

            if (horde.count <= 0) gameOver();
        }
    }
}

class Boss {
    constructor(y, count) {
        this.y = y; // World Y coordinate
        this.count = count;
        this.height = 150;
    }

    draw(ctx, dy) {
        if (this.count <= 0) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 200 || drawY < -300) return;

        ctx.fillStyle = '#cc0033';
        ctx.fillRect(50, drawY, canvas.width - 100, this.height);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`FORTALEZA: ${Math.floor(this.count)}`, canvas.width / 2, drawY + this.height / 2 + 10);
    }

    checkCollision(hx, hy, dy, dt) {
        if (this.count <= 0) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        let playerRad = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);

        if (hy - playerRad < drawY + this.height && hy + playerRad > drawY) {
            let damage = 250 * dt;
            let drain = Math.min(this.count, damage);
            drain = Math.min(horde.count, drain);

            this.count -= drain;
            updateHordeCount(horde.count - drain);

            applyShake(5);
            spawnParticles(canvas.width / 2, drawY + this.height, '#ffcc00', 5);
            playPopSound(100, 'square');

            if (this.count <= 0) {
                victory();
            } else if (horde.count <= 0) {
                gameOver();
            }
        }
    }
}

class MudZone {
    constructor(y, length) {
        this.y = y; // World Y coordinate
        this.length = length;
    }
    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height || drawY + this.length < 0) return;
        ctx.fillStyle = 'rgba(101, 67, 33, 0.4)';
        ctx.fillRect(0, drawY, canvas.width, this.length);
        // Texture
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.arc((i * 77) % canvas.width, drawY + (i * 33) % this.length, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    checkCollision(hx, hy, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (hy > drawY && hy < drawY + this.length) {
            currentSpeedMult = 0.4;
        }
    }
}

class Obstacle {
    constructor(y, x, type = 'wall') {
        this.y = y; // World Y coordinate
        this.x = x;
        this.type = type;
        this.radius = 30;
        this.radius = 35;
        this.angle = 0;
    }
    update(dt) {
        if (this.type === 'saw') this.angle += 12 * dt;
    }
    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 100 || drawY < -100) return;
        ctx.save();
        ctx.translate(this.x, drawY);
        if (this.type === 'saw') {
            ctx.rotate(this.angle);
            // Anime style saw - vibrant outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 5;
            ctx.fillStyle = '#ff3366';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * 45, Math.sin(a) * 45);
                ctx.lineTo(Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Inner glow
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        } else {
            // Totem/Jungle Wall
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#000';
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-this.radius, -15, this.radius * 2, 30);
            ctx.strokeRect(-this.radius, -15, this.radius * 2, 30);
            // Patterns
            ctx.fillStyle = '#228B22';
            ctx.fillRect(-this.radius + 5, -10, 10, 20);
            ctx.fillRect(this.radius - 15, -10, 10, 20);
        }
        ctx.restore();
    }
    checkCollision(hx, hy, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        let dx = hx - this.x;
        let pdy = hy - drawY;
        let dist = Math.sqrt(dx * dx + pdy * pdy);
        let playerRad = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);
        if (dist < this.radius + playerRad) {
            updateHordeCount(Math.max(0, Math.floor(horde.count * 0.95) - 1));
            applyShake(15);
            playPopSound(100, 'sawtooth');
            spawnParticles(hx, hy, '#ff3366', 8);
        }
    }
}

// Level Gen
let bossLevelY = 0;
let decorations = [];
class Coin {
    constructor(y, x) {
        this.y = y;
        this.x = x;
        this.collected = false;
        this.rot = Math.random() * Math.PI;
    }
    update(dt) { this.rot += dt * 5; }
    draw(ctx, dy) {
        if (this.collected) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 50 || drawY < -50) return;
        ctx.save();
        ctx.translate(this.x, drawY);
        ctx.rotate(this.rot);
        ctx.fillStyle = CONFIG.COR_SECUNDARIA;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }
    checkCollision(hx, hy, dy) {
        if (this.collected) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        let dist = Math.sqrt((hx - this.x) ** 2 + (hy - drawY) ** 2);
        if (dist < 40) {
            this.collected = true;
            coins += 1;
            txtCoinCount.innerText = coins;
            playPopSound(800, 'sine');
            spawnParticles(this.x, drawY, CONFIG.COR_SECUNDARIA, 8);
        }
    }
}

function loadLevel(l) {
    level = l;
    txtLevelIndicator.innerText = `Nível ${level}`;
    entities = [];
    decorations = [];
    distanceTravelled = 0;
    currentSpeedMult = 1.0;
    gameSpeed = CONFIG.VELOCIDADE_BASE + (level * 10);

    // reset horde
    horde.units = [];
    updateHordeCount(10);
    horde.displayCount = 10;
    horde.x = canvas.width / 2;
    horde.targetX = canvas.width / 2;

    // Position player based on direction
    if (CONFIG.DIRECAO === 'CIMA') {
        horde.y = canvas.height * 0.85;
    } else {
        horde.y = canvas.height * 0.15;
    }

    let currentWorldY = 0;
    let numSections = 5 + Math.floor(level / 2);

    for (let i = 0; i < numSections; i++) {
        // Gates are ahead of the player
        if (CONFIG.DIRECAO === 'CIMA') {
            currentWorldY -= 600;
        } else {
            currentWorldY += 600;
        }

        // Add Gate
        let typeL = '+'; let valL = Math.floor(Math.random() * 10) + level * 2;
        let typeR = '*'; let valR = 2;
        if (level > 2 && Math.random() > 0.5) { typeL = '-'; typeR = '+'; }
        if (level > 4 && Math.random() > 0.3) { typeL = '/'; typeR = '*'; }
        if (Math.random() > 0.5) [typeL, valL, typeR, valR] = [typeR, valL, typeL, valR];

        entities.push(new Gate(currentWorldY, typeL, valL, typeR, valR, level > 5 && Math.random() > 0.4));

        let offset = (CONFIG.DIRECAO === 'CIMA') ? 300 : -300;

        // Add Obstacles or Enemies in between
        if (Math.random() > 0.5) {
            entities.push(new EnemyGroup(currentWorldY + offset, 5 + level * 4, 100 + Math.random() * (canvas.width - 200)));
        } else if (level > 2) {
            entities.push(new Obstacle(currentWorldY + offset, 100 + Math.random() * (canvas.width - 200), Math.random() > 0.5 ? 'saw' : 'wall'));
        }

        // Mud Zone
        if (level > 3 && Math.random() > 0.6) {
            entities.push(new MudZone(currentWorldY + (offset / 2), 300));
        }

        // Add Coins
        if (Math.random() > 0.3) {
            entities.push(new Coin(currentWorldY + (offset * 0.7), 50 + Math.random() * (canvas.width - 100)));
        }
    }

    // Decorate sides
    for (let d = 0; d < 30; d++) {
        decorations.push({
            x: Math.random() > 0.5 ? 40 : canvas.width - 40,
            y: (CONFIG.DIRECAO === 'CIMA' ? -d : d) * 400,
            size: 20 + Math.random() * 30,
            color: Math.random() > 0.5 ? '#228B22' : '#004d00',
            layer: Math.random() > 0.8 ? 'foreground' : 'background'
        });
    }

    let finalOffset = (CONFIG.DIRECAO === 'CIMA') ? -900 : 900;
    bossLevelY = currentWorldY + finalOffset;
    let bossAmt = 40 + level * 40;
    entities.push(new Boss(bossLevelY, bossAmt));
}

function gameOver() {
    gameState = 'GAMEOVER';
    txtFinalLevel.innerText = level;
    endMessage.innerText = "Sua horda foi dizimada.";
    endTitle.innerText = "Fim de Jogo!";
    uiGameOver.classList.add('active');
}

let confetti = [];
function shootConfetti() {
    confetti = [];
    for (let i = 0; i < 60; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height,
            vy: 2 + Math.random() * 5,
            vx: (Math.random() - 0.5) * 2,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            r: 4 + Math.random() * 4
        });
    }
}

function victory() {
    gameState = 'VICTORY';
    let reward = Math.floor(horde.count * (1 + level * 0.1));
    coins += reward;
    txtCoinCount.innerText = coins;
    txtLevelCoins.innerText = reward;
    uiVictory.classList.add('active');
    txtFinalLevel.innerText = level;
    txtLevelCoins.innerText = coins;
    shootConfetti();

    // Celebration particles
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            spawnParticles(canvas.width / 2, canvas.height / 2, '#ffcc00', 50);
            playPopSound(800, 'sine');
        }, i * 200);
    }
}

// Loop
function update(dt) {
    if (gameState !== 'PLAYING') return;

    gameTime += dt;
    distanceTravelled += gameSpeed * currentSpeedMult * dt;
    currentSpeedMult = 1.0;

    horde.auraPulse += dt * 5;

    if (gameState === 'VICTORY') {
        for (let c of confetti) {
            c.y += c.vy;
            c.x += c.vx;
            if (c.y > canvas.height) c.y = -20;
        }
    }

    // Update progress bar
    let totalD = Math.abs(bossLevelY);
    let progress = Math.min(100, Math.max(0, (distanceTravelled / totalD) * 100));
    uiProgressBar.style.width = `${progress}%`;

    // Update units animation
    let radius = Math.min(65, 25 + Math.sqrt(horde.count) * 2.5);
    for (let unit of horde.units) {
        unit.update(dt, radius);
    }

    // Shake decay
    if (shakeAmount > 0) shakeAmount -= dt * 20;
    else shakeAmount = 0;

    // Smooth movement X
    horde.x += (horde.targetX - horde.x) * 15 * dt; // Faster following

    // Smooth display count (Juiciness for UI)
    horde.displayCount += (horde.count - horde.displayCount) * 5 * dt;

    // EntCollisions and Updates
    for (let e of entities) {
        if (e.update) e.update(dt);
        e.checkCollision(horde.x, horde.y, distanceTravelled, dt);
    }

    // Win condition - reaching boss Y
    // Since bossLevelY is < horde.y, we check if distanceTravelled + bossLevelY is near horde.y
    if (CONFIG.DIRECAO === 'CIMA') {
        if (distanceTravelled + bossLevelY > horde.y + 200 && gameState === 'PLAYING') {
            // Fallback if boss not hit somehow
            // victory();
        }
    } else { // BAJXO
        if (distanceTravelled + bossLevelY < horde.y - 200 && gameState === 'PLAYING') {
            // Fallback if boss not hit somehow
            // victory();
        }
    }
}

function drawHorde() {
    if (horde.units.length === 0) return;

    let radius = Math.min(65, 25 + Math.sqrt(horde.count) * 2.5);

    // Squash and Stretch Logic
    let velX = (horde.targetX - horde.x) * 0.01;
    let stretch = Math.min(0.3, Math.abs(velX));
    let sW = 1 + stretch;
    let sH = 1 - stretch;

    ctx.save();
    ctx.translate(horde.x, horde.y);
    ctx.scale(sW, sH);

    // Motion Trail
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = CONFIG.COR_PRIMARIA;
    let trailOffset = (CONFIG.DIRECAO === 'CIMA') ? 15 : -15;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, (i * trailOffset * currentSpeedMult), radius * (1 - i * 0.2), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Anime Glow / Aura
    ctx.shadowBlur = 30 + Math.sin(horde.auraPulse) * 10;
    ctx.shadowColor = CONFIG.COR_PRIMARIA;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.fillStyle = CONFIG.COR_PRIMARIA;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Super Aura (Limit Break)
    if (horde.count > 100) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = CONFIG.COR_SECUNDARIA;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (1.2 + Math.sin(horde.auraPulse * 2) * 0.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw each dynamic unit
    for (let unit of horde.units) {
        ctx.save();
        ctx.translate(unit.relX, unit.relY);
        ctx.scale(unit.scale, unit.scale); // Pop-in effect

        ctx.fillStyle = '#e0ffff';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Anime Eyes
        ctx.fillStyle = '#000';
        let lookDir = (horde.targetX - horde.x) * 0.1;
        ctx.fillRect(-2 + lookDir, -2, 2, 4);
        ctx.fillRect(1 + lookDir, -2, 2, 4);
        ctx.restore();
    }
    ctx.restore();

    // Count Badge
    ctx.fillStyle = '#000';
    ctx.strokeStyle = CONFIG.COR_PRIMARIA;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(horde.x - 30, horde.y - radius - 55, 60, 28, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = '900 20px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(horde.count), horde.x, horde.y - radius - 41);
}

function drawSpeedlines() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    let speed = (CONFIG.DIRECAO === 'CIMA') ? 1000 : -1000;
    for (let i = 0; i < 15; i++) {
        let x = (i * 77 + gameTime * speed) % canvas.width;
        if (x < 0) x += canvas.width;
        let len = 50 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, len);
        ctx.stroke();

        let x2 = (i * 123 - gameTime * speed * 0.8) % canvas.width;
        if (x2 < 0) x2 += canvas.width;
        ctx.beginPath();
        ctx.moveTo(x2, canvas.height);
        ctx.lineTo(x2, canvas.height - len);
        ctx.stroke();
    }
}

function drawGrid(dy) {
    // Jungle Background
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#002b00');
    grad.addColorStop(1, '#004d00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // God Rays (Anime Sunlight)
    ctx.fillStyle = 'rgba(255, 255, 200, 0.05)';
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(canvas.width / 2, -100);
        ctx.rotate(0.2 + Math.sin(gameTime * 0.5 + i) * 0.1);
        ctx.fillRect(-20, 0, 40, canvas.height * 1.5);
        ctx.restore();
    }

    // Subtle leaf pattern instead of grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    let dirSign = (CONFIG.DIRECAO === 'CIMA') ? 1 : -1;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 10; j++) {
            let px = (i * 100);
            let py = (j * 150 + (dy * dirSign % 150));
            ctx.beginPath(); ctx.ellipse(px, py, 20, 10, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Parallax Jungle Decorations (Leaves/Plants)
    for (let dec of decorations) {
        if (dec.layer === 'foreground') continue;
        drawLeaf(ctx, dec, dy * dirSign);
    }
}

function drawLeaf(ctx, dec, dy) {
    let drawY = dec.y + dy;
    // Basic Looping for decorations
    if (CONFIG.DIRECAO === 'CIMA') {
        if (drawY > canvas.height + 200) dec.y -= 10000;
    } else {
        if (drawY < -200) dec.y += 10000;
    }

    if (drawY < -300 || drawY > canvas.height + 300) return;

    ctx.fillStyle = dec.color;
    ctx.beginPath();
    ctx.moveTo(dec.x, drawY);
    ctx.bezierCurveTo(dec.x + dec.size, drawY - dec.size, dec.x + dec.size, drawY + dec.size, dec.x, drawY + dec.size);
    ctx.bezierCurveTo(dec.x - dec.size, drawY + dec.size, dec.x - dec.size, drawY - dec.size, dec.x, drawY);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();
}

function drawForeground(dy) {
    let dirSign = (CONFIG.DIRECAO === 'CIMA') ? 1 : -1;
    for (let dec of decorations) {
        if (dec.layer !== 'foreground') continue;
        drawLeaf(ctx, dec, dy * dirSign * 1.5); // Faster parallax for foreground
    }
}

function draw(dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shakeAmount > 0) {
        ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
    }

    drawGrid(distanceTravelled);
    drawSpeedlines();

    // Draw Entities
    for (let e of entities) {
        e.draw(ctx, distanceTravelled);
    }

    if (gameState === 'PLAYING') drawHorde();

    drawForeground(distanceTravelled);

    if (gameState === 'VICTORY') {
        for (let c of confetti) {
            ctx.fillStyle = c.color;
            ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.restore();
}

function gameLoop(time) {
    if (!lastTime) lastTime = time;
    let dt = (time - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap delta
    lastTime = time;

    update(dt);
    draw(dt);

    requestAnimationFrame(gameLoop);
}

// Events
btnStart.addEventListener('click', () => {
    initAudio();
    uiMainMenu.classList.remove('active');
    loadLevel(1);
    gameState = 'PLAYING';
});

btnRestart.addEventListener('click', () => {
    initAudio();
    uiGameOver.classList.remove('active');
    loadLevel(level);
    gameState = 'PLAYING';
});

btnNextLevel.addEventListener('click', () => {
    initAudio();
    uiVictory.classList.remove('active');
    loadLevel(level + 1);
    gameState = 'PLAYING';
});

requestAnimationFrame(gameLoop);
