# 极速公路 HIGHWAY HEROES

卡通渲染开放式高速公路摩托竞速游戏。前端为 **Three.js r168 + Vite + TypeScript**，纯浏览器运行，支持键盘、Xbox 标准手柄与移动端触屏；后端为 **Flask + SQLite**，提供 SSO 鉴权与竞速排行榜。

- 在线地址：https://highway-heroes-peach.vercel.app
- GitHub 仓库：https://github.com/dds123456/highway-heroes

## 游戏模式

| 模式 | 目标 | 规则 |
|---|---|---|
| 竞速赛 Race | 与对手争夺名次 | 3 圈 · 3 名 AI · 道具开启 |
| 计时赛 Time Trial | 追求最快圈速 | 3 圈 · 无 AI · 无道具 · 记录个人最佳与幽灵车 |
| 漂移赛 Drift | 90 秒内累积漂移得分 | 计时 · 连击计分 |
| 沙盒 Sandbox | 自由驾驶练习 | 无计时 · 无胜负 |

成绩与个人最佳保存在浏览器 `localStorage`，可在同一设备持续刷新；计时赛会自动记录最佳圈的幽灵车，下一局可对照回放。跨设备的总用时排行榜由后端提供（见下文）。

## 仓库结构

v2.0 起改为前后端分离布局：

```text
backend/                 Flask 后端（SSO 鉴权 + 排行榜）
  app.py                 路由：/api/health、/api/dcu-sso/me、/api/leaderboard、/api/leaderboard/submit
  db_config.py           统一数据目录（容器内 /data，本地 backend/data）
  sso_helpers.py         DewuClaw SSO accessToken → 用户信息
  requirements.txt       Flask 3.0.3 / gunicorn / requests
frontend/                Vite + TypeScript 前端
  src/                   游戏源码（见下方模块划分）
  public/                模型、音乐、图标、PWA manifest、Service Worker
  scripts/               离线构建与资源生成脚本
  tests/                 Vitest 单元测试
  start_game.bat         一键启动开发服务器
  deploy_vercel.bat      一键发布到 Vercel
  vercel.json            SPA 回退与静态资源缓存策略
dclaw.yaml               DewuClaw 一体化部署配置（flask-react，后端 5000 端口，API 前缀 /api）
```

## 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可游玩，无需额外环境变量或全局工具。也可以直接双击 `frontend/start_game.bat`：脚本会自动安装依赖、选择空闲端口、启动开发服务器并打开浏览器。

## 启动后端（可选）

排行榜与 SSO 相关接口由后端提供；前端在接口不可用时自动降级为空榜，不影响单机游玩。

```bash
cd backend
pip install -r requirements.txt
python app.py          # 默认监听 0.0.0.0:5000
```

| 接口 | 方法 | 鉴权 | 说明 |
|---|---|---|---|
| `/api/health` | GET | 否 | 健康检查，返回 `{status:100,data:{ok:true}}` |
| `/api/leaderboard` | GET | 否 | 竞速赛总用时前十（按用户取个人最佳） |
| `/api/leaderboard/submit` | POST | 是 | 提交成绩，仅在该用户刷新个人最佳时更新 |
| `/api/dcu-sso/me` | GET | 是 | 由请求头或 Cookie 中的 `accessToken` 换用户信息 |

## 操作

| 操作 | 键盘 | Xbox 手柄 |
|---|---|---|
| 转向 | A / D 或 ←/→ | 左摇杆 / 十字键 |
| 油门 | W / ↑ | RT |
| 刹车 | S / ↓ | LT |
| 漂移 | Space / Shift / X | A |
| 道具 | E / J | X |
| 氮气 | Q | Y |
| 暂停 | Esc / P | Start |
| 返回 | Esc | B |

漂移持续压弯会积累氮气槽，槽满后同时按「油门 + 氮气」触发冲刺；撞击赛道上的礼盒捡取导弹 / 护盾 / 加速 / 地雷四种道具。

## 构建与部署

前端命令均在 `frontend/` 目录下执行：

```bash
npm run typecheck   # TypeScript 类型检查
npm run test        # Vitest 单元测试
npm run build       # 类型检查 + 生产构建（输出 frontend/dist/）
npm run preview     # 本地预览生产构建
npm run check       # typecheck + test + build 全量校验
npm run assets      # 重新生成 PWA 图标与分享封面占位图
```

### Vercel

仓库已与 Vercel 项目 `highway-heroes` 关联，推送到 `main` 分支即自动部署。

> **关键配置：项目的 Root Directory 必须设为 `frontend`**，否则构建会在仓库根目录执行并因找不到 `package.json` 报 `npm run build exited with 254`。该设置位于 Vercel 控制台 → Project Settings → Root Directory。

也可在本机双击 `frontend/deploy_vercel.bat` 手动发布。注意：Vercel 为无状态 Serverless，文件系统只读（仅 `/tmp` 可写且不跨实例共享），**后端不随 Vercel 部署**。

