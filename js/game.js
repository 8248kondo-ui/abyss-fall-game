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
        // Player
        g.clear(); g.fillStyle(0x00ddff); g.fillRoundedRect(0, 0, 24, 32, 4);
        g.fillStyle(0x0099cc); g.fillRect(4, 6, 6, 6); g.fillRect(14, 6, 6, 6);
        g.fillStyle(0x00ffff); g.fillRect(6, 8, 2, 2); g.fillRect(16, 8, 2, 2);
        g.generateTexture('player', 24, 32); g.clear();
        // Platforms
        g.fillStyle(0x556677); g.fillRoundedRect(0, 0, 80, 16, 3);
        g.fillStyle(0x667788); g.fillRect(2, 2, 76, 4);
        g.generateTexture('platform', 80, 16); g.clear();
        // Spikes (トゲ)
        g.fillStyle(0xff3333);
        g.fillTriangle(0, 16, 10, 0, 20, 16);
        g.fillTriangle(20, 16, 30, 0, 40, 16);
        g.fillTriangle(40, 16, 50, 0, 60, 16);
        g.fillStyle(0xaa1111);
        g.fillTriangle(10, 16, 20, 4, 30, 16);
        g.fillTriangle(30, 16, 40, 4, 50, 16);
        g.generateTexture('spike', 60, 16); g.clear();
        // Enemies - Red (can't stomp)
        g.clear(); g.fillStyle(0xff3333); g.fillCircle(12, 12, 12);
        g.fillStyle(0xcc0000); g.fillCircle(12, 12, 8);
        g.fillStyle(0x000000); g.fillCircle(7, 9, 3); g.fillCircle(17, 9, 3);
        g.fillStyle(0xff8888); g.fillCircle(7, 8, 1.5); g.fillCircle(17, 8, 1.5);
        g.fillStyle(0xff0000); g.fillTriangle(4, 0, 12, 5, 0, 5);
        g.fillTriangle(20, 0, 24, 5, 12, 5);
        g.generateTexture('enemy_red', 24, 24); g.clear();
        // Enemies - White (stompable)
        g.fillStyle(0xeeeeff); g.fillCircle(12, 12, 12);
        g.fillStyle(0xccccdd); g.fillCircle(12, 12, 8);
        g.fillStyle(0x4444aa); g.fillCircle(7, 9, 3); g.fillCircle(17, 9, 3);
        g.fillStyle(0xffffff); g.fillCircle(7, 8, 1.5); g.fillCircle(17, 8, 1.5);
        g.generateTexture('enemy_white', 24, 24); g.clear();
        // Enemies - Hunter (purple, chases player)
        g.fillStyle(0xcc44ff); g.fillCircle(12, 12, 12);
        g.fillStyle(0x9922cc); g.fillCircle(12, 12, 8);
        g.fillStyle(0x000000); g.fillCircle(7, 8, 3.5); g.fillCircle(17, 8, 3.5);
        g.fillStyle(0xff00ff); g.fillCircle(7, 8, 2); g.fillCircle(17, 8, 2);
        g.fillStyle(0xaa33ee); g.fillTriangle(12, 20, 6, 26, 18, 26);
        g.generateTexture('enemy_hunter', 24, 28); g.clear();
        // Bullet
        g.fillStyle(0xffff00); g.fillCircle(4, 4, 4);
        g.fillStyle(0xffaa00); g.fillCircle(4, 4, 2);
        g.generateTexture('bullet', 8, 8); g.clear();
        // Muzzle flash
        g.fillStyle(0xffff88, 0.8); g.fillCircle(8, 8, 8);
        g.fillStyle(0xffffff, 0.5); g.fillCircle(8, 8, 4);
        g.generateTexture('muzzle_flash', 16, 16); g.clear();
        // Goal
        g.fillStyle(0xffdd00); g.fillRect(0, 0, 60, 12);
        g.fillStyle(0xffaa00); g.fillTriangle(30, 0, 15, 12, 45, 12);
        g.generateTexture('goal', 60, 12); g.clear();
        // XP orb
        g.fillStyle(0x00ff88); g.fillCircle(6, 6, 6);
        g.fillStyle(0xaaffcc); g.fillCircle(4, 4, 2);
        g.generateTexture('xp_orb', 12, 12); g.clear();
        // Attack effect
        g.fillStyle(0xffffff, 0.7); g.fillCircle(16, 16, 16);
        g.generateTexture('atk_fx', 32, 32); g.clear();
        // Particle
        g.fillStyle(0xffffff); g.fillCircle(3, 3, 3);
        g.generateTexture('particle', 6, 6); g.clear();
        // BG tile
        g.fillStyle(0x0a0a14); g.fillRect(0, 0, 480, 60);
        g.lineStyle(1, 0x151525); g.strokeRect(0, 0, 480, 60);
        g.generateTexture('bg_tile', 480, 60); g.clear();
        g.destroy();
        this.scene.start('Menu');
    }
}

