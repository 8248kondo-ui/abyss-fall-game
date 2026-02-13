// =============================================
// アイテムデータ（全30種）
// =============================================
const ITEMS_DATA = [
    // ===== コモン (8種) =====
    {
        id: 1, name: 'ポーション',
        description: 'HPを30回復する',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'consumable', effect: 'heal', value: 30, icon: '🧪'
    },
    {
        id: 2, name: 'シールド',
        description: '次に受けるダメージを1回無効化',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'triggered', effect: 'shield', value: 1, icon: '🛡️'
    },
    {
        id: 3, name: 'スピードブーツ',
        description: '移動速度が15%上昇',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'passive', effect: 'spdUp', value: 0.15, icon: '👟'
    },
    {
        id: 4, name: '攻撃のお守り',
        description: '攻撃力+5',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'passive', effect: 'atkUp', value: 5, icon: '⚔️'
    },
    {
        id: 5, name: 'マグネット',
        description: 'XP吸収範囲が50%拡大',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'passive', effect: 'xpRange', value: 0.5, icon: '🧲'
    },
    {
        id: 6, name: 'ラッキーコイン',
        description: 'Luck+2',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'passive', effect: 'luckUp', value: 2, icon: '🪙'
    },
    {
        id: 7, name: '回復の指輪',
        description: 'ステージクリア時にHP15回復',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'triggered', effect: 'stageHeal', value: 15, icon: '💍'
    },
    {
        id: 8, name: '軽量マント',
        description: '落下速度が5%低下',
        rarity: 'common', rarityLabel: 'コモン',
        type: 'passive', effect: 'fallSlow', value: 0.05, icon: '🧣'
    },
    // ===== アンコモン (8種) =====
    {
        id: 9, name: '鉄の鎧',
        description: '最大HPが25増加',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'maxHpUp', value: 25, icon: '🪖'
    },
    {
        id: 10, name: 'ダブルストライク',
        description: '攻撃が2回ヒットする',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'doubleHit', value: 2, icon: '⚡'
    },
    {
        id: 11, name: 'エアブレーキ',
        description: '落下速度が15%低下',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'fallSlow', value: 0.15, icon: '🪂'
    },
    {
        id: 12, name: 'XPブースター',
        description: 'XP獲得量が30%増加',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'xpBoost', value: 0.3, icon: '📈'
    },
    {
        id: 13, name: 'フレイムソード',
        description: '攻撃に炎ダメージ+10を追加',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'flameDmg', value: 10, icon: '🔥'
    },
    {
        id: 14, name: 'アイスシールド',
        description: '被ダメージ時25%の確率で敵を凍結',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'freezeChance', value: 0.25, icon: '❄️'
    },
    {
        id: 15, name: 'ダッシュブーツ',
        description: '移動速度が30%上昇',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'spdUp', value: 0.30, icon: '💨'
    },
    {
        id: 16, name: 'タフネスリング',
        description: '最大HP+35、攻撃力-3',
        rarity: 'uncommon', rarityLabel: 'アンコモン',
        type: 'passive', effect: 'toughness', value: 35, icon: '🔵'
    },
    // ===== レア (6種) =====
    {
        id: 17, name: '狂戦士の斧',
        description: 'HP50%以下で攻撃力が2倍',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'berserker', value: 2, icon: '🪓'
    },
    {
        id: 18, name: '吸血の牙',
        description: '敵を倒すとHP5回復',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'lifeSteal', value: 5, icon: '🦷'
    },
    {
        id: 19, name: 'ミラーシールド',
        description: '30%の確率でダメージを反射',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'reflect', value: 0.30, icon: '🪞'
    },
    {
        id: 20, name: 'テレポートリング',
        description: '移動速度が大幅に上昇',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'spdUp', value: 0.60, icon: '🌀'
    },
    {
        id: 21, name: 'ゴールドラッシュ',
        description: 'アイテム抽選時のレアリティが上昇',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'rarityUp', value: 1, icon: '💰'
    },
    {
        id: 22, name: 'ウィンドウォーカー',
        description: '落下速度が25%低下し移動速度20%上昇',
        rarity: 'rare', rarityLabel: 'レア',
        type: 'passive', effect: 'windWalk', value: 0.25, icon: '🌬️'
    },
    // ===== エピック (4種) =====
    {
        id: 23, name: 'フェニックスの羽',
        description: '死亡時に1回だけHP50%で自動復活',
        rarity: 'epic', rarityLabel: 'エピック',
        type: 'triggered', effect: 'revive', value: 0.5, icon: '🔥'
    },
    {
        id: 24, name: '復活のオーブ',
        description: '死亡時にHP全回復で復活(1回)',
        rarity: 'epic', rarityLabel: 'エピック',
        type: 'triggered', effect: 'fullRevive', value: 1.0, icon: '🔮'
    },
    {
        id: 25, name: 'タイムスロウ',
        description: '敵の移動速度が35%低下',
        rarity: 'epic', rarityLabel: 'エピック',
        type: 'passive', effect: 'timeSlow', value: 0.35, icon: '⏳'
    },
    {
        id: 26, name: 'アンチグラビティ・コア',
        description: '落下速度が40%低下',
        rarity: 'epic', rarityLabel: 'エピック',
        type: 'passive', effect: 'antiGravity', value: 0.40, icon: '🌌'
    },
    // ===== レジェンダリー (4種) =====
    {
        id: 27, name: 'ドラゴンスケイル',
        description: '受けるダメージを50%カット',
        rarity: 'legendary', rarityLabel: 'レジェンダリー',
        type: 'passive', effect: 'damageReduce', value: 0.50, icon: '🐉'
    },
    {
        id: 28, name: '神殺しの剣',
        description: '攻撃力が3倍になる',
        rarity: 'legendary', rarityLabel: 'レジェンダリー',
        type: 'passive', effect: 'atkMult', value: 3, icon: '⚜️'
    },
    {
        id: 29, name: '虹のクリスタル',
        description: '全ステータスが25%上昇',
        rarity: 'legendary', rarityLabel: 'レジェンダリー',
        type: 'passive', effect: 'allStats', value: 0.25, icon: '💎'
    },
    {
        id: 30, name: 'ソウルコレクター',
        description: '倒した敵から得るXPが2倍',
        rarity: 'legendary', rarityLabel: 'レジェンダリー',
        type: 'passive', effect: 'soulCollect', value: 2, icon: '👻'
    }
];

