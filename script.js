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

// --- CONFIGURAÇÕES DO JOGO (TEMA CHINÊS) ---
const CONFIG = {
    DIRECAO: 'CIMA',
    VELOCIDADE_BASE: 220,
    VELOCIDADE_INIMIGO: 50,
    SENSIBILIDADE: 2.8,
    DIFICULDADE: 1.0,
    COR_PRIMARIA: '#c91a1a', // Vermelho Imperial Chinês
    COR_SECUNDARIA: '#ffd966', // Amarelo Dourado
    ESTILO: 'CHINES_CASTLE'
};

// Game State
let gameState = 'MENU';
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
    units: [],
    auraPulse: 0,
    vx: 0,
    tilt: 0,
    bounce: 1.0
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
    }

    update(dt, radius) {
        if (this.scale < 1) this.scale += dt * 5;
        this.bob += dt * 15;

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
    horde.count = Math.floor(newCount);
    if (horde.count < 0) horde.count = 0;

    const VISUAL_LIMIT = 200;
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
        this.typeL = typeL;
        this.valL = valL;
        this.typeR = typeR;
        this.valR = valR;
        this.height = 100;
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

        // Estilo de portão chinês (Pagode)
        ctx.save();

        // Left Gate - Pagode Vermelho
        let colorL = (this.typeL === '+' || this.typeL === '*') ? '#c91a1a' : '#8b4513';

        // Base do portão
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(0, drawY, midX, this.height);

        // Telhado estilo chinês
        ctx.fillStyle = '#c91a1a';
        ctx.beginPath();
        ctx.moveTo(0, drawY);
        ctx.lineTo(midX / 2, drawY - 25);
        ctx.lineTo(midX, drawY);
        ctx.fill();

        // Decoração dourada
        ctx.fillStyle = '#ffd966';
        ctx.font = 'bold 20px "Noto Serif SC"';
        ctx.fillText('战', midX / 4, drawY + this.height / 2);

        // Right Gate
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(midX, drawY, canvas.width - midX, this.height);

        ctx.fillStyle = '#c91a1a';
        ctx.beginPath();
        ctx.moveTo(midX, drawY);
        ctx.lineTo(midX + (canvas.width - midX) / 2, drawY - 25);
        ctx.lineTo(canvas.width, drawY);
        ctx.fill();

        ctx.fillStyle = '#ffd966';
        ctx.fillText('争', midX + (canvas.width - midX) / 2, drawY + this.height / 2);

        // Lanternas
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(midX / 2, drawY - 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd966';
        ctx.beginPath();
        ctx.arc(midX + (canvas.width - midX) / 2, drawY - 15, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffd966';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';

        let p = Math.sin(gameTime * 10) * 0.1 + 1.0;
        ctx.save();
        ctx.scale(p, p);
        ctx.fillText(`${this.typeL}${this.valL}`, (midX / 2) / p, (drawY + this.height / 2 + 8) / p);
        ctx.fillText(`${this.typeR}${this.valR}`, (midX + (canvas.width - midX) / 2) / p, (drawY + this.height / 2 + 8) / p);
        ctx.restore();
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
                spawnParticles(hx, hy, '#ffd966', 25);
                applyShake(5);
                horde.bounce = 1.3;
            } else if (diff < 0) {
                spawnFloatingText(hx, hy, `${diff}`, 'negative');
                playPopSound(200, 'sawtooth');
                spawnParticles(hx, hy, '#c91a1a', 10);
                applyShake(10);
                horde.bounce = 0.8;
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
        this.speedBoost = (Math.random() > 0.7) ? Math.random() * 60 : 0;
        this.dead = false;
    }
}

class EnemyGroup {
    constructor(y, count, xOffset) {
        this.y = y;
        this.count = count;
        this.initialCount = count;
        this.x = xOffset;
        this.flashTimer = 0;
        this.dispersing = false;
        this.units = [];

        let width = Math.min(canvas.width * 0.8, 40 + Math.sqrt(count) * 15);
        let depth = 40 + Math.sqrt(count) * 10;

        for (let i = 0; i < count; i++) {
            let u = new EnemyUnit(i === 0);
            if (count > 100) {
                u.relX = (Math.random() - 0.5) * width;
                u.relY = (Math.random() - 0.5) * depth;
            } else {
                u.relX = (Math.random() - 0.5) * 40;
                u.relY = (Math.random() - 0.5) * (count * 5);
            }
            this.units.push(u);
        }
    }

    update(dt) {
        if (this.units.length === 0) return;

        let worldHordeY = (CONFIG.DIRECAO === 'CIMA' ? -distanceTravelled + horde.y : distanceTravelled + horde.y);
        let distY = Math.abs(this.y - worldHordeY);

        if (!this.dispersing && distY < 600) {
            let attraction = (1 - (distY / 600)) * 2;
            this.x += (horde.x - this.x) * attraction * dt;
        }

        let move = CONFIG.VELOCIDADE_INIMIGO * dt;
        if (CONFIG.DIRECAO === 'CIMA') this.y += move;
        else this.y -= move;

        if (this.flashTimer > 0) this.flashTimer -= dt;

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
        if (this.flashTimer > 0 && ctx.filter) {
            ctx.filter = 'brightness(200%)';
        }

        for (let u of this.units) {
            let ux = this.x + u.relX;
            let uy = drawY + u.relY + (CONFIG.DIRECAO === 'CIMA' ? u.speedBoost * 0.1 : -u.speedBoost * 0.1);

            let size = u.isLeader ? 10 : 7;

            // Estilo de guerreiro mongol/chinês
            ctx.fillStyle = u.isLeader ? '#c91a1a' : '#8b4513';

            // Corpo
            ctx.beginPath();
            ctx.arc(ux, uy, size, 0, Math.PI * 2);
            ctx.fill();

            // Capacete
            ctx.fillStyle = '#5d3a1a';
            ctx.beginPath();
            ctx.ellipse(ux, uy - size / 2, size / 1.5, size / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Lança
            ctx.strokeStyle = '#b87c4b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ux + size, uy - size);
            ctx.lineTo(ux + size + 15, uy - size - 15);
            ctx.stroke();

            if (u.isLeader) {
                ctx.strokeStyle = '#ffd966';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Bandeira
                ctx.fillStyle = '#c91a1a';
                ctx.fillRect(ux + 20, uy - 40, 15, 25);
                ctx.fillStyle = '#ffd966';
                ctx.font = '12px "Noto Serif SC"';
                ctx.fillText('将', ux + 22, uy - 25);
            }
        }
        ctx.restore();

        if (!this.dispersing) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.rect(this.x - 20, drawY - 60, 40, 20);
            ctx.fill();
            ctx.fillStyle = '#ffd966';
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

        if (dist < playerRad + 50) {
            let combatThisFrame = Math.ceil(150 * dt);
            let kills = 0;

            for (let i = 0; i < combatThisFrame; i++) {
                if (this.units.length > 0 && horde.count > 0) {
                    let u = this.units.pop();

                    if (u.isLeader && this.units.length > 0) {
                        this.dispersing = true;
                        spawnFloatingText(this.x, drawY, "退却!", "negative");
                    }

                    updateHordeCount(horde.count - 1);
                    kills++;

                    spawnParticles(this.x + u.relX, drawY + u.relY, '#8b4513', 2);
                    spawnParticles(hx, hy, CONFIG.COR_PRIMARIA, 2);
                }
            }

            if (kills > 0) {
                playPopSound(100 + Math.random() * 50, 'sawtooth');
                applyShake(2);
                if (kills > 10) {
                    this.flashTimer = 0.05;
                    applyShake(5);
                }
                if (CONFIG.DIRECAO === 'CIMA') distanceTravelled -= 50 * dt;
                else distanceTravelled += 50 * dt;
            }

            if (horde.count <= 0) gameOver();
        }
    }
}

class Boss {
    constructor(y, count) {
        this.y = y;
        this.count = count;
        this.height = 200;
    }

    draw(ctx, dy) {
        if (this.count <= 0) return;
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height + 200 || drawY < -400) return;

        ctx.save();

        // Muralha da Cidade Proibida
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(0, drawY, canvas.width, this.height);

        // Ameias da muralha
        ctx.fillStyle = '#b87c4b';
        for (let i = 0; i < 12; i++) {
            ctx.fillRect(i * (canvas.width / 12), drawY - 40, canvas.width / 24, 40);
        }

        // Portão principal
        ctx.fillStyle = '#c91a1a';
        ctx.fillRect(canvas.width / 2 - 50, drawY + 20, 100, this.height - 20);

        // Torres laterais
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(20, drawY - 80, 60, 120);
        ctx.fillRect(canvas.width - 80, drawY - 80, 60, 120);

        // Bandeiras imperiais
        ctx.fillStyle = '#c91a1a';
        ctx.fillRect(canvas.width / 2 - 20, drawY - 100, 10, 60);
        ctx.fillRect(canvas.width / 2 + 10, drawY - 100, 10, 60);
        ctx.fillStyle = '#ffd966';
        ctx.font = '30px "Noto Serif SC"';
        ctx.fillText('皇', canvas.width / 2 - 15, drawY - 40);
        ctx.fillText('帝', canvas.width / 2 + 15, drawY - 40);

        // Dragão dourado
        ctx.fillStyle = '#ffd966';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, drawY + this.height / 2, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c91a1a';
        ctx.font = 'bold 20px "Noto Serif SC"';
        ctx.fillText('龍', canvas.width / 2 - 10, drawY + this.height / 2 + 7);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(this.count)}`, canvas.width / 2, drawY + this.height / 2 + 50);

        ctx.restore();
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
            spawnParticles(canvas.width / 2, drawY + this.height, '#ffd966', 5);
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
        this.y = y;
        this.length = length;
    }
    draw(ctx, dy) {
        let drawY = (CONFIG.DIRECAO === 'CIMA') ? (this.y + dy) : (this.y - dy);
        if (drawY > canvas.height || drawY + this.length < 0) return;
        ctx.fillStyle = 'rgba(101, 67, 33, 0.6)';
        ctx.fillRect(0, drawY, canvas.width, this.length);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
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
        this.y = y;
        this.x = x;
        this.type = type;
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
            ctx.strokeStyle = '#c91a1a';
            ctx.lineWidth = 5;
            ctx.fillStyle = '#b87c4b';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * 45, Math.sin(a) * 45);
                ctx.lineTo(Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffd966';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        } else {
            // Estátua de guerreiro de terracota
            ctx.fillStyle = '#b87c4b';
            ctx.fillRect(-20, -40, 40, 80);
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(0, -50, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(-5, -60, 10, 5);
            ctx.fillStyle = '#ffd966';
            ctx.beginPath();
            ctx.arc(0, -30, 5, 0, Math.PI * 2);
            ctx.fill();
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
            spawnParticles(hx, hy, '#b87c4b', 8);
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
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Símbolo chinês para dinheiro
        ctx.fillStyle = '#c91a1a';
        ctx.font = 'bold 16px "Noto Serif SC"';
        ctx.fillText('钱', -8, 6);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
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
    txtLevelIndicator.innerText = `🏯 Nível ${level}`;
    entities = [];
    decorations = [];
    distanceTravelled = 0;
    currentSpeedMult = 1.0;
    gameSpeed = CONFIG.VELOCIDADE_BASE + (level * 10);

    horde.units = [];
    updateHordeCount(10);
    horde.displayCount = 10;
    horde.x = canvas.width / 2;
    horde.targetX = canvas.width / 2;

    if (CONFIG.DIRECAO === 'CIMA') {
        horde.y = canvas.height * 0.85;
    } else {
        horde.y = canvas.height * 0.15;
    }

    let currentWorldY = 0;
    let numSections = 5 + Math.floor(level / 2);

    for (let i = 0; i < numSections; i++) {
        if (CONFIG.DIRECAO === 'CIMA') {
            currentWorldY -= 600;
        } else {
            currentWorldY += 600;
        }

        let typeL = '+'; let valL = Math.floor(Math.random() * 10) + level * 2;
        let typeR = '*'; let valR = 2;
        if (level > 2 && Math.random() > 0.5) { typeL = '-'; typeR = '+'; }
        if (level > 4 && Math.random() > 0.3) { typeL = '/'; typeR = '*'; }
        if (Math.random() > 0.5) [typeL, valL, typeR, valR] = [typeR, valL, typeL, valR];

        entities.push(new Gate(currentWorldY, typeL, valL, typeR, valR, level > 5 && Math.random() > 0.4));

        let offset = (CONFIG.DIRECAO === 'CIMA') ? 300 : -300;

        if (Math.random() > 0.5) {
            entities.push(new EnemyGroup(currentWorldY + offset, 5 + level * 4, 100 + Math.random() * (canvas.width - 200)));
        } else if (level > 2) {
            entities.push(new Obstacle(currentWorldY + offset, 100 + Math.random() * (canvas.width - 200), Math.random() > 0.5 ? 'saw' : 'wall'));
        }

        if (level > 3 && Math.random() > 0.6) {
            entities.push(new MudZone(currentWorldY + (offset / 2), 300));
        }

        if (Math.random() > 0.3) {
            entities.push(new Coin(currentWorldY + (offset * 0.7), 50 + Math.random() * (canvas.width - 100)));
        }
    }

    // Decorações de jardim chinês
    for (let d = 0; d < 40; d++) {
        decorations.push({
            x: Math.random() > 0.5 ? 20 : canvas.width - 20,
            y: (CONFIG.DIRECAO === 'CIMA' ? -d : d) * 300,
            size: 15 + Math.random() * 25,
            color: Math.random() > 0.6 ? '#c91a1a' : '#ffd966',
            type: Math.random() > 0.5 ? 'lantern' : 'bamboo',
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
    endMessage.innerText = "O Império foi derrotado...";
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
            color: `hsl(${Math.random() * 60 + 20}, 100%, 50%)`, // Tons de vermelho/dourado
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
    shootConfetti();

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            spawnParticles(canvas.width / 2, canvas.height / 2, '#ffd966', 50);
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

    let totalD = Math.abs(bossLevelY);
    let progress = Math.min(100, Math.max(0, (distanceTravelled / totalD) * 100));
    uiProgressBar.style.width = `${progress}%`;

    let radius = Math.min(65, 25 + Math.sqrt(horde.count) * 2.5);
    for (let unit of horde.units) {
        unit.update(dt, radius);
    }

    if (shakeAmount > 0) shakeAmount -= dt * 20;
    else shakeAmount = 0;

    let targetVX = (horde.targetX - horde.x) * 15;
    horde.vx += (targetVX - horde.vx) * 12 * dt;
    horde.x += horde.vx * dt;

    let targetTilt = (horde.vx * 0.0005);
    horde.tilt += (targetTilt - horde.tilt) * 10 * dt;

    horde.bounce += (1.0 - horde.bounce) * 8 * dt;

    horde.displayCount += (horde.count - horde.displayCount) * 5 * dt;

    for (let e of entities) {
        if (e.update) e.update(dt);
        e.checkCollision(horde.x, horde.y, distanceTravelled, dt);
    }
}

function drawHorde() {
    if (horde.units.length === 0) return;

    let radius = Math.min(65, 25 + Math.sqrt(horde.count) * 2.5);

    let inDanger = false;
    for (let e of entities) {
        if (e instanceof EnemyGroup && Math.abs(e.y - (-distanceTravelled + horde.y)) < 400) {
            inDanger = true; break;
        }
    }

    let velX = (horde.targetX - horde.x) * 0.01;
    let stretch = Math.min(0.3, Math.abs(velX));
    let sW = 1 + stretch;
    let sH = 1 - stretch;

    ctx.save();
    ctx.translate(horde.x, horde.y);
    ctx.rotate(horde.tilt);
    ctx.scale(horde.bounce, horde.bounce);
    ctx.scale(sW, sH);

    if (Math.abs(horde.targetX - horde.x) > 50) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < Math.min(10, horde.units.length); i++) {
            let u = horde.units[i];
            ctx.beginPath();
            ctx.moveTo(u.relX, u.relY);
            ctx.lineTo(u.relX, u.relY + 30);
            ctx.stroke();
        }
    }

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (horde.count > 100) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#ffd966';
        ctx.beginPath();
        ctx.arc(0, 0, radius * (1.3 + Math.sin(horde.auraPulse * 1.5) * 0.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    for (let unit of horde.units) {
        ctx.save();
        let bobY = Math.sin(unit.bob) * 3;
        ctx.translate(unit.relX, unit.relY + bobY);
        ctx.scale(unit.scale, unit.scale);

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 8 - bobY, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corpo do guerreiro imperial
        ctx.fillStyle = '#b87c4b'; // Terracota
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // Armadura
        ctx.strokeStyle = '#c91a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -2, 4, 0, Math.PI);
        ctx.stroke();

        // Capacete
        ctx.fillStyle = '#c91a1a';
        ctx.beginPath();
        ctx.arc(0, -5, 5, Math.PI, 0);
        ctx.fill();

        // Pena/Pluma
        ctx.fillStyle = '#ffd966';
        ctx.fillRect(-1, -10, 2, 5);

        // Olhos
        ctx.fillStyle = '#000';
        let lookDir = (horde.targetX - horde.x) * 0.08;
        if (inDanger) {
            ctx.beginPath();
            ctx.moveTo(-3 + lookDir, -2); ctx.lineTo(-1 + lookDir, 0);
            ctx.moveTo(1 + lookDir, 0); ctx.lineTo(3 + lookDir, -2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        } else {
            ctx.fillRect(-3 + lookDir, -2, 2, 4);
            ctx.fillRect(1 + lookDir, -2, 2, 4);
        }
        ctx.restore();
    }
    ctx.restore();

    // Badge do exército
    ctx.fillStyle = '#2d0a0a';
    ctx.strokeStyle = '#ffd966';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(horde.x - 35, horde.y - radius - 55, 70, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd966';
    ctx.font = '900 20px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('军 ' + Math.floor(horde.count), horde.x, horde.y - radius - 40);
}

function drawSpeedlines() {
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.1)';
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
    // Chão de terra da Muralha
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#8b5a2b');
    grad.addColorStop(0.5, '#5d3a1a');
    grad.addColorStop(1, '#3d2a0f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Padrão de tijolos da Muralha
    ctx.strokeStyle = '#b87c4b';
    ctx.lineWidth = 2;
    let dirSign = (CONFIG.DIRECAO === 'CIMA') ? 1 : -1;
    for (let y = 0; y < canvas.height; y += 40) {
        let offset = (Math.floor((y + dy * dirSign) / 40) % 2) * 20;
        for (let x = offset; x < canvas.width; x += 80) {
            ctx.strokeRect(x, y, 60, 35);
            if (Math.random() > 0.7) {
                ctx.fillStyle = 'rgba(200, 100, 50, 0.15)';
                ctx.font = '20px "Noto Serif SC"';
                ctx.fillText('砖', x + 20, y + 25);
            }
        }
    }

    // Estrada central (caminho do dragão)
    ctx.fillStyle = 'rgba(200, 50, 50, 0.1)';
    ctx.fillRect(canvas.width / 2 - 40, 0, 80, canvas.height);

    // Pegadas de dragão
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    for (let i = 0; i < 5; i++) {
        let y = (i * 200 + dy * dirSign * 2) % canvas.height;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, y, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    // Raios de sol orientais
    ctx.fillStyle = 'rgba(255, 200, 100, 0.03)';
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(canvas.width / 2, -100);
        ctx.rotate(0.3 + Math.sin(gameTime * 0.5 + i) * 0.1);
        ctx.fillRect(-30, 0, 60, canvas.height * 1.5);
        ctx.restore();
    }

    // Decorações de bambu/árvores
    for (let dec of decorations) {
        if (dec.layer === 'foreground') continue;
        drawDecoration(ctx, dec, dy * dirSign);
    }
}

function drawDecoration(ctx, dec, dy) {
    let drawY = dec.y + dy;
    if (CONFIG.DIRECAO === 'CIMA') {
        if (drawY > canvas.height + 200) dec.y -= 12000;
    } else {
        if (drawY < -200) dec.y += 12000;
    }

    if (drawY < -300 || drawY > canvas.height + 300) return;

    if (dec.type === 'lantern') {
        // Lanterna chinesa
        ctx.fillStyle = dec.color;
        ctx.beginPath();
        ctx.ellipse(dec.x, drawY, 15, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd966';
        ctx.beginPath();
        ctx.arc(dec.x, drawY - 15, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = '16px "Noto Serif SC"';
        ctx.fillText('福', dec.x - 8, drawY + 5);
    } else {
        // Bambu
        ctx.fillStyle = '#2d5a2d';
        ctx.fillRect(dec.x - 5, drawY - 40, 10, 80);
        ctx.fillStyle = '#3d7a3d';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(dec.x, drawY - 40 + i * 20, 12, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawForeground(dy) {
    let dirSign = (CONFIG.DIRECAO === 'CIMA') ? 1 : -1;
    for (let dec of decorations) {
        if (dec.layer !== 'foreground') continue;
        drawDecoration(ctx, dec, dy * dirSign * 1.5);
    }
}

function draw(dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    let camX = (Math.random() - 0.5) * shakeAmount;
    let camY = (Math.random() - 0.5) * shakeAmount;
    ctx.translate(camX, camY);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-horde.tilt * 0.2);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    drawGrid(distanceTravelled);
    drawSpeedlines();

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
    if (dt > 0.1) dt = 0.1;
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
