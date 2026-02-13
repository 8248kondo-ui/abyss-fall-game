// --- ゲーム状態管理 ---
const GameState = {
    mode: 'NORMAL', level: 1, xp: 0, xpToNext: 100, luck: 0, score: 0,
    currentStage: 1, hp: 100, maxHp: 100, attack: 10,
    moveSpeed: 450, items: [], shieldCount: 0,
    reviveAvailable: false, fullReviveAvailable: false,
    collection: (() => {
        try {
            return JSON.parse(localStorage.getItem('abyssCollection') || '[]');
        } catch (e) {
            console.warn('LocalStorage access blocked, using memory fallback');
            return [];
        }
    })(),

    reset(full) {
        if (full) { this.level = 1; this.xp = 0; this.xpToNext = 100; this.luck = 0; this.score = 0; }
        this.currentStage = 1; this.hp = 100; this.maxHp = 100;
        this.attack = 10; this.moveSpeed = 450; this.items = [];
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
            try {
                localStorage.setItem('abyssCollection', JSON.stringify(this.collection));
            } catch (e) {
                console.error('Failed to save collection to LocalStorage:', e);
            }
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
        // Player (Reduced to ~0.7x: 32x44)
        g.clear(); g.fillStyle(0x00ddff); g.fillRoundedRect(0, 0, 32, 44, 6);
        g.fillStyle(0x0099cc); g.fillRect(6, 10, 8, 8); g.fillRect(18, 10, 8, 8);
        g.generateTexture('player', 32, 44); g.clear();
        // Platforms (Optimized for 400w)
        g.fillStyle(0x556677); g.fillRoundedRect(0, 0, 120, 24, 4);
        g.generateTexture('platform', 120, 24); g.clear();
        // Spikes
        g.fillStyle(0xff3333); g.fillTriangle(0, 24, 15, 0, 30, 24); g.fillTriangle(30, 24, 45, 0, 60, 24);
        g.generateTexture('spike', 60, 24); g.clear();
        // Enemies (Reduced to 32x32)
        g.clear(); g.fillStyle(0xff3333); g.fillCircle(16, 16, 16);
        g.generateTexture('enemy_red', 32, 32); g.clear();
        g.fillStyle(0xeeeeff); g.fillCircle(16, 16, 16);
        g.generateTexture('enemy_white', 32, 32); g.clear();
        g.fillStyle(0xcc44ff); g.fillCircle(16, 16, 16);
        g.generateTexture('enemy_hunter', 32, 32); g.clear();
        // Warning Icon
        g.lineStyle(4, 0xff0000); g.strokeCircle(20, 20, 18);
        g.fillStyle(0xff0000); g.fillRect(18, 8, 4, 15); g.fillCircle(20, 28, 3);
        g.generateTexture('warning', 40, 40); g.clear();
        // Bullet (0.5x of player, semi-transparent)
        g.fillStyle(0xffff00, 0.75); g.fillCircle(10, 10, 10);
        g.generateTexture('bullet', 20, 20); g.clear();
        // Shell casing
        g.fillStyle(0xddaa44); g.fillRect(0, 0, 3, 6);
        g.generateTexture('shell', 3, 6); g.clear();
        // Spark particle
        g.fillStyle(0xffcc00); g.fillCircle(2, 2, 2);
        g.generateTexture('spark', 4, 4); g.clear();
        // Speed line
        g.fillStyle(0xffffff, 0.4); g.fillRect(0, 0, 2, 40);
        g.generateTexture('speed_line', 2, 40); g.clear();
        // Muzzle flash (Larger for giant bullets)
        g.fillStyle(0xffff88, 0.9); g.fillCircle(32, 32, 32);
        g.fillStyle(0xffffff, 0.6); g.fillCircle(32, 32, 16);
        g.generateTexture('muzzle_flash', 64, 64); g.clear();
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
        g.fillStyle(0x0a0a14); g.fillRect(0, 0, 400, 80);
        g.lineStyle(1, 0x151525); g.strokeRect(0, 0, 400, 80);
        g.generateTexture('bg_tile', 400, 80); g.clear();
        g.destroy();
        this.scene.start('Menu');
    }
}

