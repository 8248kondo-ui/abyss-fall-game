// =============================================
// ABYSS FALL - メインゲームロジック
// =============================================

// --- ゲーム状態管理 ---
const GameState = {
    mode: 'NORMAL', level: 1, xp: 0, xpToNext: 100, luck: 0,
    currentStage: 1, hp: 100, maxHp: 100, attack: 10,
    moveSpeed: 200, items: [], shieldCount: 0,
    reviveAvailable: false, fullReviveAvailable: false,
    collection: JSON.parse(localStorage.getItem('abyssCollection') || '[]'),

    reset(full) {
        if (full) { this.level = 1; this.xp = 0; this.xpToNext = 100; this.luck = 0; }
        this.currentStage = 1; this.hp = 100; this.maxHp = 100;
        this.attack = 10; this.moveSpeed = 200; this.items = [];
        this.shieldCount = 0; this.reviveAvailable = false; this.fullReviveAvailable = false;
    },
    getDifficulty() {
        if (this.currentStage <= 5) return 0;
        if (this.currentStage <= 10) return 1;
        if (this.currentStage <= 15) return 2;
        return 3;
    },
    getDifficultyLabel() { return DIFFICULTY_LEVELS[this.getDifficulty()]; },
    addXP(amount) {
        let mult = 1;
        this.items.forEach(i => { if (i.effect === 'xpBoost') mult += i.value; if (i.effect === 'soulCollect') mult *= i.value; });
        this.xp += Math.floor(amount * mult);
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext; this.level++;
            this.luck = Math.floor(this.level * 0.5);
            this.xpToNext = Math.floor(100 * Math.pow(1.15, this.level - 1));
        }
    },
    getAtk() {
        let a = this.attack;
        this.items.forEach(i => {
            if (i.effect === 'atkUp') a += i.value;
            if (i.effect === 'flameDmg') a += i.value;
            if (i.effect === 'toughness') a -= 3;
            if (i.effect === 'allStats') a = Math.floor(a * (1 + i.value));
        });
        this.items.forEach(i => { if (i.effect === 'atkMult') a = Math.floor(a * i.value); });
        if (this.hasEffect('berserker') && this.hp <= this.maxHp * 0.5) a *= 2;
        return Math.max(a, 1);
    },
    getSpd() {
        let s = this.moveSpeed;
        this.items.forEach(i => {
            if (i.effect === 'spdUp') s *= (1 + i.value);
            if (i.effect === 'windWalk') s *= 1.2;
            if (i.effect === 'allStats') s *= (1 + i.value);
        });
        return Math.floor(s);
    },
    getFallMod() {
        let m = this.mode === 'HARD' ? 1.4 : 1.0;
        this.items.forEach(i => {
            if (i.effect === 'fallSlow') m *= (1 - i.value);
            if (i.effect === 'antiGravity') m *= (1 - i.value);
            if (i.effect === 'windWalk') m *= (1 - i.value);
        });
        return Math.max(m, 0.3);
    },
    hasEffect(e) { return this.items.some(i => i.effect === e); },
    getEffectVal(e) { let t = 0; this.items.forEach(i => { if (i.effect === e) t += i.value; }); return t; },
    applyMaxHp() {
        let base = 100;
        this.items.forEach(i => {
            if (i.effect === 'maxHpUp') base += i.value;
            if (i.effect === 'toughness') base += i.value;
            if (i.effect === 'allStats') base = Math.floor(base * (1 + i.value));
        });
        this.maxHp = base; this.hp = Math.min(this.hp, this.maxHp);
    },
    takeDamage(dmg) {
        if (this.shieldCount > 0) { this.shieldCount--; return 0; }
        if (this.hasEffect('damageReduce')) dmg = Math.floor(dmg * (1 - this.getEffectVal('damageReduce')));
        if (this.hasEffect('reflect') && Math.random() < this.getEffectVal('reflect')) return -dmg;
        this.hp = Math.max(0, this.hp - dmg); return dmg;
    },
    addItem(item) {
        this.items.push(item);
        this.addToCollection(item.id);
        if (item.effect === 'heal') { this.hp = Math.min(this.maxHp, this.hp + item.value); }
        if (item.effect === 'shield') { this.shieldCount += item.value; }
        if (item.effect === 'revive') { this.reviveAvailable = true; }
        if (item.effect === 'fullRevive') { this.fullReviveAvailable = true; }
        this.applyMaxHp();
    },
    addToCollection(id) {
        if (!this.collection.includes(id)) {
            this.collection.push(id);
            localStorage.setItem('abyssCollection', JSON.stringify(this.collection));
        }
    },
    rollItems(count) {
        let luckBonus = this.luck + this.getEffectVal('rarityUp') * 10 + this.getEffectVal('luckUp');
        const result = [];
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        for (let i = 0; i < count; i++) {
            let weights = rarities.map(r => {
                let w = RARITY_CONFIG[r].weight;
                if (r !== 'common') w += luckBonus * 0.5;
                return Math.max(w, 1);
            });
            let total = weights.reduce((a, b) => a + b, 0);
            let roll = Math.random() * total, cum = 0, picked = 'common';
            for (let j = 0; j < rarities.length; j++) {
                cum += weights[j];
                if (roll <= cum) { picked = rarities[j]; break; }
            }
            const pool = ITEMS_DATA.filter(it => it.rarity === picked);
            const item = pool[Math.floor(Math.random() * pool.length)];
            result.push({ ...item });
        }
        return result;
    }
};