// --- MenuScene ---
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        const cx = 240, cy = 360;
        // Title
        this.add.text(cx, 100, 'ABYSS FALL', {
            fontSize: '52px', fontFamily: 'Orbitron, sans-serif',
            color: '#00ddff', fontStyle: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#00ddff', 12);
        this.add.text(cx, 155, '垂直落下型ローグライク・アクション', {
            fontSize: '14px', fontFamily: 'sans-serif', color: '#6688aa'
        }).setOrigin(0.5);
        // Floating particles
        for (let i = 0; i < 30; i++) {
            const p = this.add.circle(
                Phaser.Math.Between(0, 480), Phaser.Math.Between(0, 720),
                Phaser.Math.Between(1, 3), 0x00ddff, 0.3
            );
            this.tweens.add({
                targets: p, y: p.y - 100, alpha: 0, duration: Phaser.Math.Between(2000, 5000),
                repeat: -1, yoyo: true
            });
        }
        // Buttons
        this.createBtn(cx, 300, 'NORMAL モード', '#00cc88', () => { GameState.mode = 'NORMAL'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 340, '死亡時：アイテム消失、レベル維持', { fontSize: '11px', color: '#558866' }).setOrigin(0.5);
        this.createBtn(cx, 400, 'HARD モード', '#ff4466', () => { GameState.mode = 'HARD'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 440, '死亡時：全てリセット', { fontSize: '11px', color: '#885566' }).setOrigin(0.5);
        this.createBtn(cx, 520, '📖 図鑑', '#8866ff', () => { this.scene.start('Collection'); });
        // Info
        this.add.text(cx, 650, '操作: ← → 移動 / SPACE ガンブーツ発射', { fontSize: '12px', color: '#445566' }).setOrigin(0.5);
        this.add.text(cx, 670, '白い敵は踏んで倒せる / 赤い敵は弾で倒す', { fontSize: '11px', color: '#445566' }).setOrigin(0.5);
        this.add.text(cx, 690, `最高レベル記録: Lv.${GameState.level}`, { fontSize: '12px', color: '#445566' }).setOrigin(0.5);
    }
    createBtn(x, y, text, color, cb) {
        const bg = this.add.rectangle(x, y, 260, 48, Phaser.Display.Color.HexStringToColor(color).color, 0.15)
            .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color).setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, text, { fontSize: '20px', fontFamily: 'sans-serif', color: color, fontStyle: 'bold' }).setOrigin(0.5);
        bg.on('pointerover', () => { bg.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.3); });
        bg.on('pointerout', () => { bg.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color, 0.15); });
        bg.on('pointerdown', cb);
    }
}

