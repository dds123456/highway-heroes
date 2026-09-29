# 极速公路 HIGHWAY HEROES

卡通渲染开放式高速公路摩托竞速游戏。技术栈为 **Three.js r168 + Vite + TypeScript**，在浏览器中运行，支持键盘、Xbox 标准手柄与移动端触屏。

在线地址：https://highway-heroes-peach.vercel.app
GitHub 仓库：https://github.com/dds123456/highway-heroes

## 游戏模式

| 模式 | 目标 | 规则 |
|---|---|---|
| 竞速赛 Race | 与对手争夺名次 | 3 圈 · 3 名 AI · 道具开启 |
| 计时赛 Time Trial | 追求最快圈速 | 3 圈 · 无 AI · 无道具 · 记录个人最佳与幽灵车 |
| 漂移赛 Drift | 90 秒内累积漂移得分 | 计时 · 连击计分 |
| 沙盒 Sandbox | 自由驾驶练习 | 无计时 · 无胜负 |

成绩与个人最佳保存在浏览器 `localStorage`，可在同一设备持续刷新；计时赛会自动记录最佳圈的幽灵车，下一局可对照回放。

## 启动

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可游玩，无需额外环境变量或全局工具。

也可以直接双击 `start_game.bat`：脚本会自动安装依赖、选择空闲端口、启动开发服务器并打开浏览器。

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

```bash
npm run typecheck   # TypeScript 类型检查
npm run test        # Vitest 单元测试
npm run build       # 类型检查 + 生产构建（输出 dist/）
npm run preview     # 本地预览生产构建
npm run check       # typecheck + test + build 全量校验
npm run assets      # 重新生成 PWA 图标与分享封面占位图
```

部署到 Vercel：双击 `deploy_vercel.bat`（首次登录/关联项目，之后一键发布）。`vercel.json` 已配置 SPA 回退与静态资源缓存策略。

## 项目结构

```text
src/
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
  types/       全局调试接口类型
scripts/       离线构建脚本、部署脚本、资源占位图生成
tests/         Vitest 单元测试
public/        模型、音乐、PWA manifest、Service Worker、图标
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
| 摩托车模型 | `public/models/*.glb` | 三辆摩托（Cafe-Race / Yamaha / RS200） |
| 背景音乐 | `public/music/*.mp3` | 三张地图主题曲 |
| 环境音频 | `public/audio/`、引擎/天气采样 | 引擎声、风雨声等 |

车辆名称使用了现实品牌/车型名，公开发布与商业化前需确认商标与模型素材的授权，必要时改为虚构品牌。完整的来源 / 许可 / 循环点清单建议补充到 `design/assets.csv`。

## 浏览器支持

- Windows / macOS Chrome、Edge：键盘 + Xbox 标准手柄
- Android Chrome：横屏触控
- iPhone Safari：横屏、安全区、音频解锁
- 需要 WebGL2；移动端自动降低渲染分辨率以保证帧率

## 已知问题

- 分享封面（`public/social/og-cover.png`）为程序化生成的占位图，尚未使用真实游戏截图。
- PWA 图标同样为占位图。
- 排行榜为纯本地存储，尚未接入 Supabase 在线榜单（Roadmap）。

## 路线图

- [x] 竞速赛（3 圈 · 3 AI · 道具）
- [x] 计时赛 + 个人最佳 + 幽灵车
- [x] 漂移赛（90 秒计分）
- [x] 沙盒模式
- [x] 手柄完整按键映射（Y 氮气 / X 道具 / Start 暂停 / B 返回）
- [x] 固定 60 Hz 逻辑步
- [x] 本地成绩存储
- [ ] Planned：在线排行榜（Supabase）
- [ ] Planned：挑战链接分享与每日挑战
- [ ] Planned：离线模型压缩 / Draco / Meshopt 与 LOD
- [ ] Planned：实时多人房间
