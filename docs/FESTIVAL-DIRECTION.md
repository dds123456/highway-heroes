# 公路嘉年华 · 当前表现与后续边界

> 当前基线：人物自然化 V2；核对日期：2026-09-09。[目录](README.md) · [GDD](GDD-游戏设计文档-Pacific.md)

用户要求：道具和加速带显著可见；导弹不再有球形观感；重排菜单与 HUD；整体参考地平线 6。当前已实现相应本地视觉迭代，保留四种模式框架；导弹选敌与结算规则的后续变化见 GDD。

历史参考记录：https://forza.net/en-GB/japanawaits （原记录标注 2026-09-08 查阅；本次未重新联网核验）。本项目只采用自然公路、赛事与巡航并列的组织方式和嘉年华活动识别度，不使用 Forza 名称作为本游戏品牌，不复制原版地图、模型或图像。当前仍是三套闭合路线主题，不宣称已经变成无缝开放世界。

Style formula: Bright contemporary road festival with grounded motorcycles and natural outdoor scenery, clean dimensional materials and no comic outlines. Sky blue and foliage green frame the road; off-white typography and deep navy panels preserve legibility. Festival magenta identifies primary actions, electric cyan marks pickups and acceleration, and warm amber signals warnings. Soft sunlight and aerial depth remain natural while localized halos, flowing chevrons and narrow trails make interactive objects readable at racing speed without washing out their physical silhouettes.

UI tokens: sky #79bfd5; panel #122b40; paper #f4f7f5; festival #e22c80; signal #50e9f3; warning #ffc460. Display: Bahnschrift / Impact; body: Segoe UI / Microsoft YaHei. 首页采用紧凑赛事选择面板，车库保留可旋转实时车辆预览；actual mode → vehicle → course steps carry progression, not decorative numbering.

流程：模式首页突出立即出发、巡航、车库、角色；记录折叠为次级内容。选车与选图顶部显示真实步骤，可返回修改，开赛前列出所选车辆／赛道／模式。比赛仪表保留道路中央视野，突出所持道具与使用键，空槽不占大块空间。

资产清单增量：VisibilityFX.ts（局部渐变光晕与轨迹）；PropModels.ts（尖头长弹体、四片翼与喷口）；RoadItems.ts（流动箭头、边灯、触发反馈）；festival.css（菜单与 HUD）；现有 Three.js 素材均本地生成或来自原项目。

## 当前表现

| 对象 | 表现与规则边界 |
|---|---|
| 四类拾取物 | 真实 3D 网格、分类色光晕、光圈与悬浮；拾取冷却时隐藏 |
| 加速带 | 默认 12 块，流动箭头和侧灯，触发亮度反馈，单块冷却 2.6 秒 |
| 发射导弹 | 长弹体、尖头、四翼、喷口、尾焰与窄尾迹；不是发光球 |
| HUD | 小地图在右上，道具文字与使用键可读，空槽不占大块中央视野 |
| 角色工作室 | 中性深色面板与暖黄控件，保留独立全身预览，不与主菜单强调色强行统一 |

光晕为局部透明渐变，不新增全屏 Bloom。类型还由形状和文字表达，不能只靠颜色。四类携带道具只在竞速模式启用；关闭携带道具的模式仍保留加速带与道路障碍。

## 检查方式与尚未完成的内容

从模式首页经车库、路线确认进入比赛，检查每步可返回且组合摘要正确；在移动中检查光晕不过曝、不遮路、不掩盖实体轮廓。雨天、雪地、远距离和色觉可访问性仍需更完整体验测试。

已有截图：[菜单](../previews/09-festival-menu.png)、[加速带](../previews/10-boost-pad.png)。这些是嘉年华阶段截图，不证明所有最新人物或所有设备表现；详情见 [验证记录](VERIFICATION.md)。

开放世界、生涯活动、经济系统与真实交通模拟未实现，不能因风格参考而自动列为已交付。