### DewuClaw / 自建服务器

`dclaw.yaml` 描述了一体化部署（前端静态资源 + 后端 `/api` 同域），数据目录在容器内挂载到 `/data`，可让 SQLite 跨次部署保留。

## 前端模块划分

```text
frontend/src/
  core/        Game 主循环（固定 60Hz 逻辑步）、GameMode 模式、事件总线、输入、常量
  settings/    SettingsStore 统一设置存取与校验
  records/     RecordStore 本地成绩（个人最佳 / 历史）
  ghost/       GhostRecorder 幽灵车录制与回放
  math/        闭合 CatmullRom 赛道采样、进度/曲率/坡度查询
  render/      WebGL2 后处理渲染器、Toon 材质、外扩描边、天空、道路、环境、粒子
  entities/    摩托实体、GLB 素材加载与部件拆分、骑手程序化动画
  ai/          AI 车手寻路、三种驾驶风格与橡皮筋系统
  race/        倒计时、圈数、顺序检查点、排名与结算
  items/       导弹 / 护盾 / 加速 / 地雷道具系统
  ui/          HUD、模式选择、暂停/结算/帮助/设置屏幕
  audio/       Web Audio 程序化引擎声、风噪、漂移与音效
  net.ts       排行榜 / 后端 API 客户端（接口失败时静默降级为空榜）
  types/       全局调试接口类型
```

## 渲染管线

1. 阶梯量化卡通漫反射：所有非真实感材质共享 4 档 `NearestFilter` 梯度贴图，阴影边界硬切。
2. 双层描边：几何体外壳沿法线外扩（屏幕空间恒定宽度）负责大轮廓，MRT 法线/深度 Sobel 后处理负责内部结构线。
3. Fresnel 边缘光：车辆与骑手材质叠加玫红/青蓝轮廓光。
4. Matcap 分段硬边高光：运行时 Canvas 生成同心硬边 Matcap。
5. 卡通天空：穹顶顶点渐变 + 硬边太阳 + 带描边卡通云。

道路为闭合 CatmullRom 样条，按区块流式显隐；护栏、树木、灌木、交通锥、广告牌使用 `InstancedMesh`；赛道沿途布置发光加速板与可碰撞路障。天气系统轮换晴天 / 下雨 / 雷暴 / 下雪，雷暴伴随闪电白闪与延迟雷声。

## 资源来源与许可证

本项目**并非**“零素材”：包含以下外部资源文件，发布前请核对各自授权。

| 类型 | 路径 | 说明 |
|---|---|---|
| 摩托车模型 | `frontend/public/models/*.glb` | 三辆摩托（Cafe-Race / Yamaha / RS200） |
| 背景音乐 | `frontend/public/music/*.mp3` | 三张地图主题曲 |
| 环境音频 | `frontend/public/audio/` | 引擎声、风雨声等 |
| 骑手模型 | `frontend/public/assets/characters/*.glb` | 轻量骑手（含 morph 目标） |

车辆名称使用了现实品牌/车型名，公开发布与商业化前需确认商标与模型素材的授权，必要时改为虚构品牌。完整的来源 / 许可 / 循环点清单建议补充到 `design/assets.csv`。

## 浏览器支持

- Windows / macOS Chrome、Edge：键盘 + Xbox 标准手柄
- Android Chrome：横屏触控
- iPhone Safari：横屏、安全区、音频解锁
- 需要 WebGL2；移动端自动降低渲染分辨率以保证帧率

## 已知问题

- 线上（Vercel）只部署前端，未部署后端，因此在线排行榜为空榜；本地或一体化部署后端后可正常使用。
- 本地 `npm run dev` 时 Vite 未配置 `/api` 代理，请求落在 5173 端口，排行榜同样为空榜；联调需自行配置代理或改用一体化部署。
- 分享封面（`frontend/public/social/og-cover.png`）与 PWA 图标均为程序化生成的占位图，尚未使用真实游戏截图。

## 路线图

- [x] 竞速赛（3 圈 · 3 AI · 道具）
- [x] 计时赛 + 个人最佳 + 幽灵车
- [x] 漂移赛（90 秒计分）
- [x] 沙盒模式
- [x] 手柄完整按键映射（Y 氮气 / X 道具 / Start 暂停 / B 返回）
- [x] 固定 60 Hz 逻辑步
- [x] 本地成绩存储
- [x] 在线排行榜后端（Flask + SQLite，含 SSO 鉴权）
- [ ] Planned：排行榜数据迁移到云端托管数据库（Vercel Postgres / KV / Upstash），解决 Serverless 不可持久化问题
- [ ] Planned：挑战链接分享与每日挑战
- [ ] Planned：离线模型压缩 / Draco / Meshopt 与 LOD
- [ ] Planned：实时多人房间
