# ────────────────────────────────────────────────────────────────
# ⚠️ CRITICAL: DO NOT MODIFY this file.
# 统一数据目录配置，控制所有持久化数据的存储位置。
# 修改此处可能导致容器/本地环境数据丢失。
# ────────────────────────────────────────────────────────────────

from pathlib import Path

# 容器环境（存在 /.dockerenv）挂载到 /data，本地开发用项目内 ./data
DATA_DIR = Path("/data") if Path("/.dockerenv").exists() else Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
