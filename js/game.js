// Abyss Fall - Core Rebuild (Minimal Foundation)
// Resolution: 450x800, Layering: UI(1000) > Player(100) > Enemy/Warning(50) > BG(0)

const GameState = {
    hp: 100,
    maxHp: 100,
    score: 0,
    level: 1,
    reset() {
        this.hp = 100;
        this.score = 0;
        this.level = 1;
    }
};

class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() { }
    create() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        // Player (Boxy)
        g.clear(); g.fillStyle(0x00ddff); g.fillRoundedRect(0, 0, 32, 44, 6);
        g.generateTexture('player', 32, 44);

        // Enemy (Simple circle)
        g.clear(); g.fillStyle(0xff3344); g.fillCircle(16, 16, 16);
        g.generateTexture('enemy', 32, 32);

        // Warning Icon (!)
        g.clear(); g.lineStyle(3, 0xff0000); g.strokeCircle(20, 20, 18);
        g.fillStyle(0xff0000); g.fillRect(18, 8, 4, 15); g.fillCircle(20, 28, 3);
        g.generateTexture('warning', 40, 40);

        // Platform
        g.clear(); g.fillStyle(0x445566); g.fillRect(0, 0, 150, 20);
        g.generateTexture('platform', 150, 20);

        // Bullet
        g.clear(); g.fillStyle(0xffff00); g.fillCircle(5, 5, 5);
        g.generateTexture('bullet', 10, 10);

        this.scene.start('Menu');
    }
}

class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        this.add.text(225, 200, 'ABYSS FALL', { fontSize: '48px', color: '#00ddff', fontStyle: 'bold' }).setOrigin(0.5);
        const startBtn = this.add.text(225, 400, 'START GAME', { fontSize: '24px', color: '#ffffff' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        startBtn.on('pointerdown', () => this.scene.start('Game'));
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
        GameState.reset();
        this.cameras.main.setBackgroundColor('#000000');

        // Physics Groups
        this.platforms = this.physics.add.staticGroup();
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.warnings = this.add.group();

        // Player
        this.player = this.physics.add.sprite(225, 150, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(100);
        this.player.body.setGravityY(600);
        this.player.body.setMaxVelocity(400, 700);

        // Base platform
        this.platforms.create(225, 250, 'platform');

        // Initial values
        this.scrollPos = 0;
        this.safeTimer = 5.0; // 5 seconds safe start
        this.spawnTimer = 0;

        // Controls
        this.cursors = this.input.keyboard.createCursorKeys();

        // UI Camera (Independent of world scroll)
        this.uiCamera = this.cameras.add(0, 0, 450, 800);
        this.uiCamera.setScroll(0, 10000); // Far away

        // UI Container
        this.uiContainer = this.add.container(225, 10030).setDepth(1000);
        this.scoreText = this.add.text(0, -10, 'SCORE: 0', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
        this.hpBarBg = this.add.rectangle(-100, 20, 200, 10, 0x333333).setOrigin(0, 0.5);
        this.hpBarFill = this.add.rectangle(-100, 20, 200, 10, 0x00ff00).setOrigin(0, 0.5);
        this.uiContainer.add([this.scoreText, this.hpBarBg, this.hpBarFill]);

        // Setup which camera sees what
        this.cameras.main.ignore(this.uiContainer);
        this.uiCamera.ignore([this.player, this.enemies, this.platforms, this.bullets]);

        // Colliders
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.overlap(this.player, this.enemies, this.onHit, null, this);
    }

    update(time, delta) {
        if (GameState.hp <= 0) return;
        const dt = delta / 1000;

        // 1. Safety & Spawning
        if (this.safeTimer > 0) {
            this.safeTimer -= dt;
            const t = Math.ceil(this.safeTimer);
            this.scoreText.setText(`READY: ${t}`);
        } else {
            this.scoreText.setText(`SCORE: ${GameState.score}`);
            this.spawnEnemyLogic(dt);
        }

        // 2. Movement
        const speed = 400;
        if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
        else if (this.cursors.right.isDown) this.player.setVelocityX(speed);
        else this.player.setVelocityX(0);

        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            this.shoot();
        }

        // 3. World Scroll
        this.scrollPos += 80 * dt;
        this.cameras.main.scrollY = this.scrollPos;
        this.player.y += 80 * dt; // Match camera drift

        // 4. Object Cleanup (VITAL)
        this.enemies.children.each(e => {
            if (e.y < this.cameras.main.scrollY - 100 || e.y > this.cameras.main.scrollY + 900) {
                e.destroy();
            }
        });
        this.bullets.children.each(b => {
            if (b.y < this.cameras.main.scrollY - 100 || b.y > this.cameras.main.scrollY + 900) {
                b.destroy();
            }
        });
        this.warnings.children.each(w => {
            if (w.y < this.cameras.main.scrollY - 100 || w.y > this.cameras.main.scrollY + 900) {
                w.destroy();
            }
        });

        // 5. HP Bar Update
        this.hpBarFill.width = 200 * (GameState.hp / GameState.maxHp);

        // Fall death
        if (this.player.y > this.cameras.main.scrollY + 850) {
            this.gameOver();
        }
    }

    spawnEnemyLogic(dt) {
        this.spawnTimer += dt;
        const currentEnemies = this.enemies.countActive();
        const currentWarnings = this.warnings.countActive();

        if (this.spawnTimer > 1.5 && currentEnemies < 5 && currentWarnings < 3) {
            const spawnX = Phaser.Math.Between(50, 400);
            const spawnY = this.cameras.main.scrollY + 850;

            // Warning first
            const warn = this.add.image(spawnX, this.cameras.main.scrollY + 760, 'warning').setDepth(50);
            this.warnings.add(warn);

            this.time.delayedCall(1200, () => {
                if (this.scene.isActive() && warn.active) {
                    warn.destroy();
                    const e = this.enemies.create(spawnX, spawnY, 'enemy');
                    e.setDepth(50);
                    e.setVelocityY(-150);
                }
            });
            this.spawnTimer = 0;
        }
    }

    shoot() {
        const b = this.bullets.create(this.player.x, this.player.y + 20, 'bullet');
        b.setVelocityY(600);
    }

    onHit(player, enemy) {
        enemy.destroy();
        GameState.hp -= 20;
        if (GameState.hp <= 0) this.gameOver();
    }

    gameOver() {
        this.scene.start('GameOver');
    }
}

class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    create() {
        this.add.text(225, 300, 'GAME OVER', { fontSize: '48px', color: '#ff0000' }).setOrigin(0.5);
        this.add.text(225, 400, 'PRESS TO RETRY', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
        this.input.on('pointerdown', () => this.scene.start('Menu'));
    }
}

const config = {
    type: Phaser.AUTO,
    width: 450, height: 800,
    parent: 'game-container',
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);
