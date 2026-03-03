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

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, VICTORY
let lastTime = 0;
let level = 1;
let coins = 0;
let distanceTravelled = 0;
let gameSpeed = 300; // pixels per second moving forward
let currentSpeedMult = 1.0;
let shakeAmount = 0;

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

    // Convert canvas coords to viewport pixels relative to uiLayer
    const rect = canvas.getBoundingClientRect();
    const uiRect = uiLayer.getBoundingClientRect();

    const posX = x + (rect.left - uiRect.left);
    const posY = y + (rect.top - uiRect.top);

    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    uiLayer.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 1000);
}

// Player (Horde)
let horde = {
    x: canvas.width / 2,
    y: canvas.height * 0.8,
    count: 10,
    targetX: canvas.width / 2,
    baseRadius: 2,
    displayCount: 10
};

// Input
let isDragging = false;
let startX = 0;
let hordeStartX = 0;

canvas.addEventListener('touchstart', (e) => {
    if (gameState !== 'PLAYING') return;
    isDragging = true;
    startX = e.touches[0].clientX;
    hordeStartX = horde.targetX;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || gameState !== 'PLAYING') return;
    let dx = e.touches[0].clientX - startX;
    horde.targetX = hordeStartX + dx;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
}, { passive: false });

canvas.addEventListener('touchend', () => isDragging = false);

canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'PLAYING') return;
    isDragging = true;
    startX = e.clientX;
    hordeStartX = horde.targetX;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || gameState !== 'PLAYING') return;
    let dx = e.clientX - startX;
    horde.targetX = hordeStartX + dx;
    horde.targetX = Math.max(30, Math.min(canvas.width - 30, horde.targetX));
});

canvas.addEventListener('mouseup', () => isDragging = false);

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
        let drawY = this.y + dy; // Direction inverted: dy is negative as we go up
        if (drawY > canvas.height + 100 || drawY < -100) return;

        let midX = canvas.width / 2 + this.xOffset;

        ctx.globalAlpha = 0.5;
        // Left Gate
        let colorL = (this.typeL === '+' || this.typeL === '*') ? '#00f0ff' : '#ff3366';
        ctx.fillStyle = colorL;
        ctx.fillRect(0, drawY, midX, this.height);

        // Right Gate
        let colorR = (this.typeR === '+' || this.typeR === '*') ? '#00f0ff' : '#ff3366';
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
        ctx.fillText(`${this.typeL}${this.valL}`, midX / 2, drawY + this.height / 2 + 8);
        ctx.fillText(`${this.typeR}${this.valR}`, midX + (canvas.width - midX) / 2, drawY + this.height / 2 + 8);
    }

    checkCollision(hx, hy, dy) {
        if (this.passed) return;
        let drawY = this.y + dy;
        let midX = canvas.width / 2 + this.xOffset;
        if (hy < drawY + this.height && hy > drawY) {
            this.passed = true;
            let onLeft = hx < midX;
            let type = onLeft ? this.typeL : this.typeR;
            let val = onLeft ? this.valL : this.valR;

            let oldAmt = horde.count;
            if (type === '+') horde.count += val;
            if (type === '-') horde.count = Math.max(1, horde.count - val);
            if (type === '*') horde.count *= val;
            if (type === '/') horde.count = Math.max(1, Math.floor(horde.count / val));

            let diff = horde.count - oldAmt;
            if (diff > 0) {
                spawnFloatingText(hx, hy, `+${diff}`, 'positive');
                playPopSound(600, 'square');
                spawnParticles(hx, hy, '#00f0ff', 20);
            } else if (diff < 0) {
                spawnFloatingText(hx, hy, `${diff}`, 'negative');
                playPopSound(200, 'sawtooth');
            }
        }
    }
}

class EnemyGroup {
    constructor(y, count, xOffset) {
        this.y = y;
        this.count = count;
        this.initialCount = count;
        this.x = xOffset;
        this.radius = Math.min(60, 20 + Math.sqrt(count) * 2);
    }

