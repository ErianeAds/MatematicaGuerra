const canvas = document.getElementById('game-canvas'), ctx = canvas.getContext('2d'), ui = document.getElementById('ui-layer');
const el = id => document.getElementById(id);
const screens = { menu: el('main-menu'), over: el('game-over-screen'), victory: el('victory-screen') };
const txt = { level: el('level-indicator'), coins: el('coin-count'), energy: el('energy-count'), arrows: el('arrow-count'), kills: el('final-kills'), finalLevel: el('final-level'), reward: el('level-coins') };

function resize() { canvas.width = Math.min(window.innerWidth, 500); canvas.height = Math.min(window.innerHeight, 900); }
window.addEventListener('resize', resize); resize();

const CFG = {
    speed: 250,
    eSpeed: 70,
    eReg: 6,
    weapons: {
        spear: { r: 80, fr: 0.2, dmg: 5, area: 0 },
        bow: { r: 350, fr: 0.5, dmg: 4, area: 0 },
        cannon: { r: 250, fr: 1.2, dmg: 15, area: 60 }
    }
};

let state = 'MENU', lastTime = 0, level = 1, coins = 0, energy = 100, arrows = 5, totalKills = 0, dist = 0, gSpeed = CFG.speed, shake = 0, time = 0, combo = 1, comboT = 0, sShield = 0, entities = [], particles = [], projectiles = [], decors = [];
let h = { x: 250, y: 750, count: 10, targetX: 250, dCount: 10, units: [], vx: 0, tilt: 0, dodge: 0, weapon: 'spear', wTimers: { spear: 0, bow: 0, cannon: 0 }, cooldowns: { arrow: 0, shield: 0, fire: 0, heal: 0 }, firePower: 1 };

let audioCtx;
const playSnd = (f, t = 'sine', d = 0.1, v = 0.05) => {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch (e) { }
};

const spawnP = (x, y, color, n, type) => { for (let i = 0; i < n; i++) { let a = Math.random() * Math.PI * 2, s = Math.random() * 200 + 50; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, color, s: Math.random() * 5 + 2, t: type }); } };
const floating = (x, y, str, cls) => { const d = document.createElement('div'); d.className = `floating-text ${cls}`; d.innerText = str; const r = canvas.getBoundingClientRect(); d.style.left = `${x + r.left}px`; d.style.top = `${y + r.top}px`; ui.appendChild(d); setTimeout(() => d.remove(), 1000); };

function updateHorde(n) {
    let old = h.count;
    h.count = Math.max(0, Math.floor(n));
    const target = Math.min(h.count, 100);
    while (h.units.length < target) h.units.push({ rx: 0, ry: 0, tx: 0, ty: 0, b: Math.random() * Math.PI * 2, s: 0 });
    while (h.units.length > target) h.units.pop();
    if (n > old) { combo++; comboT = 3; } else if (n < old) combo = 1;
}

const input = x => { if (state === 'PLAYING') { h.targetX = Math.max(40, Math.min(canvas.width - 40, x)); if (Math.abs(x - h.x) > 100 && h.dodge <= 0) h.dodge = 0.4; } };
canvas.addEventListener('mousemove', e => input(e.clientX - canvas.getBoundingClientRect().left));
canvas.addEventListener('touchmove', e => { e.preventDefault(); input(e.touches[0].clientX - canvas.getBoundingClientRect().left); }, { passive: false });

const useSkill = (id, cost, cd, fn) => { if (energy < cost || h.cooldowns[id] > 0) return; energy -= cost; h.cooldowns[id] = cd; fn(); updateUI(); };

el('skill-arrow').onclick = () => useSkill('arrow', 5, 3, () => { arrows += 10; floating(h.x, h.y, '+10 🏹', 'positive'); playSnd(800); });
el('skill-shield').onclick = () => useSkill('shield', 15, 12, () => { sShield = 5; let b = document.createElement('div'); b.className = 'effect-badge'; b.id = 'sb'; b.innerText = '🛡️ ESCUDO'; el('active-effects').appendChild(b); playSnd(400, 'square'); });
el('skill-fire').onclick = () => useSkill('fire', 20, 15, () => {
    let k = 0;
    entities.forEach(e => {
        if (e.type === 'enemy' && e.y + dist > 0 && e.y + dist < canvas.height) {
            let n = Math.min(e.u.length, 20);
            for (let i = 0; i < n; i++) e.u.pop();
            k += n;
            e.f = 0.3;
        }
    });
    totalKills += k;
    floating(250, 450, `🔥 ${k} ABATIDOS`, 'positive');
    playSnd(150, 'sawtooth', 0.5, 0.1);
    shake = 15;
});
el('skill-heal').onclick = () => useSkill('heal', 10, 8, () => {
    let n = Math.floor(h.count * 0.3) + 5;
    updateHorde(h.count + n);
    floating(h.x, h.y, `+${n} 💊`, 'positive');
    spawnP(h.x, h.y, '#0ff88', 20);
    playSnd(1000);
});