// --- BootScene ---
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        // Player (larger)
        g.clear(); g.fillStyle(0x00ddff); g.fillRoundedRect(0, 0, 36, 48, 6);
        g.fillStyle(0x0099cc); g.fillRect(6, 9, 9, 9); g.fillRect(21, 9, 9, 9);
        g.fillStyle(0x00ffff); g.fillRect(9, 12, 3, 3); g.fillRect(24, 12, 3, 3);
        g.fillStyle(0x0088aa); g.fillRect(10, 38, 16, 8);
        g.generateTexture('player', 36, 48); g.clear();
        // Platforms (larger)
        g.fillStyle(0x556677); g.fillRoundedRect(0, 0, 120, 20, 4);
        g.fillStyle(0x667788); g.fillRect(3, 3, 114, 5);
        g.generateTexture('platform', 120, 20); g.clear();
        // Spikes
        g.fillStyle(0xff3333);
        g.fillTriangle(0, 24, 15, 0, 30, 24);
        g.fillTriangle(30, 24, 45, 0, 60, 24);
        g.fillTriangle(60, 24, 75, 0, 90, 24);
        g.fillStyle(0xaa1111);
        g.fillTriangle(15, 24, 30, 6, 45, 24);
        g.fillTriangle(45, 24, 60, 6, 75, 24);
        g.generateTexture('spike', 90, 24); g.clear();
        // Enemies - Red (larger)
        g.clear(); g.fillStyle(0xff3333); g.fillCircle(16, 16, 16);
        g.fillStyle(0xcc0000); g.fillCircle(16, 16, 11);
        g.fillStyle(0x000000); g.fillCircle(10, 12, 4); g.fillCircle(22, 12, 4);
        g.fillStyle(0xff8888); g.fillCircle(10, 11, 2); g.fillCircle(22, 11, 2);
        g.fillStyle(0xff0000); g.fillTriangle(5, 0, 16, 7, 0, 7);
        g.fillTriangle(27, 0, 32, 7, 16, 7);
        g.generateTexture('enemy_red', 32, 32); g.clear();
        // Enemies - White (larger)
        g.fillStyle(0xeeeeff); g.fillCircle(16, 16, 16);
        g.fillStyle(0xccccdd); g.fillCircle(16, 16, 11);
        g.fillStyle(0x4444aa); g.fillCircle(10, 12, 4); g.fillCircle(22, 12, 4);
        g.fillStyle(0xffffff); g.fillCircle(10, 11, 2); g.fillCircle(22, 11, 2);
        g.generateTexture('enemy_white', 32, 32); g.clear();
        // Enemies - Hunter (larger, purple)
        g.fillStyle(0xcc44ff); g.fillCircle(16, 16, 16);
        g.fillStyle(0x9922cc); g.fillCircle(16, 16, 11);
        g.fillStyle(0x000000); g.fillCircle(10, 11, 5); g.fillCircle(22, 11, 5);
        g.fillStyle(0xff00ff); g.fillCircle(10, 11, 3); g.fillCircle(22, 11, 3);
        g.fillStyle(0xaa33ee); g.fillTriangle(16, 28, 8, 36, 24, 36);
        g.generateTexture('enemy_hunter', 32, 38); g.clear();
        // Bullet (larger)
        g.fillStyle(0xffff00); g.fillCircle(6, 6, 6);
        g.fillStyle(0xffaa00); g.fillCircle(6, 6, 3);
        g.generateTexture('bullet', 12, 12); g.clear();
        // Shell casing
        g.fillStyle(0xddaa44); g.fillRect(0, 0, 4, 8);
        g.fillStyle(0xbb8833); g.fillRect(0, 0, 4, 2);
        g.generateTexture('shell', 4, 8); g.clear();
        // Spark particle
        g.fillStyle(0xffcc00); g.fillCircle(2, 2, 2);
        g.generateTexture('spark', 4, 4); g.clear();
        // Speed line
        g.fillStyle(0xffffff, 0.4); g.fillRect(0, 0, 2, 40);
        g.generateTexture('speed_line', 2, 40); g.clear();
        // Muzzle flash
        g.fillStyle(0xffff88, 0.8); g.fillCircle(12, 12, 12);
        g.fillStyle(0xffffff, 0.5); g.fillCircle(12, 12, 6);
        g.generateTexture('muzzle_flash', 24, 24); g.clear();
        // Goal
        g.fillStyle(0xffdd00); g.fillRect(0, 0, 90, 18);
        g.fillStyle(0xffaa00); g.fillTriangle(45, 0, 22, 18, 68, 18);
        g.generateTexture('goal', 90, 18); g.clear();
        // XP orb
        g.fillStyle(0x00ff88); g.fillCircle(8, 8, 8);
        g.fillStyle(0xaaffcc); g.fillCircle(5, 5, 3);
        g.generateTexture('xp_orb', 16, 16); g.clear();
        // Attack effect
        g.fillStyle(0xffffff, 0.7); g.fillCircle(20, 20, 20);
        g.generateTexture('atk_fx', 40, 40); g.clear();
        // Particle
        g.fillStyle(0xffffff); g.fillCircle(4, 4, 4);
        g.generateTexture('particle', 8, 8); g.clear();
        // BG tile
        g.fillStyle(0x0a0a14); g.fillRect(0, 0, 720, 80);
        g.lineStyle(1, 0x151525); g.strokeRect(0, 0, 720, 80);
        g.generateTexture('bg_tile', 720, 80); g.clear();
        g.destroy();
        this.scene.start('Menu');
    }
}

// --- MenuScene ---
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        const cx = 360, cy = 540;
        // Title
        this.add.text(cx, 150, 'ABYSS FALL', {
            fontSize: '64px', fontFamily: 'Orbitron, sans-serif',
            color: '#00ddff', fontStyle: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#00ddff', 16);
        this.add.text(cx, 220, '垂直落下型ローグライク・アクション', {
            fontSize: '16px', fontFamily: 'sans-serif', color: '#6688aa'
        }).setOrigin(0.5);
        // Floating particles
        for (let i = 0; i < 40; i++) {
            const p = this.add.circle(
                Phaser.Math.Between(0, 720), Phaser.Math.Between(0, 1080),
                Phaser.Math.Between(1, 4), 0x00ddff, 0.3
            );
            this.tweens.add({
                targets: p, y: p.y - 120, alpha: 0, duration: Phaser.Math.Between(2000, 5000),
                repeat: -1, yoyo: true
            });
        }
        // Buttons
        this.createBtn(cx, 420, 'NORMAL モード', '#00cc88', () => { GameState.mode = 'NORMAL'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 465, '死亡時：アイテム消失、レベル維持', { fontSize: '13px', color: '#558866' }).setOrigin(0.5);
        this.createBtn(cx, 540, 'HARD モード', '#ff4466', () => { GameState.mode = 'HARD'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 585, '死亡時：全てリセット', { fontSize: '13px', color: '#885566' }).setOrigin(0.5);
        this.createBtn(cx, 700, '📖 図鑑', '#8866ff', () => { this.scene.start('Collection'); });
        // Info
        this.add.text(cx, 880, '操作: ← → 移動 / SPACE ガンブーツ発射', { fontSize: '14px', color: '#445566' }).setOrigin(0.5);
        this.add.text(cx, 910, '白い敵は踏んで倒せる / 赤い敵は弾で倒す', { fontSize: '13px', color: '#445566' }).setOrigin(0.5);
        this.add.text(cx, 950, `最高レベル記録: Lv.${GameState.level}`, { fontSize: '14px', color: '#445566' }).setOrigin(0.5);
    }
    createBtn(x, y, text, color, cb) {
        const bg = this.add.rectangle(x, y, 340, 56, Phaser.Display.Color.HexStringToColor(color).color, 0.15)
            .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color).setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, text, { fontSize: '22px', fontFamily: 'sans-serif', color: color, fontStyle: 'bold' }).setOrigin(0.5);
        bg.on('pointerover', () => { bg.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.3); });
        bg.on('pointerout', () => { bg.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.15); });
        bg.on('pointerdown', cb);
    }
}

