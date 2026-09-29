/**
 * 排行榜 / 后端 API 客户端。
 * API_BASE 基于 Vite 注入的 base，兼容秒搭子路径部署（/see-apps/{appName}/api）。
 */
export const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

export interface LeaderboardEntry {
  rank: number;
  username: string;
  realname: string;
  avatar: string;
  totalTimeMs: number;
  bikeId: string;
  trackId: string;
}

export interface SubmitResultPayload {
  totalTimeMs: number;
  bikeId: string;
  trackId: string;
  gameVersion: string;
}

/** 拉取竞速赛总用时排行榜（前十）。失败返回空数组，不抛错。 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`, { credentials: 'same-origin' });
    if (!res.ok) return [];
    const body = (await res.json()) as { status?: number; data?: { items?: LeaderboardEntry[] } };
    if (body?.status !== 100) return [];
    return Array.isArray(body.data?.items) ? body.data!.items : [];
  } catch {
    return [];
  }
}

/** 提交一条竞速成绩（需登录）。返回是否成功。 */
export async function submitRaceResult(payload: SubmitResultPayload): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/leaderboard/submit`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