document.querySelectorAll('.weapon').forEach(w => w.onclick = () => {
    h.weapon = w.dataset.weapon;
    document.querySelectorAll('.weapon').forEach(x => x.classList.remove('active'));
    w.classList.add('active');
    playSnd(500);
});

const drawMan = (x, y, headCol, bodyCol, plumeCol, size = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    ctx.fillStyle = bodyCol; ctx.fillRect(-3, 0, 6, 8); // Corpo
    ctx.fillStyle = headCol; ctx.beginPath(); ctx.arc(0, -2, 4, 0, 7); ctx.fill(); // Cabeça
    if (plumeCol) { ctx.fillStyle = plumeCol; ctx.fillRect(-1, -7, 2, 4); } // Pluma
    ctx.restore();
}

const drawHouse = (x, y, side) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-15, -30, 30, 30);
    ctx.fillStyle = '#c91a1a';
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(0, -50); ctx.lineTo(20, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd966';
    ctx.fillRect(side === 'left' ? -10 : 5, -20, 8, 8);
    ctx.restore();
};

class Entity {
    constructor(t, x, y, val) {
        this.type = t; this.x = x; this.y = y; this.v = val; this.dead = false; this.u = []; this.f = 0;
    }

    draw(dy) {
        let Y = this.y + dy;
        if (Y < -200 || Y > canvas.height + 200) return;
        ctx.save(); ctx.translate(this.x, Y);

        if (this.type === 'gate') {
            ctx.fillStyle = '#5d3a1a'; ctx.fillRect(-60, 0, 120, 80);
            ctx.fillStyle = '#8b4513'; ctx.fillRect(-40, 10, 20, 60); ctx.fillRect(20, 10, 20, 60);
            ctx.fillStyle = '#ffd966'; ctx.font = 'bold 20px Outfit'; ctx.textAlign = 'center';
            ctx.fillText('🚪 REINO', 0, -20);
            ctx.fillText(`${this.v[0]}${this.v[1]}${this.v[2]}`, 0, 50);
        } else if (this.type === 'enemy') {
            if (this.f > 0) ctx.filter = 'brightness(200%)';
            this.u.forEach(u => drawMan(u.x, u.y, u.l ? '#c91a1a' : '#8b4513', u.l ? '#5d3a1a' : '#3d2a1a', null, u.l ? 1.2 : 1));
        } else if (this.type === 'boss') {
            ctx.fillStyle = '#5d3a1a'; ctx.fillRect(-100, 0, 200, 200);
            ctx.fillStyle = '#c91a1a'; ctx.fillRect(-50, 20, 100, 160);
            ctx.fillStyle = 'white'; ctx.fillText(Math.floor(this.v), 0, -20);
        } else if (this.type === 'coin') {
            ctx.fillStyle = '#ffd966'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
        } else if (this.type === 'barrel') {
            ctx.fillStyle = '#8b4513'; ctx.fillRect(-15, -20, 30, 30);
            ctx.fillStyle = '#ffd966'; ctx.font = 'bold 16px Outfit'; ctx.fillText('💣', 0, 0);
        }
        ctx.restore();
    }
}

function loadLevel(l) {
    level = l; state = 'PLAYING'; entities = []; decors = []; dist = 0; gSpeed = CFG.speed + l * 15; updateHorde(15 + l * 2);
    h.firePower = 1;
    let gateY = -1200;
    entities.push(new Entity('gate', 250, gateY, ['+', 10 + l, '-', 2]));
    for (let i = 0; i < 3; i++) entities.push(new Entity('barrel', 100 + Math.random() * 300, gateY - 200 - i * 400, { dmg: 5 }));
    for (let i = 0; i < 5 + l * 2; i++) {
        let e = new Entity('enemy', 150 + Math.random() * 200, gateY - 200 - i * 300);
        for (let j = 0; j < 8 + l * 3; j++) e.u.push({ x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50, l: j === 0 });
        entities.push(e);
    }
    entities.push(new Entity('boss', 250, gateY - 1600, 300 + l * 200));
    for (let i = 0; i < 5; i++) entities.push(new Entity('coin', 50 + Math.random() * 400, gateY - 400 - i * 300));
    for (let i = 0; i < 20; i++) {
        decors.push({ x: 40, y: -i * 300, type: 'house', side: 'left' });
        decors.push({ x: 460, y: -i * 300, type: 'house', side: 'right' });
    }
    for (let i = 0; i < 30; i++) decors.push({ x: Math.random() > 0.5 ? 15 : 485, y: -i * 400, type: Math.random() > 0.5 ? 'lantern' : 'bamboo', s: Math.random() * 6 });
}