// --- GameScene ---
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
        this.stageHeight = 4500 + GameState.currentStage * 500;
        this.physics.world.setBounds(0, 0, 720, this.stageHeight);
        this.cameras.main.setBounds(0, 0, 720, this.stageHeight);
        this.cameras.main.setBackgroundColor('#0a0a14');
        // BG
        for (let y = 0; y < this.stageHeight; y += 80) {
            this.add.image(360, y + 40, 'bg_tile').setAlpha(0.5);
            if (Math.random() < 0.15) {
                this.add.circle(Phaser.Math.Between(20, 700), y + Phaser.Math.Between(0, 80),
                    Phaser.Math.Between(1, 3), 0x00ddff, 0.15);
            }
        }
        // Depth indicator
        for (let y = 0; y < this.stageHeight; y += 400) {
            this.add.text(700, y, `${Math.floor(y / 30)}m`, { fontSize: '11px', color: '#223344' }).setOrigin(1, 0);
        }
        // Platforms
        this.platforms = this.physics.add.staticGroup();
        this.spikeGroup = this.physics.add.staticGroup();
        this.generatePlatforms();
        // Goal
        this.goal = this.physics.add.staticImage(360, this.stageHeight - 100, 'goal').setScale(8, 2.5).refreshBody();
        this.goal.body.setSize(720, 100).setOffset(-270, -35); // Adjust offset for wider body
        this.add.text(360, this.stageHeight - 155, '⬇ FINAL DEPTH ⬇', { fontSize: '32px', color: '#ffdd00', fontStyle: 'bold' }).setOrigin(0.5);
        // Enemies
        this.enemyGroup = this.physics.add.group();
        this.spawnEnemies();
        // XP orbs
        this.xpOrbs = this.physics.add.group();
        // Bullets
        this.bullets = this.physics.add.group();
        // Player
        this.player = this.physics.add.sprite(360, 80, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(450 * GameState.getFallMod()); // 1.5x gravity
        this.player.setDepth(10);
        this.player.hp = GameState.hp;
        this.player.invTime = 0;
        this.player.facingRight = true;
        // Gun Boot ammo
        this.ammo = 6;
        this.maxAmmo = 6;
        this.wasOnGround = false;
        // Collisions
        this.physics.add.collider(this.player, this.platforms, this.onLandPlatform, null, this);
        this.physics.add.collider(this.player, this.spikeGroup, this.onSpikeHit, null, this);
        this.physics.add.overlap(this.player, this.enemyGroup, this.onEnemyContact, null, this);
        this.physics.add.overlap(this.player, this.goal, this.onGoal, null, this);
        this.physics.add.overlap(this.player, this.xpOrbs, this.collectXP, null, this);
        this.physics.add.overlap(this.bullets, this.enemyGroup, this.onBulletHitEnemy, null, this);
        // Camera
        this.cameras.main.startFollow(this.player, false, 0.1, 0.3, 0, -180);
        this.autoScrollY = 0;
        this.baseScrollSpeed = 22 + GameState.getDifficulty() * 12 + GameState.currentStage * 3;
        this.dynamicAccel = 0; // Dynamic acceleration
        this.stageTime = 0; // Time elapsed in stage
        // Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.shootCooldown = 0;
        this.goalReached = false;
        this.spaceWasDown = false;
        // Touch controls
        this.touchDir = 0; this.touchAtk = false;
        this.setupTouchControls();
        // UI
        this.createUI();
        // Stage start text
        const diff = GameState.getDifficultyLabel();
        const stTxt = this.add.text(360, 540, `Stage ${GameState.currentStage}\n${diff}`, {
            fontSize: '40px', fontFamily: 'sans-serif', color: '#00ddff', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.tweens.add({ targets: stTxt, alpha: 0, y: 480, duration: 2000, delay: 800, onComplete: () => stTxt.destroy() });
        // Speed lines container
        this.speedLines = [];
    }

    generatePlatforms() {
        const spacing = Math.max(130, 180 - GameState.getDifficulty() * 12);
        this.addPlatform(360, 140, 3);
        let y = 140 + spacing;
        while (y < this.stageHeight - 250) {
            const x = Phaser.Math.Between(80, 640);
            const spikeChance = 0.18 + GameState.getDifficulty() * 0.06;
            if (Math.random() < spikeChance) {
                this.addSpike(x, y, Phaser.Math.Between(1, 2));
            } else {
                this.addPlatform(x, y, Phaser.Math.Between(1, 3));
            }
            if (Math.random() < 0.25) {
                const x2 = Phaser.Math.Between(80, 640);
                this.addPlatform(x2, y + Phaser.Math.Between(-20, 20), Phaser.Math.Between(1, 2));
            }
            y += Phaser.Math.Between(Math.floor(spacing * 0.8), Math.floor(spacing * 1.4));
        }
        this.addPlatform(360, this.stageHeight - 100, 4);
    }
    addPlatform(x, y, scaleX) {
        const p = this.platforms.create(x, y, 'platform').setScale(scaleX, 1).refreshBody();
        p.body.checkCollision.down = false;
        p.body.checkCollision.left = false;
        p.body.checkCollision.right = false;
    }
    addSpike(x, y, scaleX) {
        const s = this.spikeGroup.create(x, y, 'spike').setScale(scaleX, 1).refreshBody();
        s.body.checkCollision.down = false;
        s.body.checkCollision.left = false;
        s.body.checkCollision.right = false;
    }

    spawnEnemies() {
        const diff = GameState.getDifficulty();
        const rate = 0.25 + diff * 0.08;
        const redRatio = 0.3 + diff * 0.1;
        // ① パトロール型: 足場の上を左右に往復
        this.platforms.children.iterate(p => {
            if (p.y < 200 || p.y > this.stageHeight - 200) return;
            if (Math.random() > rate) return;
            const isRed = Math.random() < redRatio;
            this.createEnemy(p.x, p.y - 24, isRed, 'patrol', p);
        });
        // ③ ハンター型: NORMAL難易度以上で出現
        if (diff >= 1) {
            const hunterCount = Math.floor(1 + diff * 1.5);
            for (let i = 0; i < hunterCount; i++) {
                const hy = Phaser.Math.Between(400, this.stageHeight - 400);
                const hx = Phaser.Math.Between(60, 660);
                this.createEnemy(hx, hy, true, 'hunter', null);
            }
        }
        // ② インターセプター型: update内で動的にスポーン
        this.interceptorTimer = 0;
        this.interceptorInterval = Math.max(1.5, 4 - diff * 0.5);
    }

    createEnemy(x, y, isRed, aiType, platform) {
        const diff = GameState.getDifficulty();
        let texKey = isRed ? 'enemy_red' : 'enemy_white';
        if (aiType === 'hunter') texKey = 'enemy_hunter';
        const e = this.enemyGroup.create(x, y, texKey);
        e.isRed = isRed || aiType === 'hunter';
        e.aiType = aiType;
        e.eData = {
            hp: isRed ? 30 + diff * 10 : 15 + diff * 5,
            damage: isRed ? 20 + diff * 5 : 10,
            xp: aiType === 'hunter' ? 40 + diff * 8 : (isRed ? 25 + diff * 5 : 15 + diff * 3),
            speed: aiType === 'hunter' ? Phaser.Math.Between(25, 40) : Phaser.Math.Between(20, 50),
            upSpeed: aiType === 'interceptor' ? Phaser.Math.Between(30, 55 + diff * 5) : 0,
            color: aiType === 'hunter' ? 0xcc44ff : (isRed ? 0xff3333 : 0xeeeeff)
        };
        if (aiType === 'hunter') {
            e.eData.hp = 40 + diff * 15;
            e.eData.damage = 25 + diff * 5;
        }
        e.hp = e.eData.hp;
        e.setBounce(0);
        e.startX = x;
        e.startY = y;
        e.moveDir = Math.random() < 0.5 ? 1 : -1;
        e.setCollideWorldBounds(aiType === 'patrol');
        if (aiType === 'patrol' && platform) {
            e.body.setGravityY(0);
            e.patrolLeft = platform.x - (platform.displayWidth / 2) + 10;
            e.patrolRight = platform.x + (platform.displayWidth / 2) - 10;
        } else if (aiType === 'interceptor') {
            e.body.setGravityY(-50);
        } else if (aiType === 'hunter') {
            e.body.setGravityY(-300); // Counteract world gravity
            e.hunterAccel = 0.015 + diff * 0.005; // Chase speed
        }
        if (GameState.hasEffect('timeSlow')) {
            e.eData.speed = Math.floor(e.eData.speed * (1 - GameState.getEffectVal('timeSlow')));
        }
        return e;
    }

    spawnInterceptor() {
        const diff = GameState.getDifficulty();
        const camBottom = this.cameras.main.scrollY + 1100;
        if (camBottom > this.stageHeight - 100) return;
        const x = Phaser.Math.Between(60, 660);
        const isRed = Math.random() < (0.4 + diff * 0.1);
        this.createEnemy(x, camBottom, isRed, 'interceptor', null);
    }

    setupTouchControls() {
        // Left zone
        const lz = this.add.rectangle(120, 980, 200, 100, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(120, 980, '◀', { fontSize: '34px', color: '#00ddff' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.5);
        lz.on('pointerdown', () => this.touchDir = -1); lz.on('pointerup', () => { if (this.touchDir === -1) this.touchDir = 0; });
        lz.on('pointerout', () => { if (this.touchDir === -1) this.touchDir = 0; });
        // Right zone
        const rz = this.add.rectangle(360, 980, 200, 100, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(360, 980, '▶', { fontSize: '34px', color: '#00ddff' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.5);
        rz.on('pointerdown', () => this.touchDir = 1); rz.on('pointerup', () => { if (this.touchDir === 1) this.touchDir = 0; });
        rz.on('pointerout', () => { if (this.touchDir === 1) this.touchDir = 0; });
        // Shoot zone (Gun Boot)
        const az = this.add.rectangle(600, 980, 200, 100, 0xffaa00, 0.12).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(600, 980, '💥', { fontSize: '34px' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.7);
        az.on('pointerdown', () => this.touchAtk = true); az.on('pointerup', () => this.touchAtk = false);
    }

    createUI() {
        this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        // Top bar (compact)
        this.uiContainer.add(this.add.rectangle(360, 18, 720, 36, 0x000000, 0.65).setScrollFactor(0));
        this.stageText = this.add.text(10, 8, '', { fontSize: '12px', color: '#aabbcc' }).setScrollFactor(0);
        this.levelText = this.add.text(10, 22, '', { fontSize: '11px', color: '#00ddff' }).setScrollFactor(0);
        this.xpBg = this.add.rectangle(200, 14, 100, 8, 0x222233).setScrollFactor(0);
        this.xpBar = this.add.rectangle(151, 14, 0, 6, 0x00ddff).setScrollFactor(0).setOrigin(0, 0.5);
        this.diffText = this.add.text(710, 14, '', { fontSize: '11px', color: '#ffaa00' }).setScrollFactor(0).setOrigin(1, 0.5);
        this.uiContainer.add([this.stageText, this.levelText, this.xpBg, this.xpBar, this.diffText]);
        // Floating HUD (follows player)
        this.floatHpBg = this.add.rectangle(0, 0, 50, 6, 0x333333, 0.7).setDepth(15);
        this.floatHpBar = this.add.rectangle(0, 0, 48, 4, 0x00ff66).setDepth(15).setOrigin(0, 0.5);
        this.floatAmmoText = this.add.text(0, 0, '', { fontSize: '10px', color: '#ffaa00', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(15);
    }
    updateUI() {
        const hpRatio = GameState.hp / GameState.maxHp;
        // Floating HUD - follows player
        const px = this.player.x, py = this.player.y - 40;
        this.floatHpBg.setPosition(px, py);
        this.floatHpBar.setPosition(px - 24, py);
        this.floatHpBar.setScale(hpRatio, 1);
        this.floatHpBar.setFillStyle(hpRatio > 0.5 ? 0x00ff66 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333);
        // Ammo dots near player
        let ammoStr = '';
        for (let i = 0; i < this.maxAmmo; i++) ammoStr += i < this.ammo ? '●' : '○';
        this.floatAmmoText.setPosition(px, py - 10);
        this.floatAmmoText.setText(ammoStr);
        this.floatAmmoText.setColor(this.ammo > 0 ? '#ffaa00' : '#ff3333');
        // Top bar
        this.stageText.setText(`Stage ${GameState.currentStage} | ${GameState.getDifficultyLabel()} | HP:${GameState.hp}/${GameState.maxHp}`);
        this.levelText.setText(`Lv.${GameState.level} | ATK:${GameState.getAtk()}`);
        const xpRatio = GameState.xp / GameState.xpToNext;
        this.xpBar.width = xpRatio * 98;
        this.xpBar.setScale(Math.min(xpRatio * 98, 98), 1);
        this.diffText.setText(`弾:${this.ammo}/${this.maxAmmo}`);
    }

    update(time, delta) {
        if (this.goalReached) return;
        const dt = delta / 1000;
        this.stageTime += dt;
        // Dynamic acceleration
        this.dynamicAccel = Math.min(this.stageTime * 0.4, 20);
        const currentScrollSpeed = this.baseScrollSpeed + this.dynamicAccel;
        // Auto scroll
        this.autoScrollY += currentScrollSpeed * dt;
        const camY = this.cameras.main.scrollY;
        if (camY < this.autoScrollY) this.cameras.main.scrollY = this.autoScrollY;
        // Death by scroll
        if (this.player.y < this.cameras.main.scrollY - 30) { this.playerDeath(); return; }
        // Speed lines effect
        const fallSpeed = Math.abs(this.player.body.velocity.y);
        if (fallSpeed > 250) this.spawnSpeedLines(fallSpeed);
        // Ground check for ammo reload
        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (onGround && !this.wasOnGround) {
            this.reloadAmmo();
        }
        this.wasOnGround = onGround;
        // Player movement
        let moveTarget = 0;
        if (this.cursors.left.isDown || this.keyA.isDown) moveTarget = -1;
        else if (this.cursors.right.isDown || this.keyD.isDown) moveTarget = 1;
        else if (this.touchDir !== 0) moveTarget = this.touchDir;

        const moveSpeed = 450 + (GameState.hasEffect('speedUp') ? 80 : 0); // 300 -> 450
        this.player.setVelocityX(moveTarget * moveSpeed);
        if (moveTarget !== 0) {
            this.player.facingRight = moveTarget > 0;
            this.player.setFlipX(moveTarget < 0);
        }
        // Gun Boot shooting (Space or touch) - single press
        this.shootCooldown -= dt;
        const spaceDown = this.keySpace.isDown || this.touchAtk;
        if (spaceDown && !this.spaceWasDown && this.shootCooldown <= 0) {
            this.shootGunBoot();
        }
        this.spaceWasDown = spaceDown;
        // Invincibility timer
        if (this.player.invTime > 0) {
            this.player.invTime -= dt;
            this.player.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3);
        } else this.player.setAlpha(1);
        // Enemy AI - 3 patterns
        this.enemyGroup.children.iterate(e => {
            if (!e || !e.active) return;
            if (e.aiType === 'patrol') {
                // ① パトロール: 足場端で方向転換
                if (e.patrolLeft !== undefined) {
                    if (e.x <= e.patrolLeft) e.moveDir = 1;
                    else if (e.x >= e.patrolRight) e.moveDir = -1;
                }
                e.setVelocityX(e.eData.speed * e.moveDir);
                e.setVelocityY(0);
            } else if (e.aiType === 'interceptor') {
                // ② インターセプター: 上昇 + 左右揺れ
                const dx = e.x - e.startX;
                if (Math.abs(dx) > 60) e.moveDir *= -1;
                e.setVelocityX(e.eData.speed * e.moveDir);
                e.setVelocityY(-e.eData.upSpeed);
            } else if (e.aiType === 'hunter') {
                // ③ ハンター: プレイヤー追尾
                const dirX = this.player.x - e.x;
                const dirY = this.player.y - e.y;
                const dist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
                const normX = dirX / dist;
                const normY = dirY / dist;
                const chaseSpeed = e.eData.speed * 1.5;
                // スムーズに追尾（急に最大速度にならないようlerp）
                const curVX = e.body.velocity.x;
                const curVY = e.body.velocity.y;
                e.setVelocityX(curVX + (normX * chaseSpeed - curVX) * e.hunterAccel * 60 * dt);
                e.setVelocityY(curVY + (normY * chaseSpeed - curVY) * e.hunterAccel * 60 * dt);
                // プレイヤー方向に向く
                e.setFlipX(dirX < 0);
                // 紫のオーラ演出
                if (Math.random() < 0.1) {
                    const trail = this.add.circle(e.x, e.y, 3, 0xcc44ff, 0.4);
                    this.tweens.add({ targets: trail, alpha: 0, scale: 0, duration: 300, onComplete: () => trail.destroy() });
                }
            }
            // 画面外削除
            if (e.y < this.cameras.main.scrollY - 80 || e.y > this.cameras.main.scrollY + 850) {
                e.destroy();
            }
        });
        // Interceptor spawner - 定期的に画面下から敵を生成
        this.interceptorTimer += dt;
        if (this.interceptorTimer >= this.interceptorInterval) {
            this.interceptorTimer = 0;
            this.spawnInterceptor();
        }
        // Clean up bullets
        this.bullets.children.iterate(b => {
            if (!b || !b.active) return;
            if (b.y > this.cameras.main.scrollY + 800 || b.y < this.cameras.main.scrollY - 50) b.destroy();
        });
        // XP orbs magnet
        const magRange = 50 + GameState.getEffectVal('xpRange') * 50;
        this.xpOrbs.children.iterate(orb => {
            if (!orb || !orb.active) return;
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);
            if (d < magRange) {
                this.physics.moveToObject(orb, this.player, 200);
            }
        });
        this.updateUI();
    }

    // --- Gun Boot System ---
    shootGunBoot() {
        if (this.ammo <= 0) return;
        this.ammo--;
        this.shootCooldown = 0.15;
        const atk = GameState.getAtk();
        const hits = GameState.hasEffect('doubleHit') ? 2 : 1;
        for (let h = 0; h < hits; h++) {
            const offsetX = hits > 1 ? (h === 0 ? -8 : 8) : 0;
            const b = this.bullets.create(this.player.x + offsetX, this.player.y + 28, 'bullet');
            b.setVelocityY(500);
            b.body.setGravityY(-450);
            b.damage = atk;
            b.setDepth(5);
        }
        // Recoil
        const recoilForce = -160 - (GameState.hasEffect('antiGravity') ? 50 : 0);
        this.player.setVelocityY(Math.min(this.player.body.velocity.y + recoilForce, recoilForce));
        // Muzzle flash
        const flash = this.add.image(this.player.x, this.player.y + 30, 'muzzle_flash').setScale(2).setAlpha(0.9).setDepth(9);
        this.tweens.add({ targets: flash, scale: 0.4, alpha: 0, duration: 100, onComplete: () => flash.destroy() });
        // Shell casing ejection
        const shellDir = this.player.facingRight ? 1 : -1;
        for (let i = 0; i < 2; i++) {
            const shell = this.add.image(this.player.x + shellDir * 10, this.player.y + 20, 'shell').setDepth(8);
            this.tweens.add({
                targets: shell,
                x: shell.x + shellDir * Phaser.Math.Between(15, 40),
                y: shell.y + Phaser.Math.Between(-30, -10),
                angle: Phaser.Math.Between(90, 360),
                alpha: 0, duration: 500,
                onComplete: () => shell.destroy()
            });
        }
        // Fire sparks
        for (let i = 0; i < 4; i++) {
            const sp = this.add.image(this.player.x + Phaser.Math.Between(-8, 8), this.player.y + 26, 'spark').setDepth(8);
            this.tweens.add({
                targets: sp,
                x: sp.x + Phaser.Math.Between(-20, 20),
                y: sp.y + Phaser.Math.Between(15, 45),
                alpha: 0, scale: 0, duration: Phaser.Math.Between(150, 300),
                onComplete: () => sp.destroy()
            });
        }
        // Speed lines on recoil
        this.spawnSpeedLines(400);
        // Screen shake
        this.cameras.main.shake(50, 0.005);
    }

    spawnSpeedLines(speed) {
        const intensity = Math.min((speed - 200) / 400, 1);
        const count = Math.floor(1 + intensity * 3);
        for (let i = 0; i < count; i++) {
            const side = Math.random() < 0.5 ? 0 : 1;
            const x = side === 0 ? Phaser.Math.Between(10, 80) : Phaser.Math.Between(640, 710);
            const lineY = this.cameras.main.scrollY + Phaser.Math.Between(50, 1030);
            const line = this.add.image(x, lineY, 'speed_line').setAlpha(0.2 + intensity * 0.4).setScale(1, 1 + intensity * 2).setDepth(2);
            this.tweens.add({ targets: line, y: line.y - 100, alpha: 0, duration: 200, onComplete: () => line.destroy() });
        }
    }

    reloadAmmo() {
        if (this.ammo < this.maxAmmo) {
            this.ammo = this.maxAmmo;
            // Reload visual feedback
            const txt = this.add.text(this.player.x, this.player.y - 30, 'RELOAD!', {
                fontSize: '12px', color: '#ffaa00', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(20);
            this.tweens.add({ targets: txt, y: txt.y - 25, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
        }
    }

    onLandPlatform(player, platform) {
        if (!this.wasOnGround) {
            this.spawnLandingEffect(player.x, player.y + 24);
            // Dynamic HUD bounce on landing
            this.tweens.add({ targets: [this.floatHpBg, this.floatHpBar, this.floatAmmoText], y: '+=5', duration: 50, yoyo: true });
        }
    }

    spawnLandingEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const p = this.add.circle(x + Phaser.Math.Between(-15, 15), y, Phaser.Math.Between(2, 5), 0x8899aa, 0.6);
            this.tweens.add({
                targets: p,
                x: p.x + (p.x < x ? -Phaser.Math.Between(20, 40) : Phaser.Math.Between(20, 40)),
                y: p.y - Phaser.Math.Between(5, 15),
                alpha: 0,
                scale: 0.5,
                duration: Phaser.Math.Between(300, 500),
                onComplete: () => p.destroy()
            });
        }
    }

    onBulletHitEnemy(bullet, enemy) {
        if (!bullet.active || !enemy.active) return;
        enemy.hp -= bullet.damage;
        // Hit flash
        enemy.setTint(0xffffff);
        this.time.delayedCall(80, () => { if (enemy && enemy.active) enemy.clearTint(); });
        // Bullet impact effect
        const fx = this.add.image(bullet.x, bullet.y, 'muzzle_flash').setScale(0.8).setTint(0xffaa00).setAlpha(0.7);
        this.tweens.add({ targets: fx, scale: 1.5, alpha: 0, duration: 150, onComplete: () => fx.destroy() });
        bullet.destroy();
        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    killEnemy(e) {
        GameState.addXP(e.eData.xp);
        if (GameState.hasEffect('lifeSteal')) {
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + GameState.getEffectVal('lifeSteal'));
        }
        // Spawn XP orb
        const orb = this.xpOrbs.create(e.x, e.y, 'xp_orb');
        orb.body.setGravityY(-250);
        this.tweens.add({ targets: orb, alpha: 0, duration: 3000, onComplete: () => orb.destroy() });
        // Enhanced Death particles
        for (let i = 0; i < 12; i++) {
            const p = this.add.circle(e.x, e.y, Phaser.Math.Between(3, 6), e.eData.color);
            const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
            const speed = Phaser.Math.Between(100, 250);
            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: Phaser.Math.Between(400, 700), onComplete: () => p.destroy() });
        }
        // Ghost effect
        const ghost = this.add.image(e.x, e.y, e.texture.key).setTint(0xffffff).setAlpha(0.6);
        this.tweens.add({ targets: ghost, scale: 2, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });

        e.destroy();
    }
    collectXP(player, orb) { orb.destroy(); }

    onEnemyContact(player, enemy) {
        // Check if player is stomping (falling from above)
        const playerBottom = player.body.y + player.body.height;
        const enemyTop = enemy.body.y;
        const isFalling = player.body.velocity.y > 0;
        const isAbove = playerBottom <= enemyTop + 12;

        if (isFalling && isAbove) {
            // STOMP!
            if (enemy.isRed) {
                // Red enemy - stomping hurts player!
                if (this.player.invTime > 0) return;
                const dmg = enemy.eData.damage;
                GameState.takeDamage(dmg);
                this.playerHitVFX();
                this.player.setVelocityY(-200);
                if (GameState.hp <= 0) this.playerDeath();
            } else {
                // White enemy - stomp to kill + reload!
                this.killEnemy(enemy);
                this.reloadAmmo();
                this.player.setVelocityY(-220); // Bounce up
                // Stomp visual
                const stompTxt = this.add.text(enemy.x, enemy.y, 'STOMP!', {
                    fontSize: '14px', color: '#00ff88', fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(20);
                this.tweens.add({ targets: stompTxt, y: stompTxt.y - 30, alpha: 0, duration: 500, onComplete: () => stompTxt.destroy() });
            }
        } else {
            // Side/bottom contact = take damage
            if (this.player.invTime > 0) return;
            const dmg = enemy.eData.damage;
            const actual = GameState.takeDamage(dmg);
            if (actual === -dmg) {
                enemy.hp -= dmg; if (enemy.hp <= 0) this.killEnemy(enemy);
            }
            this.playerHitVFX();
            const dir = player.x < enemy.x ? -1 : 1;
            player.setVelocity(dir * 250, -150);
            if (GameState.hp <= 0) this.playerDeath();
        }
    }

    playerHitVFX() {
        this.player.invTime = 1.0;
        this.cameras.main.shake(150, 0.012);
        this.cameras.main.flash(100, 255, 50, 50, true);

        // Flash red
        this.player.setTint(0xff0000);
        const flashTimer = this.time.addEvent({
            delay: 100,
            repeat: 9,
            callback: () => {
                if (this.player.isTinted) this.player.clearTint();
                else this.player.setTint(0xff0000);
            }
        });
        this.time.delayedCall(1000, () => {
            flashTimer.remove();
            this.player.clearTint();
        });

        // Hit particles
        for (let i = 0; i < 10; i++) {
            const p = this.add.image(this.player.x, this.player.y, 'spark').setTint(0xffffff);
            const ang = Phaser.Math.Between(0, 360) * (Math.PI / 180);
            const spd = Phaser.Math.Between(150, 350);
            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
            this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 400, onComplete: () => p.destroy() });
        }

        // HUD impact
        this.tweens.add({ targets: [this.floatHpBg, this.floatHpBar, this.floatAmmoText], x: '+=10', duration: 50, yoyo: true, repeat: 3 });
    }

    onGoal(player, goal) {
        if (this.goalReached) return;
        this.goalReached = true;

        // Celebratory particles
        for (let i = 0; i < 50; i++) {
            const p = this.add.circle(Phaser.Math.Between(0, 720), this.stageHeight - 50, Phaser.Math.Between(5, 12),
                Phaser.Utils.Array.GetRandom([0x00ddff, 0xffdd00, 0xffffff, 0x00ff88]));
            this.physics.add.existing(p);
            p.body.setVelocity(Phaser.Math.Between(-200, 200), Phaser.Math.Between(-400, -800));
            p.body.setGravityY(400);
            this.tweens.add({ targets: p, alpha: 0, duration: Phaser.Math.Between(1000, 2000), onComplete: () => p.destroy() });
        }

        // Camera zoom in on goal
        this.cameras.main.zoomTo(1.2, 500);

        // Stage heal effect
        if (GameState.hasEffect('stageHeal')) {
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + Math.floor(GameState.getEffectVal('stageHeal')));
        }
        this.cameras.main.flash(500, 255, 221, 0);
        this.time.delayedCall(1000, () => {
            GameState.currentStage++;
            this.scene.start('ItemSelect');
        });
    }

    onSpikeHit(player, spike) {
        if (this.player.invTime > 0) return;
        const dmg = 15 + GameState.getDifficulty() * 5;
        GameState.takeDamage(dmg);
        this.playerHitVFX();
        this.player.setVelocityY(-250);
        if (GameState.hp <= 0) this.playerDeath();
    }

    playerDeath() {
        if (this.goalReached) return;
        // Revive check
        if (GameState.fullReviveAvailable) {
            GameState.fullReviveAvailable = false;
            GameState.hp = GameState.maxHp;
            GameState.items = GameState.items.filter(i => i.effect !== 'fullRevive');
            this.player.invTime = 2; this.cameras.main.flash(300, 100, 100, 255); return;
        }
        if (GameState.reviveAvailable) {
            GameState.reviveAvailable = false;
            GameState.hp = Math.floor(GameState.maxHp * 0.5);
            GameState.items = GameState.items.filter(i => i.effect !== 'revive');
            this.player.invTime = 2; this.cameras.main.flash(300, 255, 100, 0); return;
        }
        this.goalReached = true;
        this.cameras.main.shake(500, 0.03);
        this.time.delayedCall(800, () => this.scene.start('GameOver'));
    }
}

// --- ItemSelectScene ---
class ItemSelectScene extends Phaser.Scene {
    constructor() { super('ItemSelect'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        this.add.text(360, 80, `Stage ${GameState.currentStage - 1} クリア！`, {
            fontSize: '34px', color: '#ffdd00', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(360, 130, 'アイテムを1つ選択してください', { fontSize: '16px', color: '#8899aa' }).setOrigin(0.5);
        const items = GameState.rollItems(3);
        items.forEach((item, i) => {
            const x = 130 + i * 230, y = 420;
            const rc = RARITY_CONFIG[item.rarity];
            const col = Phaser.Display.Color.HexStringToColor(rc.color).color;
            const card = this.add.rectangle(x, y, 190, 300, 0x111122, 0.9).setStrokeStyle(2, col).setInteractive({ useHandCursor: true });
            this.add.text(x, y - 110, item.icon, { fontSize: '44px' }).setOrigin(0.5);
            this.add.text(x, y - 60, item.name, { fontSize: '15px', color: rc.color, fontStyle: 'bold', wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5);
            this.add.text(x, y - 25, rc.label, { fontSize: '12px', color: rc.color }).setOrigin(0.5);
            this.add.text(x, y + 15, item.description, { fontSize: '12px', color: '#aabbcc', wordWrap: { width: 160 }, align: 'center' }).setOrigin(0.5);
            card.on('pointerover', () => card.setFillStyle(col, 0.2));
            card.on('pointerout', () => card.setFillStyle(0x111122, 0.9));
            card.on('pointerdown', () => {
                GameState.addItem(item);
                this.cameras.main.flash(300);
                this.time.delayedCall(400, () => this.scene.start('Game'));
            });
        });
        // Current items display
        if (GameState.items.length > 0) {
            this.add.text(360, 640, '所持アイテム', { fontSize: '14px', color: '#667788' }).setOrigin(0.5);
            const itemStr = GameState.items.map(i => i.icon + i.name).join('  ');
            this.add.text(360, 670, itemStr, { fontSize: '13px', color: '#556677', wordWrap: { width: 660 }, align: 'center' }).setOrigin(0.5);
        }
        // Stats
        this.add.text(360, 780, `Lv.${GameState.level} | HP:${GameState.hp}/${GameState.maxHp} | ATK:${GameState.getAtk()} | Luck:${GameState.luck}`, {
            fontSize: '14px', color: '#556677'
        }).setOrigin(0.5);
    }
}

// --- GameOverScene ---
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        this.add.text(360, 180, 'GAME OVER', { fontSize: '56px', color: '#ff3344', fontStyle: 'bold', fontFamily: 'Orbitron, sans-serif' }).setOrigin(0.5).setShadow(0, 0, '#ff0000', 10);
        this.add.text(360, 300, `到達ステージ: ${GameState.currentStage}`, { fontSize: '22px', color: '#aabbcc' }).setOrigin(0.5);
        this.add.text(360, 340, `プレイヤーレベル: ${GameState.level}`, { fontSize: '18px', color: '#00ddff' }).setOrigin(0.5);
        this.add.text(360, 380, `難易度: ${GameState.getDifficultyLabel()}`, { fontSize: '16px', color: '#ffaa00' }).setOrigin(0.5);
        this.add.text(360, 415, `モード: ${GameState.mode}`, { fontSize: '16px', color: '#888' }).setOrigin(0.5);
        const retryLabel = GameState.mode === 'HARD' ? 'リトライ（全リセット）' : 'リトライ（レベル維持）';
        // Retry button
        this.createBtn(360, 560, retryLabel, '#00cc88', () => {
            GameState.reset(GameState.mode === 'HARD');
            this.scene.start('Game');
        });
        // Menu button
        this.createBtn(360, 650, 'タイトルへ戻る', '#5588ff', () => {
            GameState.reset(GameState.mode === 'HARD');
            this.scene.start('Menu');
        });
    }
    createBtn(x, y, text, color, cb) {
        const c = Phaser.Display.Color.HexStringToColor(color).color;
        const bg = this.add.rectangle(x, y, 340, 56, c, 0.15).setStrokeStyle(2, c).setInteractive({ useHandCursor: true });
        this.add.text(x, y, text, { fontSize: '20px', color: color, fontStyle: 'bold' }).setOrigin(0.5);
        bg.on('pointerover', () => bg.setFillStyle(c, 0.3));
        bg.on('pointerout', () => bg.setFillStyle(c, 0.15));
        bg.on('pointerdown', cb);
    }
}

// --- CollectionScene ---
class CollectionScene extends Phaser.Scene {
    constructor() { super('Collection'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        this.add.text(360, 45, '📖 アイテム図鑑', { fontSize: '28px', color: '#00ddff', fontStyle: 'bold' }).setOrigin(0.5);
        const collected = GameState.collection.length;
        this.add.text(360, 80, `${collected} / ${ITEMS_DATA.length} 収集済み`, { fontSize: '15px', color: '#667788' }).setOrigin(0.5);
        // Scroll container
        const startY = 110;
        const itemH = 65;
        ITEMS_DATA.forEach((item, idx) => {
            const y = startY + idx * itemH;
            const owned = GameState.collection.includes(item.id);
            const rc = RARITY_CONFIG[item.rarity];
            const col = owned ? Phaser.Display.Color.HexStringToColor(rc.color).color : 0x333344;
            this.add.rectangle(360, y + 25, 660, 56, 0x111122, 0.8).setStrokeStyle(1, col);
            if (owned) {
                this.add.text(50, y + 15, item.icon, { fontSize: '26px' });
                this.add.text(90, y + 10, item.name, { fontSize: '15px', color: rc.color, fontStyle: 'bold' });
                this.add.text(90, y + 30, item.description, { fontSize: '12px', color: '#889999' });
                this.add.text(660, y + 10, rc.label, { fontSize: '11px', color: rc.color }).setOrigin(1, 0);
            } else {
                this.add.text(50, y + 15, '❓', { fontSize: '26px' });
                this.add.text(90, y + 20, '？？？', { fontSize: '15px', color: '#444455' });
            }
        });
        // Enable camera scroll for long list
        const totalH = startY + ITEMS_DATA.length * itemH + 80;
        this.cameras.main.setBounds(0, 0, 720, Math.max(1080, totalH));
        this.input.on('pointermove', (p) => {
            if (p.isDown) this.cameras.main.scrollY -= (p.y - p.prevPosition.y);
        });
        // Back button
        const backBtn = this.add.text(360, totalH - 40, '← タイトルへ戻る', {
            fontSize: '18px', color: '#5588ff', fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.scene.start('Menu'));
    }
}

// --- Phaser Config ---
const config = {
    type: Phaser.AUTO,
    width: 720, height: 1080,
    parent: 'game-container',
    backgroundColor: '#0a0a14',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 450 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, GameScene, ItemSelectScene, GameOverScene, CollectionScene]
};
const game = new Phaser.Game(config);