// レアリティ設定
const RARITY_CONFIG = {
    common:    { label: 'コモン',       color: '#aaaaaa', weight: 50, glow: '#666666' },
    uncommon:  { label: 'アンコモン',   color: '#55cc55', weight: 30, glow: '#33aa33' },
    rare:      { label: 'レア',         color: '#5588ff', weight: 13, glow: '#3366dd' },
    epic:      { label: 'エピック',     color: '#bb55ff', weight: 5,  glow: '#9933dd' },
    legendary: { label: 'レジェンダリー', color: '#ffaa00', weight: 2, glow: '#dd8800' }
};

// 敵タイプ設定
const ENEMY_TYPES = {
    slime:    { name: 'スライム',   hp: 20,  damage: 10, xp: 15, speed: 30,  color: 0x44ff44, minDiff: 0 },
    bat:      { name: 'コウモリ',   hp: 15,  damage: 15, xp: 20, speed: 80,  color: 0x9944ff, minDiff: 1, flying: true },
    skeleton: { name: 'スケルトン', hp: 40,  damage: 20, xp: 30, speed: 50,  color: 0xdddddd, minDiff: 2 },
    golem:    { name: 'ゴーレム',   hp: 70,  damage: 30, xp: 50, speed: 25,  color: 0x886644, minDiff: 2 },
    dragon:   { name: 'ドラゴン',   hp: 100, damage: 40, xp: 80, speed: 40,  color: 0xff4444, minDiff: 3 }
};

// 難易度設定
const DIFFICULTY_LEVELS = ['EASY', 'NORMAL', 'HARD', 'EXTRA'];