    draw(ctx, dy) {
        if (this.count <= 0) return;
        let drawY = this.y + dy;
        if (drawY > canvas.height + 100 || drawY < -100) return;

        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(this.x, drawY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.count), this.x, drawY + 8);
    }

    checkCollision(hx, hy, dy, dt) {
        if (this.count <= 0) return;
        let drawY = this.y + dy;
        let dx = hx - this.x;
        let pdy = hy - drawY;
        let dist = Math.sqrt(dx * dx + pdy * pdy);

        let playerRad = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);
        if (dist < this.radius + playerRad) {
            // Combat frame (anulação 1:1, depends on dt to make it feel continuous)
            let damage = 50 * dt; // Drain rate per second
            if (damage < 1) damage = 1; // Minimum drain

            let drain = Math.min(this.count, damage);
            drain = Math.min(horde.count, drain);

            this.count -= drain;
            horde.count -= drain;
            horde.displayCount = horde.count; // Snap for combat
            spawnParticles(hx + (Math.random() - 0.5) * 20, hy - 20, '#ff3366', 2);
            playPopSound(150 + Math.random() * 50, 'sawtooth');

            if (horde.count <= 0) {
                gameOver();
            }
        }
    }
}

class Boss {
    constructor(y, count) {
        this.y = y;
        this.count = count;
        this.height = 150;
    }

    draw(ctx, dy) {
        if (this.count <= 0) return;
        let drawY = this.y + dy;
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
        let drawY = this.y + dy;
        let playerRad = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);

        if (hy - playerRad < drawY + this.height && hy + playerRad > drawY) {
            let damage = 250 * dt;
            let drain = Math.min(this.count, damage);
            drain = Math.min(horde.count, drain);

            this.count -= drain;
            horde.count -= drain;
            horde.displayCount = horde.count;

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
        this.y = y;
        this.length = length;
    }
    draw(ctx, dy) {
        let drawY = this.y + dy;
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
        let drawY = this.y + dy;
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
        this.radius = 30;
        this.angle = 0;
    }
    update(dt) {
        if (this.type === 'saw') this.angle += 10 * dt;
    }
    draw(ctx, dy) {
        let drawY = this.y + dy;
        if (drawY > canvas.height + 50 || drawY < -50) return;
        ctx.save();
        ctx.translate(this.x, drawY);
        if (this.type === 'saw') {
            ctx.rotate(this.angle);
            ctx.fillStyle = '#666';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                let a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
                ctx.lineTo(Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30);
            }
            ctx.fill();
            ctx.fillStyle = '#999';
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#444';
            ctx.fillRect(-this.radius, -10, this.radius * 2, 20);
            ctx.strokeStyle = '#ff3366';
            ctx.strokeRect(-this.radius, -10, this.radius * 2, 20);
        }
        ctx.restore();
    }
    checkCollision(hx, hy, dy) {
        let drawY = this.y + dy;
        let dx = hx - this.x;
        let pdy = hy - drawY;
        let dist = Math.sqrt(dx * dx + pdy * pdy);
        let playerRad = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);
        if (dist < this.radius + playerRad) {
            horde.count = Math.max(1, horde.count - 1);
            applyShake(10);
            playPopSound(100, 'sawtooth');
            spawnParticles(hx, hy, '#ff3366', 5);
        }
    }
}

// Level Gen
let bossLevelY = 0;
let decorations = [];
function loadLevel(l) {
    level = l;
    txtLevelIndicator.innerText = `Nível ${level}`;
    entities = [];
    decorations = [];
    distanceTravelled = 0;
    currentSpeedMult = 1.0;

    // reset horde
    horde.count = 10;
    horde.displayCount = 10;
    horde.x = canvas.width / 2;
    horde.targetX = canvas.width / 2;
    horde.y = canvas.height * 0.85;

    let currentY = horde.y - 400; // Start placing obstacles above player
    let numSections = 5 + Math.floor(level / 2);

    for (let i = 0; i < numSections; i++) {
        currentY -= 600; // Moving UP in coordinate space

        // Add Gate
        let typeL = '+'; let valL = Math.floor(Math.random() * 10) + level * 2;
        let typeR = '*'; let valR = 2;
        if (level > 2 && Math.random() > 0.5) { typeL = '-'; typeR = '+'; }
        if (level > 5 && Math.random() > 0.3) { typeL = '/'; typeR = '*'; }
        if (Math.random() > 0.5) [typeL, valL, typeR, valR] = [typeR, valR, typeL, valL];

        entities.push(new Gate(currentY, typeL, valL, typeR, valR, level > 5 && Math.random() > 0.4));

        // Add Obstacles or Enemies
        if (Math.random() > 0.5) {
            entities.push(new EnemyGroup(currentY - 300, 5 + level * 4, 100 + Math.random() * (canvas.width - 200)));
        } else if (level > 3) {
            entities.push(new Obstacle(currentY - 300, 100 + Math.random() * (canvas.width - 200), Math.random() > 0.5 ? 'saw' : 'wall'));
        }

        // Mud Zone
        if (level > 4 && Math.random() > 0.7) {
            entities.push(new MudZone(currentY - 450, 300));
        }
    }

    // Decorate sides
    for (let d = 0; d < 20; d++) {
        decorations.push({
            x: Math.random() > 0.5 ? 20 : canvas.width - 20,
            y: d * 500,
            size: 20 + Math.random() * 30,
            color: 'rgba(255,255,255,0.1)'
        });
    }

    currentY -= 800;
    bossLevelY = currentY;
    let bossAmt = 30 + level * 30;
    entities.push(new Boss(currentY, bossAmt));
}

