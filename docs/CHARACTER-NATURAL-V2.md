# 人物自然化第二轮

> 当前基线：人物自然化 V2；核对日期：2026-09-09。[目录](README.md) · [角色工作室](CHARACTER-STUDIO.md) · [GDD](GDD-游戏设计文档-Pacific.md)

沿用公路嘉年华材质与配色，不重做其他游戏资产。

Style formula: Grounded contemporary motorcycle riders with anatomically coherent adult proportions, smooth sculpted facial planes, restrained skin color variation and fitted protective clothing. Dark graphite leather and woven fabric frame warm natural skin; hair has layered volumes rather than a painted cap. Gendered base forms remain editable, fully clothed and athletic without exaggerated sexual features. Soft neutral showroom lighting reveals cheek, eyelid, nose, jaw and shoulder transitions, while front, side and full-body views share consistent three-dimensional geometry.

本轮资产：CharacterGeometry 的男女独立下颌／颧面轮廓、眼睑与唇部、女性侧分短波波头／低马尾；CharacterBody 的连续女式胸腰衣着曲面和四肢收放；FaceScene 的轻微呼吸与头部待机。

不宣称写实扫描模型或 GTA 级精度。保留原骨架、骑乘约束、头盔和自定义参数；头盔开启时隐藏头发，避免穿盔。

验证：TypeScript / Vite / 单文件打包通过，9 个测试文件共 46 项通过；新增两款女式发型的连续发片、有限顶点与渲染预算测试。男女高矮车手在三辆摩托车上的手脚定位测试保持通过。浏览器人工检查默认女性正面近景、全身、侧脸、低马尾背面与头盔切换；检查时仅修改草稿，最后取消，未覆盖用户保存的人物。

实际截图：previews/12-female-natural-head.png、previews/13-female-natural-body.png。仍有风格化限制：发片与皮肤缺少精细贴图，耳鼻口为简化结构，尚未加入表情骨骼或皮肤蒙皮动画。本轮不声称已达到真人级拟真。

## 最终实现补充

- 头部不是男性模型整体缩窄：男女分别定义下颌到颧骨的截面变化，并调整鼻梁、颊面、眼睑和唇部。
- 女性机车服胸腰采用连续网格形变，不添加独立球形胸部；肩腰胯与手掌、四肢比例共同表达体态差异。
- 齐颈发型最终改为一片连续的弧形发片，替换早期成束粗管状发绺；该发型覆盖区域不再生成会穿出发片的耳朵细节。低束马尾保留独立尾部几何和发圈。
- 工作室的呼吸／头部轻动由预览更新驱动；不是比赛新增一套人物运动状态机。
- 性别切换保留同一份参数，外观菜单同步更新男女发型标签。没有新增第二个角色槽或云存档。

## 验证口径

默认角色预算测试为 <75000 三角形、<85 个材质批次；两款女式发型测试为 <80000 三角形、<90 个批次，统计含隐藏部分，不是整个比赛场景的性能指标。测试检查有限顶点、连续发片对象以及低马尾结构；骑乘测试覆盖男女、高矮与短臂组合，但不保证所有参数组合和动作都无穿插。

[最新头部截图](../previews/12-female-natural-head.png) · [最新全身截图](../previews/13-female-natural-body.png)。46 项为当前完整测试集，具体运行和历史记录统一见 [VERIFICATION.md](VERIFICATION.md)，本页的人工预览记录发生于人物自然化实现阶段。