// --- GameScene ---
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
        this.stageHeight = 3000 + GameState.currentStage * 400;
        this.physics.world.setBounds(0, 0, 480, this.stageHeight);
        this.cameras.main.setBounds(0, 0, 480, this.stageHeight);
        this.cameras.main.setBackgroundColor('#0a0a14');
        // BG
        for (let y = 0; y < this.stageHeight; y += 60) {
            this.add.image(240, y + 30, 'bg_tile').setAlpha(0.5);
            if (Math.random() < 0.15) {
                this.add.circle(Phaser.Math.Between(20, 460), y + Phaser.Math.Between(0, 60),
                    Phaser.Math.Between(1, 2), 0x00ddff, 0.15);
            }
        }
        // Depth indicator lines
        for (let y = 0; y < this.stageHeight; y += 300) {
            this.add.text(460, y, `${Math.floor(y / 30)}m`, { fontSize: '9px', color: '#223344' }).setOrigin(1, 0);
        }
        // Platforms
        this.platforms = this.physics.add.staticGroup();
        this.spikeGroup = this.physics.add.staticGroup();
        this.generatePlatforms();
        // Goal
        this.goal = this.physics.add.staticImage(240, this.stageHeight - 96, 'goal').setScale(4, 2).refreshBody();
        this.goal.body.setSize(300, 80).setOffset(-90, -30);
        this.add.text(240, this.stageHeight - 130, '⬇ GOAL ⬇', { fontSize: '22px', color: '#ffdd00', fontStyle: 'bold' }).setOrigin(0.5);
        // Enemies
        this.enemyGroup = this.physics.add.group();
        this.spawnEnemies();
        // XP orbs
        this.xpOrbs = this.physics.add.group();
        // Bullets
        this.bullets = this.physics.add.group();
        // Player
        this.player = this.physics.add.sprite(240, 80, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(300 * GameState.getFallMod());
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
        this.cameras.main.startFollow(this.player, false, 0.1, 0.3, 0, -150);
        this.autoScrollY = 0;
        this.baseScrollSpeed = 15 + GameState.getDifficulty() * 8 + GameState.currentStage * 2;
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
        const stTxt = this.add.text(240, 360, `Stage ${GameState.currentStage}\n${diff}`, {
            fontSize: '32px', fontFamily: 'sans-serif', color: '#00ddff', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.tweens.add({ targets: stTxt, alpha: 0, y: 300, duration: 2000, delay: 800, onComplete: () => stTxt.destroy() });
    }

    generatePlatforms() {
        const spacing = Math.max(100, 140 - GameState.getDifficulty() * 10);
        // Start platform
        this.addPlatform(240, 120, 3);
        let y = 120 + spacing;
        while (y < this.stageHeight - 200) {
            const x = Phaser.Math.Between(60, 420);
            const spikeChance = 0.18 + GameState.getDifficulty() * 0.06;
            if (Math.random() < spikeChance) {
                this.addSpike(x, y, Phaser.Math.Between(1, 2));
            } else {
                this.addPlatform(x, y, Phaser.Math.Between(1, 3));
            }
            // たまに追加の足場
            if (Math.random() < 0.25) {
                const x2 = Phaser.Math.Between(60, 420);
                this.addPlatform(x2, y + Phaser.Math.Between(-15, 15), Phaser.Math.Between(1, 2));
            }
            y += Phaser.Math.Between(Math.floor(spacing * 0.8), Math.floor(spacing * 1.4));
        }
        // Goal platform
        this.addPlatform(240, this.stageHeight - 80, 4);
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
                const hx = Phaser.Math.Between(40, 440);
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
        const camBottom = this.cameras.main.scrollY + 750;
        if (camBottom > this.stageHeight - 100) return;
        const x = Phaser.Math.Between(40, 440);
        const isRed = Math.random() < (0.4 + diff * 0.1);
        this.createEnemy(x, camBottom, isRed, 'interceptor', null);
    }

    setupTouchControls() {
        // Left zone
        const lz = this.add.rectangle(80, 650, 150, 90, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(80, 650, '◀', { fontSize: '28px', color: '#00ddff' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.5);
        lz.on('pointerdown', () => this.touchDir = -1); lz.on('pointerup', () => { if (this.touchDir === -1) this.touchDir = 0; });
        lz.on('pointerout', () => { if (this.touchDir === -1) this.touchDir = 0; });
        // Right zone
        const rz = this.add.rectangle(240, 650, 150, 90, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(240, 650, '▶', { fontSize: '28px', color: '#00ddff' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.5);
        rz.on('pointerdown', () => this.touchDir = 1); rz.on('pointerup', () => { if (this.touchDir === 1) this.touchDir = 0; });
        rz.on('pointerout', () => { if (this.touchDir === 1) this.touchDir = 0; });
        // Shoot zone (Gun Boot)
        const az = this.add.rectangle(400, 650, 150, 90, 0xffaa00, 0.12).setScrollFactor(0).setDepth(50).setInteractive();
        this.add.text(400, 650, '💥', { fontSize: '28px' }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setAlpha(0.7);
        az.on('pointerdown', () => this.touchAtk = true); az.on('pointerup', () => this.touchAtk = false);
    }

    createUI() {
        this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        // BG bar
        this.uiContainer.add(this.add.rectangle(240, 22, 480, 44, 0x000000, 0.75).setScrollFactor(0));
        // HP
        this.hpBg = this.add.rectangle(100, 14, 160, 10, 0x333333).setScrollFactor(0);
        this.hpBar = this.add.rectangle(21, 14, 158, 8, 0x00ff66).setScrollFactor(0).setOrigin(0, 0.5);
        this.hpText = this.add.text(100, 14, '', { fontSize: '9px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
        this.uiContainer.add([this.hpBg, this.hpBar, this.hpText]);
        // Ammo display
        this.ammoText = this.add.text(210, 10, '', { fontSize: '13px', color: '#ffaa00', fontStyle: 'bold' }).setScrollFactor(0);
        this.uiContainer.add(this.ammoText);
        // Stage & Level
        this.stageText = this.add.text(10, 30, '', { fontSize: '10px', color: '#aabbcc' }).setScrollFactor(0);
        this.levelText = this.add.text(310, 10, '', { fontSize: '11px', color: '#00ddff' }).setScrollFactor(0);
        this.xpBg = this.add.rectangle(410, 14, 80, 8, 0x222233).setScrollFactor(0);
        this.xpBar = this.add.rectangle(371, 14, 0, 6, 0x00ddff).setScrollFactor(0).setOrigin(0, 0.5);
        this.diffText = this.add.text(470, 30, '', { fontSize: '10px', color: '#ffaa00' }).setScrollFactor(0).setOrigin(1, 0);
        this.uiContainer.add([this.stageText, this.levelText, this.xpBg, this.xpBar, this.diffText]);
    }
    updateUI() {
        const hpRatio = GameState.hp / GameState.maxHp;
        this.hpBar.setScale(hpRatio, 1);
        this.hpBar.setFillStyle(hpRatio > 0.5 ? 0x00ff66 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333);
        this.hpText.setText(`${GameState.hp}/${GameState.maxHp}`);
        // Ammo
        let ammoStr = '';
        for (let i = 0; i < this.maxAmmo; i++) ammoStr += i < this.ammo ? '●' : '○';
        this.ammoText.setText(`弾 ${ammoStr}`);
        this.ammoText.setColor(this.ammo > 0 ? '#ffaa00' : '#ff3333');
        this.stageText.setText(`Stage ${GameState.currentStage} | ${GameState.getDifficultyLabel()}`);
        this.levelText.setText(`Lv.${GameState.level}`);
        const xpRatio = GameState.xp / GameState.xpToNext;
        this.xpBar.setScale(Math.min(xpRatio * 78, 78), 1);
        this.xpBar.width = xpRatio * 78;
        this.diffText.setText(`ATK:${GameState.getAtk()}`);
    }

    update(time, delta) {
        if (this.goalReached) return;
        const dt = delta / 1000;
        // Auto scroll
        this.autoScrollY += this.baseScrollSpeed * dt;
        const camY = this.cameras.main.scrollY;
        if (camY < this.autoScrollY) this.cameras.main.scrollY = this.autoScrollY;
        // Death by scroll
        if (this.player.y < this.cameras.main.scrollY - 30) { this.playerDeath(); return; }
        // Ground check for ammo reload
        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (onGround && !this.wasOnGround) {
            this.reloadAmmo();
        }
        this.wasOnGround = onGround;
        // Movement
        let vx = 0;
        const spd = GameState.getSpd();
        if (this.cursors.left.isDown || this.keyA.isDown || this.touchDir === -1) { vx = -spd; this.player.facingRight = false; this.player.setFlipX(true); }
        else if (this.cursors.right.isDown || this.keyD.isDown || this.touchDir === 1) { vx = spd; this.player.facingRight = true; this.player.setFlipX(false); }
        this.player.setVelocityX(vx);
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
        // Create bullet(s) going downward
        for (let h = 0; h < hits; h++) {
            const offsetX = hits > 1 ? (h === 0 ? -6 : 6) : 0;
            const b = this.bullets.create(this.player.x + offsetX, this.player.y + 18, 'bullet');
            b.setVelocityY(400);
            b.body.setGravityY(-300); // Cancel world gravity for bullets
            b.damage = atk;
            b.setDepth(5);
        }
        // Recoil - slow down falling / push upward
        const recoilForce = -120 - (GameState.hasEffect('antiGravity') ? 40 : 0);
        this.player.setVelocityY(Math.min(this.player.body.velocity.y + recoilForce, recoilForce));
        // Muzzle flash effect
        const flash = this.add.image(this.player.x, this.player.y + 20, 'muzzle_flash').setScale(1.5).setAlpha(0.9).setDepth(9);
        this.tweens.add({ targets: flash, scale: 0.3, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
        // Screen shake (subtle)
        this.cameras.main.shake(40, 0.003);
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
        // Reload on landing (handled in update via ground check)
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
        // Death particles
        for (let i = 0; i < 6; i++) {
            const p = this.add.circle(e.x + Phaser.Math.Between(-10, 10), e.y + Phaser.Math.Between(-10, 10), 3, e.eData.color);
            this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-30, 30), y: p.y - Phaser.Math.Between(10, 40), alpha: 0, duration: 400, onComplete: () => p.destroy() });
        }
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
                this.player.invTime = 1.0;
                this.player.setVelocityY(-200);
                this.cameras.main.shake(100, 0.015);
                this.cameras.main.flash(100, 255, 0, 0);
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
            this.player.invTime = 1.0;
            this.cameras.main.shake(100, 0.01);
            const dir = player.x < enemy.x ? -1 : 1;
            player.setVelocity(dir * 150, -100);
            if (GameState.hp <= 0) this.playerDeath();
        }
    }

    onGoal(player, goal) {
        if (this.goalReached) return;
        this.goalReached = true;
        // Stage heal effect
        if (GameState.hasEffect('stageHeal')) {
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + Math.floor(GameState.getEffectVal('stageHeal')));
        }
        this.cameras.main.flash(500, 255, 221, 0);
        this.time.delayedCall(600, () => {
            GameState.currentStage++;
            this.scene.start('ItemSelect');
        });
    }

    onSpikeHit(player, spike) {
        if (this.player.invTime > 0) return;
        const dmg = 15 + GameState.getDifficulty() * 5;
        GameState.takeDamage(dmg);
        this.player.invTime = 1.0;
        this.player.setVelocityY(-180);
        this.cameras.main.shake(80, 0.008);
        this.cameras.main.flash(150, 255, 50, 50);
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
        this.add.text(240, 60, `Stage ${GameState.currentStage - 1} クリア！`, {
            fontSize: '28px', color: '#ffdd00', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(240, 100, 'アイテムを1つ選択してください', { fontSize: '14px', color: '#8899aa' }).setOrigin(0.5);
        const items = GameState.rollItems(3);
        items.forEach((item, i) => {
            const x = 90 + i * 150, y = 300;
            const rc = RARITY_CONFIG[item.rarity];
            const col = Phaser.Display.Color.HexStringToColor(rc.color).color;
            const card = this.add.rectangle(x, y, 130, 220, 0x111122, 0.9).setStrokeStyle(2, col).setInteractive({ useHandCursor: true });
            this.add.text(x, y - 85, item.icon, { fontSize: '36px' }).setOrigin(0.5);
            this.add.text(x, y - 45, item.name, { fontSize: '13px', color: rc.color, fontStyle: 'bold', wordWrap: { width: 120 }, align: 'center' }).setOrigin(0.5);
            this.add.text(x, y - 15, rc.label, { fontSize: '10px', color: rc.color }).setOrigin(0.5);
            this.add.text(x, y + 15, item.description, { fontSize: '10px', color: '#aabbcc', wordWrap: { width: 110 }, align: 'center' }).setOrigin(0.5);
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
            this.add.text(240, 460, '所持アイテム', { fontSize: '12px', color: '#667788' }).setOrigin(0.5);
            const itemStr = GameState.items.map(i => i.icon + i.name).join('  ');
            this.add.text(240, 485, itemStr, { fontSize: '11px', color: '#556677', wordWrap: { width: 440 }, align: 'center' }).setOrigin(0.5);
        }
        // Stats
        this.add.text(240, 560, `Lv.${GameState.level} | HP:${GameState.hp}/${GameState.maxHp} | ATK:${GameState.getAtk()} | Luck:${GameState.luck}`, {
            fontSize: '12px', color: '#556677'
        }).setOrigin(0.5);
    }
}

// --- GameOverScene ---
class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    create() {
        this.cameras.main.setBackgroundColor('#0a0a14');
        this.add.text(240, 120, 'GAME OVER', { fontSize: '48px', color: '#ff3344', fontStyle: 'bold', fontFamily: 'Orbitron, sans-serif' }).setOrigin(0.5).setShadow(0, 0, '#ff0000', 8);
        this.add.text(240, 200, `到達ステージ: ${GameState.currentStage}`, { fontSize: '18px', color: '#aabbcc' }).setOrigin(0.5);
        this.add.text(240, 235, `プレイヤーレベル: ${GameState.level}`, { fontSize: '16px', color: '#00ddff' }).setOrigin(0.5);
        this.add.text(240, 265, `難易度: ${GameState.getDifficultyLabel()}`, { fontSize: '14px', color: '#ffaa00' }).setOrigin(0.5);
        this.add.text(240, 295, `モード: ${GameState.mode}`, { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        const retryLabel = GameState.mode === 'HARD' ? 'リトライ（全リセット）' : 'リトライ（レベル維持）';
        // Retry button
        this.createBtn(240, 400, retryLabel, '#00cc88', () => {
            GameState.reset(GameState.mode === 'HARD');
            this.scene.start('Game');
        });
        // Menu button
        this.createBtn(240, 470, 'タイトルへ戻る', '#5588ff', () => {
            GameState.reset(GameState.mode === 'HARD');
            this.scene.start('Menu');
        });
    }
    createBtn(x, y, text, color, cb) {
        const c = Phaser.Display.Color.HexStringToColor(color).color;
        const bg = this.add.rectangle(x, y, 280, 48, c, 0.15).setStrokeStyle(2, c).setInteractive({ useHandCursor: true });
        this.add.text(x, y, text, { fontSize: '18px', color: color, fontStyle: 'bold' }).setOrigin(0.5);
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
        this.add.text(240, 35, '📖 アイテム図鑑', { fontSize: '24px', color: '#00ddff', fontStyle: 'bold' }).setOrigin(0.5);
        const collected = GameState.collection.length;
        this.add.text(240, 65, `${collected} / ${ITEMS_DATA.length} 収集済み`, { fontSize: '13px', color: '#667788' }).setOrigin(0.5);
        // Scroll container
        const startY = 95;
        const itemH = 55;
        ITEMS_DATA.forEach((item, idx) => {
            const y = startY + idx * itemH;
            const owned = GameState.collection.includes(item.id);
            const rc = RARITY_CONFIG[item.rarity];
            const col = owned ? Phaser.Display.Color.HexStringToColor(rc.color).color : 0x333344;
            this.add.rectangle(240, y + 20, 440, 48, 0x111122, 0.8).setStrokeStyle(1, col);
            if (owned) {
                this.add.text(35, y + 12, item.icon, { fontSize: '22px' });
                this.add.text(65, y + 8, item.name, { fontSize: '13px', color: rc.color, fontStyle: 'bold' });
                this.add.text(65, y + 26, item.description, { fontSize: '10px', color: '#889999' });
                this.add.text(430, y + 8, rc.label, { fontSize: '9px', color: rc.color }).setOrigin(1, 0);
            } else {
                this.add.text(35, y + 12, '❓', { fontSize: '22px' });
                this.add.text(65, y + 16, '？？？', { fontSize: '13px', color: '#444455' });
            }
        });
        // Enable camera scroll for long list
        const totalH = startY + ITEMS_DATA.length * itemH + 60;
        this.cameras.main.setBounds(0, 0, 480, Math.max(720, totalH));
        this.input.on('pointermove', (p) => {
            if (p.isDown) this.cameras.main.scrollY -= (p.y - p.prevPosition.y);
        });
        // Back button
        const backBtn = this.add.text(240, totalH - 30, '← タイトルへ戻る', {
            fontSize: '16px', color: '#5588ff', fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.scene.start('Menu'));
    }
}

// --- Phaser Config ---
const config = {
    type: Phaser.AUTO,
    width: 480, height: 720,
    parent: 'game-container',
    backgroundColor: '#0a0a14',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 300 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, GameScene, ItemSelectScene, GameOverScene, CollectionScene]
};
const game = new Phaser.Game(config);