function gameOver() {
    gameState = 'GAMEOVER';
    txtFinalLevel.innerText = level;
    endMessage.innerText = "Sua horda foi dizimada.";
    endTitle.innerText = "Fim de Jogo!";
    uiGameOver.classList.add('active');
}

function victory() {
    gameState = 'VICTORY';
    let reward = Math.floor(horde.count * (1 + level * 0.1));
    coins += reward;
    txtCoinCount.innerText = coins;
    txtLevelCoins.innerText = reward;
    uiVictory.classList.add('active');

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

    distanceTravelled -= gameSpeed * currentSpeedMult * dt; // Negative: going UP
    currentSpeedMult = 1.0;

    // Shake decay
    if (shakeAmount > 0) shakeAmount -= dt * 20;
    else shakeAmount = 0;

    // Smooth movement X
    horde.x += (horde.targetX - horde.x) * 10 * dt;

    // Smooth display count (Juiciness for UI)
    horde.displayCount += (horde.count - horde.displayCount) * 5 * dt;

    // EntCollisions and Updates
    for (let e of entities) {
        if (e.update) e.update(dt);
        e.checkCollision(horde.x, horde.y, distanceTravelled, dt);
    }

    // Win condition - reaching boss Y
    // Since bossLevelY is < horde.y, we check if distanceTravelled + bossLevelY is near horde.y
    if (distanceTravelled + bossLevelY > horde.y + 200 && gameState === 'PLAYING') {
        // Fallback if boss not hit somehow
        // victory(); 
    }
}

function drawHorde() {
    if (horde.displayCount <= 0.5) return;

    // Draw a big circle representing the group
    let radius = Math.min(60, 20 + Math.sqrt(horde.displayCount) * 2);

    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#005aff';
    ctx.beginPath();
    ctx.arc(horde.x, horde.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Details (dots inside)
    ctx.fillStyle = '#00f0ff';
    let maxDots = Math.min(50, Math.floor(horde.displayCount));
    for (let i = 0; i < maxDots; i++) {
        let angle = i * 2.4; // golden ratio spiral
        let rad = Math.sqrt(i) * (radius / Math.sqrt(maxDots)) * 0.8;
        let dx = Math.cos(angle) * rad;
        let dy = Math.sin(angle) * rad;
        ctx.beginPath();
        ctx.arc(horde.x + dx, horde.y + dy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Number text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(horde.displayCount), horde.x, horde.y - radius - 15);
}

function drawGrid(dy) {
    // Scrolling background gradient
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    let gridS = 50;
    let offset = dy % gridS;
    for (let y = offset; y < canvas.height; y += gridS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    for (let x = 0; x < canvas.width; x += gridS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Draw decorations (Parallax effect)
    for (let dec of decorations) {
        let drawY = (dec.y + dy) % (decorations.length * 500);
        if (drawY < -500) drawY += decorations.length * 500;
        ctx.fillStyle = dec.color;
        ctx.beginPath();
        ctx.arc(dec.x, drawY, dec.size / 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function draw(dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shakeAmount > 0) {
        ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
    }

    drawGrid(distanceTravelled);

    // Draw Entities
    for (let e of entities) {
        e.draw(ctx, distanceTravelled);
    }

    if (gameState === 'PLAYING') drawHorde();

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
