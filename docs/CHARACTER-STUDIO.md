# 角色工作室 · 制作约定

> 当前基线：人物自然化 V2；核对日期：2026-09-09。[目录](README.md) · [GDD](GDD-游戏设计文档-Pacific.md)

沿用 Pacific Edition 的写实公路方向，参考 GTA Online 角色创建的基础脸型混合、分类编辑、全身预览和确认保存流程，不复用 GTA 资产或宣称模拟真实遗传。

Style formula: Grounded contemporary highway characters with smoothly contoured adult anatomy, restrained silhouettes and no cartoon outlines. Skin uses warm varied tones, clothing uses charcoal, muted olive and weathered burgundy, and protective equipment carries small reflective accents. Soft neutral studio lighting reveals facial planes, shoulders, waist and limb volume without glossy plastic highlights. Original parametric meshes remain readable at riding distance, with anatomically proportioned hands and footwear and consistent three-dimensional materials across the editor, garage and race.

新增资产：CharacterGeometry.ts（头部表面、五官及发型）；CharacterBody.ts（全身轮廓、关节、服装和手脚）。均为本地原创程序化几何；原 GLB 保留为源参考，不上传外部服务。

角色数据：hh.character.v1。首次读取兼容旧 hh.face。编辑为草稿，只有确认保存才修改角色；取消不写入。体型只影响外观，不修改速度、碰撞和比赛规则。骑乘与站立共用角色参数，骑乘姿态另做车把／脚踏约束。

精度边界：不是扫描皮肤或人工雕刻的 AAA 人物，不包含 GTA 原生遗传、纹身、美妆、动态布料或全部身体动画。

## 当前编辑能力

| 分类 | 内容 |
|---|---|
| 基础脸型 | 棱角／柔和／修长／宽颧四种原创基础，A/B 混合比例 |
| 五官 | 12 项：鼻翼宽窄、鼻梁突出、唇厚、脸宽、脸长、下颌宽、下巴长、脸颊饱满、额头高、眉骨深、眼距、嘴宽 |
| 体型 | 10 项：身高、肩宽、胸廓、腰围、胯宽、肌肉量、臂长、腿长、头身比例、颈宽；身高 165–190 cm |
| 外观 | 6 肤色、4 发型、5 发色、4 瞳色、3 胡须档、2 服装、4 衣着配色 |

各分类均可切换男女车手，切换保留当前滑杆与配色，不建立第二套存档。女性拥有独立下颌/颧面和胸腰衣着曲面，发型选项为利落短发、齐颈侧分、低束马尾、光头；细节见 [自然化说明](CHARACTER-NATURAL-V2.md)。

## 使用与保存

1. 主菜单进入「角色定制 · 捏脸与体型」，选择性别与基础脸型。
2. 切换五官、体型、外观分类修改参数；使用全身／上半身／头部取景与正侧背视图检查。
3. 拖动模型或自动旋转，使用「头盔预览」检查装备尺寸。开盔预览时隐藏头部和头发，比赛默认佩戴头盔。
4. 单项重置只恢复对应滑杆；随机角色与恢复默认仍为草稿操作。可撤销最近最多 40 次参数更新，「对比已保存」不覆盖草稿。
5. 「保存角色」确认当前外观；「取消修改」丢弃本次草稿。浏览器存储可用时刷新后保留，存储被禁用时不能保证持久化。

`hh.character.v1` 使用 version=1，gender=0/1；旧档缺少性别时默认男车手。参数入口做范围和非有限数值校验。更换浏览器、域名或端口可能使用不同存储区域，不是云账号存档。

## 维护与验证

参数定义：`frontend/src/settings/CharacterStore.ts`、`FaceStore.ts`；编辑逻辑：`frontend/src/ui/CharacterEditor.ts`；预览：`FaceScene.ts`。17 个控制关节与 `frontend/src/entities/RiderIK.ts` 维持骑乘兼容，模型为关节附着网格，不是完整柔性蒙皮。

角色单元测试位于 `frontend/tests/render/character.test.ts`；性别迁移与头盔测试在 `cyber-rider.test.ts`。检查参数极端值、保存/取消、男女切换、三车骑乘和头盔遮挡。已有结果见 [验证记录](VERIFICATION.md)，极端参数全部组合与真实移动设备仍待补测。
