/**
 * 游戏模式抽象：统一模式 ID、规则与生命周期。
 * 复用同一套赛道 / 车辆 / 物理代码，仅通过规则配置改变目标与结算。
 */
export type GameModeId = 'race' | 'time-trial' | 'drift' | 'sandbox';

export interface GameModeRules {
  id: GameModeId;
  /** 模式卡片显示名 */
  name: string;
  /** 一句话目标 */
  tagline: string;
  /** 规则图标（AI / 道具 / 圈数）短标签 */
  meta: string;
  /** 卡片主色 */
  accent: string;
  /** 圈数；0 表示不限圈（漂移 / 沙盒） */
  laps: number;
  /** AI 对手数量（不含玩家） */
  aiCount: number;
  itemsEnabled: boolean;
  recordsBestLap: boolean;
  recordsDriftScore: boolean;
  /** 时间限制（秒）；漂移模式使用，0 表示不限时 */
  timeLimitSec: number;
  /** 是否推荐手柄 */
  controllerHint: 'keyboard' | 'gamepad' | 'both';
}

export const MODES: Record<GameModeId, GameModeRules> = {
  race: {
    id: 'race',
    name: '竞速赛 RACE',
    tagline: '与对手完成三圈道具竞速，率先冲线。',
    meta: '3 圈 · 3 AI · 道具开启',
    accent: '#ff4d5e',
    laps: 3,
    aiCount: 3,
    itemsEnabled: true,
    recordsBestLap: true,
    recordsDriftScore: false,
    timeLimitSec: 0,
    controllerHint: 'both',
  },
  'time-trial': {
    id: 'time-trial',
    name: '计时赛 TIME TRIAL',
    tagline: '没有道具和对手，追逐你的最快圈速。',
    meta: '3 圈 · 无 AI · 记录幽灵车',
    accent: '#5cf2e3',
    laps: 3,
    aiCount: 0,
    itemsEnabled: false,
    recordsBestLap: true,
    recordsDriftScore: false,
    timeLimitSec: 0,
    controllerHint: 'both',
  },
  drift: {
    id: 'drift',
    name: '漂移赛 DRIFT',
    tagline: '90 秒内持续漂移，累积连击与高分。',
    meta: '90 秒 · 无 AI · 漂移计分',
    accent: '#ffd23f',
    laps: 0,
    aiCount: 0,
    itemsEnabled: false,
    recordsBestLap: false,
    recordsDriftScore: true,
    timeLimitSec: 90,
    controllerHint: 'gamepad',
  },
  sandbox: {
    id: 'sandbox',
    name: '沙盒 SANDBOX',
    tagline: '自由驾驶、练习，没有输赢与计时。',
    meta: '自由驾驶 · 无计时 · 可随时换车',
    accent: '#38b6ff',
    laps: 0,
    aiCount: 0,
    itemsEnabled: false,
    recordsBestLap: false,
    recordsDriftScore: false,
    timeLimitSec: 0,
    controllerHint: 'both',
  },
};

export const MODE_ORDER: GameModeId[] = ['race', 'time-trial', 'drift', 'sandbox'];
