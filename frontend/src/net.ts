/**
 * Public single-player adapter. Records stay in browser storage; no server requests.
 */

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
  return [];
}

/** 提交一条竞速成绩（需登录）。返回是否成功。 */
export async function submitRaceResult(_payload: SubmitResultPayload): Promise<boolean> {
  return false;
}