// --- MenuScene ---
class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        this.cameras.main.setBackgroundColor('#050510');
        const cx = 240, cy = 400; // Center for 800 height
        // Title
        this.add.text(cx, 120, 'ABYSS FALL', {
            fontSize: '56px', fontFamily: 'Orbitron, sans-serif',
            color: '#00ddff', fontStyle: 'bold'
        }).setOrigin(0.5).setShadow(0, 0, '#00ddff', 20);

        this.add.text(cx, 180, '垂直落下型ローグライク・究極進化', {
            fontSize: '16px', fontFamily: 'sans-serif', color: '#6688aa'
        }).setOrigin(0.5);

        // Buttons (Adjusted for 800h)
        this.createBtn(cx, 350, 'NORMAL モード', '#00cc88', () => { GameState.mode = 'NORMAL'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 390, '死亡時：アイテム消失、レベル維持', { fontSize: '13px', color: '#558866' }).setOrigin(0.5);

        this.createBtn(cx, 480, 'HARD モード', '#ff4466', () => { GameState.mode = 'HARD'; GameState.reset(true); this.scene.start('Game'); });
        this.add.text(cx, 520, '死亡時：全てリセット', { fontSize: '13px', color: '#885566' }).setOrigin(0.5);

        // Info
        this.add.text(cx, 680, '操作: ← → 移動 / SPACE 射撃', { fontSize: '14px', color: '#445566' }).setOrigin(0.5);
        this.add.text(cx, 710, `最高レベル記録: Lv.${GameState.level}`, { fontSize: '14px', color: '#445566' }).setOrigin(0.5);
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
        this.physics.world.setBounds(0, 0, 400, this.stageHeight);
        this.cameras.main.setBounds(0, 0, 400, this.stageHeight);
        this.cameras.main.setBackgroundColor('#000000');
        // BG
        for (let y = 0; y < this.stageHeight; y += 80) {
            this.add.image(200, y + 40, 'bg_tile').setAlpha(0.35);
        }
        // Platforms
        this.platforms = this.physics.add.staticGroup();
        this.spikeGroup = this.physics.add.staticGroup();
        this.generatePlatforms();
        // Goal
        this.goal = this.physics.add.staticImage(200, this.stageHeight - 100, 'goal').setScale(4, 2).refreshBody();
        this.goal.body.setSize(400, 100);
        // Player
        this.player = this.physics.add.sprite(200, 120, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setMaxVelocity(350, 600); // Strict Terminal Velocity
        this.player.body.setGravityY(500);
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
        this.cameras.main.startFollow(this.player, false, 0.1, 0.3, 0, -200);
        this.cameras.main.setZoom(1.0); // Reset zoom for clarity at 480x800
        this.autoScrollY = 0;
        this.baseScrollSpeed = 22 + GameState.getDifficulty() * 12 + GameState.currentStage * 3;
        this.dynamicAccel = 0;
        this.stageTime = 0;
        this.combo = 0;
        this.interceptorTimer = 0;
        this.interceptorInterval = Math.max(1.5, 4 - GameState.getDifficulty() * 0.5);
        this.goalReached = false;
        this.offScreenTimer = 0;

        // Setup UI Camera
        this.uiCamera = this.cameras.add(0, 0, 400, 700);
        this.uiCamera.setScroll(0, 0);
        this.uiCamera.setZoom(1);
        this.uiCamera.setDepth(100);
        this.cameras.main.ignore([this.uiContainer, this.uiGfx]);

        // Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // UI Graphics and Group
        this.uiGfx = this.add.graphics();
        this.warnings = this.add.group();
        this.createUI();

        // Safe Zone / Start state
        this.safeStartTimer = 3.0; // 3 seconds safety

        // Final depth text (200 is center of 400)
        const diffLabel = GameState.getDifficultyLabel();
        const stTxt = this.add.text(200, 350, `Stage ${GameState.currentStage}\n${diffLabel}`, {
            fontSize: '32px', fontFamily: 'Orbitron, sans-serif', color: '#00ddff', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
        this.tweens.add({ targets: stTxt, alpha: 0, scale: 1.5, duration: 2000, delay: 1000, onComplete: () => stTxt.destroy() });

        // IMPORTANT: Ignore HUD elements on main camera so they only show on UI camera
        this.cameras.main.ignore([this.uiContainer, this.uiGfx]);
        this.uiCamera.ignore([this.platforms, this.enemyGroup, this.player, this.bullets, this.spikeGroup]);

        this.speedLines = [];
    }

    generatePlatforms() {
        const spacing = Math.max(130, 180 - GameState.getDifficulty() * 12);
        this.addPlatform(360, 140, 3);
        let y = 140 + spacing;
        while (y < this.stageHeight - 400) {
            const x = Phaser.Math.Between(50, 350);
            const spikeChance = 0.2;
            if (Math.random() < spikeChance) {
                this.addSpike(x, y, 1);
            } else {
                this.addPlatform(x, y, Phaser.Math.Between(1.2, 2));
            }
            y += Phaser.Math.Between(160, 240); // Increased vertical spacing
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
        const baseRate = 0.6 + diff * 0.15; // Triple density approx

        this.platforms.children.iterate(p => {
            if (p.y < 1000 || p.y > this.stageHeight - 400) return; // 1000px Safe Zone
            if (Math.random() < 0.35) {
                this.createEnemy(p.x, p.y - 24, Math.random() < 0.3, 'patrol', p);
            }
        });

        // Hunters (Reduced count)
        const hunterCount = Math.floor(2 + diff * 2);
        for (let i = 0; i < hunterCount; i++) {
            this.createEnemy(Phaser.Math.Between(60, 420), Phaser.Math.Between(800, this.stageHeight - 400), true, 'hunter', null);
        }
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

        const pattern = Math.random();
        if (pattern < 0.7) {
            // Single spawn
            this.createEnemy(Phaser.Math.Between(60, 420), camBottom, Math.random() < 0.4, 'interceptor', null);
        } else if (pattern < 0.9) {
            // V-Formation
            const centerX = Phaser.Math.Between(100, 380);
            this.createEnemy(centerX, camBottom, true, 'interceptor', null);
            this.createEnemy(centerX - 40, camBottom + 40, false, 'interceptor', null);
            this.createEnemy(centerX + 40, camBottom + 40, false, 'interceptor', null);
        } else {
            // Horizontal Wall (Reduced width)
            for (let i = 0; i < 3; i++) {
                this.createEnemy(80 + i * 160, camBottom, i % 2 === 0, 'interceptor', null);
            }
        }
    }

    setupTouchControls() {
        // Left zone
        const lz = this.add.rectangle(100, 620, 150, 80, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        lz.on('pointerdown', () => this.touchDir = -1); lz.on('pointerup', () => this.touchDir = 0);
        // Right zone
        const rz = this.add.rectangle(250, 620, 150, 80, 0x00ddff, 0.08).setScrollFactor(0).setDepth(50).setInteractive();
        rz.on('pointerdown', () => this.touchDir = 1); rz.on('pointerup', () => this.touchDir = 0);
        // Shoot zone
        const az = this.add.rectangle(200, 400, 400, 800, 0x0, 0).setScrollFactor(0).setDepth(10).setInteractive();
        az.on('pointerdown', () => this.touchAtk = true); az.on('pointerup', () => this.touchAtk = false);
    }

    createUI() {
        this.uiContainer = this.add.container(0, 0).setDepth(200);
        // Strict Margin: 20px from top and sides (400 - 40 = 360 wide)
        this.uiContainer.add(this.add.rectangle(200, 35, 360, 50, 0x000000, 0.7).setStrokeStyle(1, 0x00ddff, 0.3));

        this.scoreLabel = this.add.text(200, 35, '0', { fontSize: '24px', fontFamily: 'Orbitron', color: '#ffffff' }).setOrigin(0.5);
        this.hpLabel = this.add.text(35, 25, 'HP', { fontSize: '14px', fontFamily: 'Orbitron', color: '#ff3366' });
        this.hpBarBgUI = this.add.rectangle(65, 35, 100, 10, 0x330011).setOrigin(0, 0.5);
        this.hpBarFillUI = this.add.rectangle(65, 35, 100, 10, 0xff3366).setOrigin(0, 0.5);

        this.comboLabel = this.add.text(365, 35, '', { fontSize: '20px', fontFamily: 'Orbitron', color: '#ffcc00' }).setOrigin(1, 0.5);
        this.uiContainer.add([this.scoreLabel, this.hpLabel, this.hpBarBgUI, this.hpBarFillUI, this.comboLabel]);

        // Floating HUD for player (retained but simplified)
        this.floatContainer = this.add.container(0, 0).setDepth(10);
        this.floatLevel = this.add.text(0, -55, 'Lv.1', { fontSize: '18px', color: '#00ddff', fontStyle: 'bold' }).setOrigin(0.5);
        this.floatContainer.add(this.floatLevel);

        // Ammo dots near player (still needed)
        this.floatAmmoText = this.add.text(0, 0, '', { fontSize: '10px', color: '#ffaa00', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(15);
        this.floatContainer.add(this.floatAmmoText);
    }
    updateUI() {
        this.scoreLabel.setText(`SCORE: ${GameState.score}`);
        if (this.combo > 1) {
            this.comboLabel.setText(`${this.combo} COMBO`).setScale(1 + Math.sin(this.time.now * 0.01) * 0.05);
        } else {
            this.comboLabel.setText('');
        }

        const hpRate = GameState.hp / GameState.maxHp;
        this.hpBarFillUI.width = 120 * hpRate;
        this.hpBarFillUI.setFillStyle(hpRate > 0.4 ? 0xff3366 : hpRate > 0.2 ? 0xffaa00 : 0xff0000);

        this.floatLevel.setText(`Lv.${GameState.level}`);

        this.floatContainer.setPosition(this.player.x, this.player.y);

        // Ammo dots near player
        let ammoStr = '';
        for (let i = 0; i < this.maxAmmo; i++) ammoStr += i < this.ammo ? '●' : '○';
        this.floatAmmoText.setPosition(0, -10); // Relative to floatContainer
        this.floatAmmoText.setText(ammoStr);
        this.floatAmmoText.setColor(this.ammo > 0 ? '#ffaa00' : '#ff3333');
    }

    update(time, delta) {
        if (this.goalReached || !this.player.active) return;
        const dt = delta / 1000;

        // 1. Safe Start Logic
        if (this.safeStartTimer > 0) {
            this.safeStartTimer -= dt;
            if (this.safeStartTimer <= 0) this.spawnEnemies();
            return;
        }

        // 2. Offscreen Performance Cleanup
        this.enemyGroup.children.each(e => {
            if (e.active && e.y < this.cameras.main.scrollY - 100) e.destroy();
        });
        this.bullets.children.each(b => {
            if (b.active && (b.y > this.cameras.main.scrollY + 1000 || b.y < this.cameras.main.scrollY - 200)) b.destroy();
        });

        this.stageTime += dt;
        this.dynamicAccel = Math.min(this.stageTime * 0.45, 25);
        const currentScrollSpeed = this.baseScrollSpeed + this.dynamicAccel;
        this.autoScrollY += currentScrollSpeed * dt;
        const camY = this.cameras.main.scrollY;
        if (camY < this.autoScrollY) this.cameras.main.scrollY = this.autoScrollY;

        // Enhanced death check for high recoil
        if (this.player.y < this.cameras.main.scrollY) {
            this.offScreenTimer += dt;
            if (this.offScreenTimer > 3.0) { this.playerDeath(); return; } // Shortened buffer
        } else {
            this.offScreenTimer = 0;
        }

        const fallSpeed = Math.abs(this.player.body.velocity.y);
        if (fallSpeed > 250) this.spawnSpeedLines(fallSpeed);

        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        if (onGround && !this.wasOnGround) {
            this.reloadAmmo();
            if (this.combo > 0) this.resetCombo();
        }
        this.wasOnGround = onGround;

        // Player movement
        let moveTarget = 0;
        if (this.cursors.left.isDown || this.keyA.isDown) moveTarget = -1;
        else if (this.cursors.right.isDown || this.keyD.isDown) moveTarget = 1;
        else if (this.touchDir !== 0) moveTarget = this.touchDir;

        const moveSpeed = 450 + (GameState.hasEffect('speedUp') ? 80 : 0);
        this.player.setVelocityX(moveTarget * moveSpeed);
        if (moveTarget !== 0) {
            this.player.facingRight = moveTarget > 0;
            this.player.setFlipX(moveTarget < 0);
        }

        // Shooting
        this.shootCooldown -= dt;
        const isShooting = Phaser.Input.Keyboard.JustDown(this.keySpace) || this.touchAtk;
        if (isShooting && this.ammo > 0 && this.shootCooldown <= 0) {
            this.shootGunBoot();
        }

        // Draw HUD Graphics
        this.drawCircularAmmo();
        this.updateEnemyWarnings();

        // Spawn interceptors more aggressively (Fixed double timer)
        this.interceptorTimer += dt;
        if (this.interceptorTimer > this.interceptorInterval / 3) {
            this.spawnInterceptor();
            if (Math.random() < 0.4) this.spawnInterceptor();
            this.interceptorTimer = 0;
        }
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
        // Interceptor spawner removed (Handled by aggressive logic above)
        /*
        this.interceptorTimer += dt;
        if (this.interceptorTimer >= this.interceptorInterval) {
            this.interceptorTimer = 0;
            this.spawnInterceptor();
        }
        */
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

    drawCircularAmmo() {
        this.uiGfx.clear();
        if (this.ammo <= 0) return;
        const x = this.player.x;
        const y = this.player.y + 45;
        const radius = 28;
        const startRad = -Math.PI / 2;
        const endRad = startRad + (Math.PI * 2 * (this.ammo / this.maxAmmo));

        this.uiGfx.lineStyle(6, 0x000000, 0.5);
        this.uiGfx.strokeCircle(x, y, radius);
        this.uiGfx.lineStyle(4, 0x00ddff, 0.8);
        this.uiGfx.beginPath();
        this.uiGfx.arc(x, y, radius, startRad, endRad, false);
        this.uiGfx.strokePath();
    }

    updateEnemyWarnings() {
        this.warnings.clear(true, true);
        const camBottom = this.cameras.main.scrollY + 700;
        let c = 0;
        this.enemyGroup.children.each(e => {
            if (c >= 3) return;
            if (e.active && e.y > camBottom && e.y < camBottom + 600) {
                this.add.image(e.x, 670, 'warning').setScrollFactor(0).setDepth(200).setTint(0xff3333).setScale(0.8);
                c++;
            }
        });
    }

    resetCombo() {
        this.combo = 0;
        this.updateUI();
    }

    addCombo() {
        this.combo++;
        const x = this.player.x + (this.player.facingRight ? -80 : 80);
        const txt = this.add.text(x, this.player.y - 40, `${this.combo} COMBO!`, {
            fontSize: '32px', fontFamily: 'Orbitron', color: '#ffdd00', fontStyle: 'bold', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(30);

        this.tweens.add({
            targets: txt,
            scale: 1.5,
            angle: Phaser.Math.Between(-10, 10),
            y: txt.y - 50,
            alpha: 0,
            duration: 800,
            onComplete: () => txt.destroy()
        });
        this.updateUI();
    }

    // --- Gun Boot System ---
    shootGunBoot() {
        if (this.ammo <= 0) return;
        this.ammo--;
        this.shootCooldown = 0.35;
        const b = this.bullets.create(this.player.x, this.player.y + 20, 'bullet');
        b.setVelocityY(600).setAlpha(0.6).setDepth(4); // Under player
        b.body.setGravityY(-600);
        b.body.setSize(20, 20);
        this.player.body.velocity.y = -350; // Moderate recoil

        // Visual effects
        const flash = this.add.image(this.player.x, this.player.y + 35, 'muzzle_flash').setScale(1.2).setAlpha(0.8).setDepth(5);
        this.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 150, onComplete: () => flash.destroy() });

        const shellDir = this.player.facingRight ? 1 : -1;
        const shell = this.add.image(this.player.x + shellDir * 10, this.player.y + 20, 'shell').setDepth(3);
        this.tweens.add({
            targets: shell,
            x: shell.x + shellDir * 40,
            y: shell.y - 20,
            angle: 360,
            alpha: 0, duration: 500,
            onComplete: () => shell.destroy()
        });

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
            // this.tweens.add({ targets: [this.floatHpBg, this.floatHpBar, this.floatAmmoText], y: '+=5', duration: 50, yoyo: true }); // Removed as per new UI
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
        // Apply combo multiplier to XP and Score
        const multiplier = 1 + (this.combo * 0.15);
        const xpGain = Math.floor(e.eData.xp * multiplier);
        const scoreGain = Math.floor(100 * multiplier);

        GameState.addXP(xpGain);
        GameState.score += scoreGain;

        if (GameState.hasEffect('lifeSteal')) {
            GameState.hp = Math.min(GameState.maxHp, GameState.hp + GameState.getEffectVal('lifeSteal'));
        }
        // Combo increment
        this.addCombo();

        // Spawn XP orb
        const orb = this.xpOrbs.create(e.x, e.y, 'xp_orb');
        orb.body.setGravityY(-250);
        this.tweens.add({ targets: orb, alpha: 0, duration: 3000, onComplete: () => orb.destroy() });
        // Death particles
        for (let i = 0; i < 12; i++) {
            const p = this.add.circle(e.x, e.y, Phaser.Math.Between(4, 7), e.eData.color);
            const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
            const speed = Phaser.Math.Between(150, 300);
            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: Phaser.Math.Between(400, 700), onComplete: () => p.destroy() });
        }
        // Ghost effect
        const ghost = this.add.image(e.x, e.y, e.texture.key).setTint(0xffffff).setAlpha(0.6).setScale(1.2);
        this.tweens.add({ targets: ghost, scale: 2.5, alpha: 0, duration: 250, onComplete: () => ghost.destroy() });
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
        this.resetCombo();
        this.cameras.main.shake(150, 0.015);
        this.cameras.main.flash(100, 255, 50, 50, true);
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

        for (let i = 0; i < 15; i++) {
            const p = this.add.image(this.player.x, this.player.y, 'spark').setTint(0xffffff).setScale(1.5);
            const ang = Phaser.Math.Between(0, 360) * (Math.PI / 180);
            const spd = Phaser.Math.Between(200, 450);
            this.physics.add.existing(p);
            p.body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
            this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 500, onComplete: () => p.destroy() });
        }

        // HUD impact
        this.tweens.add({ targets: [this.hpBarBgUI, this.hpBarFillUI, this.hpLabel], x: '+=10', duration: 50, yoyo: true, repeat: 3 });
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
    width: 400, height: 700,
    parent: 'game-container',
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 600 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 400, height: 700
    },
    scene: [BootScene, MenuScene, GameScene, ItemSelectScene, GameOverScene]
};
const game = new Phaser.Game(config);
