"""
HIGHWAY HEROES 后端服务。

提供 SSO 用户信息、排行榜（竞速赛总用时前十名）接口。
数据库使用 SQLite，落在 db_config.DATA_DIR 下，跨次部署不丢失。
"""

import sqlite3
import time
from pathlib import Path

from flask import Flask, g, jsonify, request

from db_config import DATA_DIR
from sso_helpers import SSOError, get_current_user

DB_PATH = DATA_DIR / "highway_heroes.db"

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False

LEADERBOARD_LIMIT = 10


# ── 数据库 ────────────────────────────────────────────────────────────────
def get_db():
    if "_db" not in g:
        g._db = sqlite3.connect(str(DB_PATH))
        g._db.row_factory = sqlite3.Row
    return g._db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("_db", None)
    if db is not None:
        db.close()


def init_db():
    """初始化数据库表结构（幂等）。"""
    db = sqlite3.connect(str(DB_PATH))
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                realname TEXT NOT NULL DEFAULT '',
                avatar TEXT NOT NULL DEFAULT '',
                total_time_ms INTEGER NOT NULL,
                bike_id TEXT NOT NULL DEFAULT '',
                track_id TEXT NOT NULL DEFAULT '',
                game_version TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            )
            """
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_leaderboard_time ON leaderboard(total_time_ms, created_at)"
        )
        db.commit()
    finally:
        db.close()


def parse_positive_int(value) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    # 竞速总用时合理上限：避免恶意超大值污染排序
    if n > 24 * 3600 * 1000:
        return None
    return n


WATCHLIST = []


# ── SSO 鉴权（读 Header accessToken 或平台 Cookie）────────────────────────
def current_user_or_401():
    try:
        return get_current_user(), None, 200
    except SSOError as e:
        return None, jsonify({"status": e.code, "error": str(e)}), e.http_status


@app.route("/api/dcu-sso/me", methods=["GET"])
def sso_me():
    """返回当前登录用户信息；未登录返回 401。"""
    user, err, status = current_user_or_401()
    if user is None:
        return err, status
    return jsonify(
        {
            "status": 100,
            "data": {
                "username": user.get("username", ""),
                "realname": user.get("realname", ""),
                "avatar": user.get("avatar", ""),
                "email": user.get("email", ""),
            },
        }
    )


@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    """竞速赛总用时排行榜（前十名）。不要求登录，任何人都能看。"""
    db = get_db()
    # 每个用户取个人最佳（最短总用时），再按用时升序取前十
    rows = db.execute(
        """
        SELECT l.username, l.realname, l.avatar, l.total_time_ms, l.bike_id, l.track_id
        FROM leaderboard l
        JOIN (
            SELECT username, MIN(total_time_ms) AS best_time
            FROM leaderboard
            GROUP BY username
        ) b ON b.username = l.username AND b.best_time = l.total_time_ms
        ORDER BY l.total_time_ms ASC, l.created_at ASC
        LIMIT ?
        """,
        (LEADERBOARD_LIMIT,),
    ).fetchall()

    items = []
    rank = 0
    for r in rows:
        rank += 1
        items.append(
            {
                "rank": rank,
                "username": r["username"],
                "realname": r["realname"],
                "avatar": r["avatar"],
                "totalTimeMs": r["total_time_ms"],
                "bikeId": r["bike_id"],
                "trackId": r["track_id"],
            }
        )
    return jsonify({"status": 100, "data": {"items": items}})


@app.route("/api/leaderboard/submit", methods=["POST"])
def submit_score():
    """提交一条竞速成绩。需登录；按用户去重保留个人最佳。"""
    data = request.get_json(silent=True) or {}
    total_time_ms = parse_positive_int(data.get("totalTimeMs"))
    if total_time_ms is None:
        return jsonify({"status": 400, "error": "totalTimeMs 必须是正整数毫秒"}), 400

    user, err, status = current_user_or_401()
    if user is None:
        return err, status

    username = user.get("username", "") or ""
    realname = user.get("realname", "") or ""
    avatar = user.get("avatar", "") or ""
    bike_id = str(data.get("bikeId", ""))[:64]
    track_id = str(data.get("trackId", ""))[:64]
    game_version = str(data.get("gameVersion", ""))[:32]

    if not username:
        return jsonify({"status": 400, "error": "缺少用户标识"}), 400

    db = get_db()
    existing = db.execute(
        "SELECT id, total_time_ms FROM leaderboard WHERE username = ?",
        (username,),
    ).fetchone()

    if existing is None:
        db.execute(
            """
            INSERT INTO leaderboard
                (username, realname, avatar, total_time_ms, bike_id, track_id, game_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (username, realname, avatar, total_time_ms, bike_id, track_id, game_version, int(time.time())),
        )
    elif total_time_ms < existing["total_time_ms"]:
        # 只保留个人最佳（更短用时）
        db.execute(
            "UPDATE leaderboard SET total_time_ms = ?, realname = ?, avatar = ?, bike_id = ?, track_id = ?, game_version = ?, created_at = ? WHERE id = ?",
            (total_time_ms, realname, avatar, bike_id, track_id, game_version, int(time.time()), existing["id"]),
        )
    db.commit()

    # 返回该用户当前在榜上的最佳成绩与名次
    best = db.execute(
        "SELECT total_time_ms FROM leaderboard WHERE username = ?", (username,)
    ).fetchone()
    rank = 0
    if best is not None:
        worse = db.execute(
            "SELECT COUNT(*) AS c FROM leaderboard WHERE total_time_ms < ?", (best["total_time_ms"],)
        ).fetchone()
        rank = (worse["c"] if worse else 0) + 1

    return jsonify(
        {
            "status": 100,
            "data": {"totalTimeMs": best["total_time_ms"] if best else total_time_ms, "rank": rank},
        }
    )


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": 100, "data": {"ok": True}})


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)