function gameLoop(t) {
    let dt = (t - lastTime) / 1000; if (dt > 0.1) dt = 0.1; lastTime = t;
    if (state === 'PLAYING') {
        time += dt; dist += gSpeed * (h.dodge > 0 ? 1.8 : 1) * dt; energy = Math.min(100, energy + CFG.eReg * dt);
        if (sShield > 0) { sShield -= dt; if (sShield <= 0) el('sb')?.remove(); }
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 1; }
        for (let s in h.cooldowns) h.cooldowns[s] = Math.max(0, h.cooldowns[s] - dt);
        for (let w in h.wTimers) h.wTimers[w] = Math.max(0, h.wTimers[w] - dt);
        if (h.dodge > 0) h.dodge -= dt;

        h.vx += ((h.targetX - h.x) * 15 - h.vx) * dt * 10; h.x += h.vx * dt; h.tilt = h.vx * 0.0006; h.dCount += (h.count - h.dCount) * dt * 6;
        let rad = 30 + Math.sqrt(h.count) * 2; h.units.forEach(u => {
            u.b += dt * 12; u.s = Math.min(1, u.s + dt * 4);
            let d = Math.sqrt(u.rx * u.rx + u.ry * u.ry); if (d > rad || Math.random() > 0.98) { let a = Math.random() * Math.PI * 2, r = Math.random() * rad; u.tx = Math.cos(a) * r; u.ty = Math.sin(a) * r; }
            u.rx += (u.tx - u.rx) * 6 * dt; u.ry += (u.ty - u.ry) * 6 * dt;
        });

        projectiles = projectiles.filter(p => {
            p.p += (p.type === 'arrow' ? 12 : 5) * dt; let T = Math.min(1, p.p);
            p.x = p.sx + (p.tx - p.sx) * T; p.y = p.sy + (p.ty - p.sy) * T - Math.sin(T * Math.PI) * 50;
            if (p.p >= 1) {
                if (p.type === 'cannon') {
                    shake = 10; spawnP(p.x, p.y, '#ff4444', 20, 'cannon');
                    entities.forEach(e => {
                        if (e.type === 'enemy') {
                            let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - (e.y + dist)) ** 2); if (d < 110) {
                                let dmg = Math.floor(15 * h.firePower); let k = Math.min(e.u.length, dmg); for (let j = 0; j < k; j++) e.u.pop(); totalKills += k; e.f = 0.2;
                            }
                        }
                        if (e.type === 'barrel') {
                            let d = Math.sqrt((p.x - e.x) ** 2 + (p.y - (e.y + dist)) ** 2);
                            if (d < 100) { h.firePower += 0.5; floating(e.x, e.y + dist, '🔥 PODER +50%', 'positive'); spawnP(e.x, e.y + dist, '#ffaa00', 30, 'explosion'); e.dead = true; playSnd(200, 'sawtooth', 0.3); }
                        }
                    });
                } return false;
            } return true;
        });

        entities = entities.filter(e => !e.dead);
        entities.forEach(e => {
            let Y = e.y + dist;
            if (e.type === 'gate' && h.y > Y && h.y < Y + 80) {
                let onL = h.x < canvas.width / 2, op = onL ? e.v[0] : e.v[2], val = onL ? e.v[1] : e.v[3], n = h.count;
                if (op === '+') n += val; else if (op === '-') n -= val; else if (op === '*') n *= val; else n = Math.max(1, Math.floor(n / val));
                updateHorde(n); e.dead = true; playSnd(op === '+' ? 600 : 300);
            }
            if (e.type === 'enemy') {
                if (e.u.length === 0) { e.dead = true; return; }
                let d = Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2);
                if (d < 100) { let dmg = Math.ceil(150 * dt * (h.count / 50 + 1) * (combo / 10 + 1) * h.firePower); for (let i = 0; i < dmg && e.u.length > 0; i++) { e.u.pop(); if (h.dodge <= 0) updateHorde(h.count - 1); } if (h.count <= 0) fail(); }
                projectiles.forEach(p => { if (p.type === 'arrow' && Math.sqrt((p.x - e.x) ** 2 + (p.y - Y) ** 2) < 60) { e.u.pop(); totalKills++; p.p = 1; e.f = 0.2; } });
                if (Math.abs(Y - h.y) < 500) e.x += (h.x - e.x) * dt * 1.5; e.y += CFG.eSpeed * dt; if (e.f > 0) e.f -= dt;
            }
            if (e.type === 'boss') { if (h.y < Y + 200 && h.y > Y) { let d = 300 * dt * (combo / 10 + 1) * h.firePower; e.v -= d; if (h.dodge <= 0 && sShield <= 0) updateHorde(h.count - d * 0.4); if (e.v <= 0) win(); } }
            if (e.type === 'coin' && Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2) < 50) { coins++; energy = Math.min(100, energy + 5); playSnd(900); e.dead = true; }
            if (e.type === 'barrel' && Math.sqrt((h.x - e.x) ** 2 + (h.y - Y) ** 2) < 50) { h.firePower += 0.3; floating(h.x, h.y, '🔥 PODER +30%', 'positive'); spawnP(e.x, Y, '#ffaa00', 20, 'collect'); e.dead = true; playSnd(400); }
        });

        let target = entities.find(e => e.type === 'enemy' && Math.abs(e.y + dist - h.y) < CFG.weapons[h.weapon].r && e.u.length > 0);
        if (target && h.wTimers[h.weapon] <= 0) {
            if (h.weapon === 'bow' && arrows > 0) { projectiles.push({ sx: h.x, sy: h.y, x: h.x, y: h.y, tx: target.x, ty: target.y + dist, p: 0, type: 'arrow', dmg: 4 * h.firePower }); arrows--; h.wTimers.bow = 0.5; }
            else if (h.weapon === 'cannon') { projectiles.push({ sx: h.x, sy: h.y, x: h.x, y: h.y, tx: target.x, ty: target.y + dist, p: 0, type: 'cannon', dmg: 15 * h.firePower }); h.wTimers.cannon = 1.2; }
        }
        updateUI(); if (shake > 0) shake -= dt * 40;
    }

    ctx.clearRect(0, 0, 500, 900); ctx.save(); ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(0, 0, 500, 900); ctx.fillStyle = '#a8753a'; ctx.fillRect(150, 0, 200, 900);
    ctx.strokeStyle = '#6b4a1a'; ctx.lineWidth = 5; ctx.setLineDash([30, 50]); ctx.beginPath(); ctx.moveTo(180, 0); ctx.lineTo(180, 900); ctx.stroke(); ctx.beginPath(); ctx.moveTo(320, 0); ctx.lineTo(320, 900); ctx.stroke(); ctx.setLineDash([]);

    decors.forEach(d => {
        let dy = d.y + dist; if (dy > -100 && dy < 1000) {
            if (d.type === 'house') drawHouse(d.x, dy, d.side); else { d.s += 0.05; ctx.fillStyle = d.type === 'lantern' ? '#ffaa00' : '#2d5a2d'; ctx.beginPath(); ctx.arc(d.x + Math.sin(d.s) * 8, dy, 15, 0, 7); ctx.fill(); }
        }
    });

    entities.forEach(e => e.draw(dist)); projectiles.forEach(p => { ctx.fillStyle = p.type === 'arrow' ? '#ffd966' : '#000'; ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'arrow' ? 4 : 10, 0, 7); ctx.fill(); });

    if (state === 'PLAYING') {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.tilt);
        if (sShield > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.stroke(); }
        h.units.forEach(u => drawMan(u.rx, u.ry + Math.sin(u.b) * 3, '#c91a1a', '#5d3a1a', '#ffd966'));
        ctx.restore(); ctx.fillStyle = '#ffd966'; ctx.font = 'bold 24px Outfit'; ctx.textAlign = 'center'; ctx.fillText('⚔️ ' + Math.floor(h.dCount), h.x, h.y - 50);
        ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 14px Outfit'; ctx.fillText('🔥 x' + h.firePower.toFixed(1), h.x, h.y - 80);
    }

    particles.forEach((p, i) => { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 2; if (p.l <= 0) particles.splice(i, 1); else { ctx.globalAlpha = p.l; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); } });
    ctx.restore(); requestAnimationFrame(gameLoop);
}

function updateUI() { txt.level.innerText = `⚔️ NÍVEL ${level}`; txt.coins.innerText = coins; txt.energy.innerText = Math.floor(energy); txt.arrows.innerText = arrows; Object.keys(h.cooldowns).forEach(s => { let e = document.getElementById(`skill-${s}`); if (h.cooldowns[s] > 0) { e.classList.add('cooldown'); e.querySelector('.cooldown-overlay').innerText = Math.ceil(h.cooldowns[s]) + 's'; } else e.classList.remove('cooldown'); }); }
function fail() { state = 'MENU'; screens.over.classList.add('active'); txt.kills.innerText = totalKills; txt.finalLevel.innerText = level; }
function win() { state = 'MENU'; screens.victory.classList.add('active'); let r = Math.floor(h.count * (1 + level * .2) * h.firePower); coins += r; txt.reward.innerText = r; }

el('start-btn').onclick = () => { screens.menu.classList.remove('active'); loadLevel(1); };
el('restart-btn').onclick = () => { screens.over.classList.remove('active'); loadLevel(level); };
el('next-level-btn').onclick = () => { screens.victory.classList.remove('active'); loadLevel(level + 1); };
requestAnimationFrame(gameLoop);
