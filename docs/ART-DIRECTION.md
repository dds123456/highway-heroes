# 极速公路 · Pacific 美术方向

> 当前基线：人物自然化 V2；核对日期：2026-09-09。总规则见 [GDD](GDD-游戏设计文档-Pacific.md)，文件导航见 [目录](README.md)。

## Direction
A contemporary Southern California highway racer: sun-bleached stucco, olive palms, weathered asphalt, brushed metal and restrained road signage. Three physically differentiated motorcycles use painted panels, rubber tires, exposed mechanical assemblies and stitched seats. Adult-proportioned riders wear protective street equipment. Natural directional light, soft shadows, filmic tone mapping and aerial haze replace toon bands, fluorescent rim lighting and black outlines. The three original tracks become a coastal urban ring, an inland desert highway and an alpine pass. The original mode framework, track layouts and collision dimensions are retained; later iterations add character customization, front-first missiles, gradual showers and a two-second active-time finish transition.

自然公路是场景基底，赛博感集中在车衣、头盔与交互提示。参考用户提出的 GTA5／地平线风格方向，不复制其资产或宣称达到 AAA 精度。局部光晕属于玩法识别，不恢复全场霓虹轮廓。

## Asset provenance and scope
New runtime meshes and procedural surfaces are code-generated in this project. Existing music, sound and optional wrap textures come from the supplied v2.0 archive; their original ownership is unchanged and release permissions still need review. Old character and motorcycle GLBs remain as reference assets, not runtime geometry dependencies. No GTA V extracted models, textures or maps are included. This is a browser-scale art overhaul, not AAA photorealistic asset fidelity.

| System | Source | Implementation |
|---|---|---|
| Three bike silhouettes | entities/DetailedMotorcycle.ts | Independent rubber, alloy, paint, leather, glass; animated wheels |
| Rider anatomy | entities/CharacterBody.ts + entities/CharacterGeometry.ts | Parameterized full body, head, five-finger hands, shaped boots, clothing; 17 compatible control joints |
| Surfaces and lighting | render/Art.ts | PBR, original seeded canvas textures, sunlight and environment reflections |
| Map kit | render/Environment.ts | Palms/pines, buildings, signs, terrain verge, infrastructure |
| Pickup models | items/itemSprites.ts + render/PropModels.ts | Real 3D props retaining old gameplay interface |
| Visibility | render/VisibilityFX.ts + render/RoadItems.ts | Local halos, flowing boost arrows and narrow missile exhaust |
| Cyber helmet | entities/CyberHelmet.ts | Faceted matte full-face helmet, cyan visor strip and red tail light |
| Character studio | ui/CharacterEditor.ts + ui/FaceScene.ts | Gender, face/body/style drafts, standing views and subtle idle motion |
| Interface | styles/remaster.css + styles/festival.css + styles/character.css | Festival menu/HUD and neutral character workspace |

上表路径均相对 `frontend/src/`；机器可读清单见 [assets-manifest.json](assets-manifest.json)。

## 各类资产的验收重点

- 车辆：Cafe Custom 88、Desert Scrambler、RS Sport 200 保持不同轮廓；轮胎、金属、皮革不随车衣整车染色。原内部 ID 不表示精确复刻同名量产车。
- 人物：正／侧／背面和骑乘共用轮廓，女性区别落在脸型与全身比例而非单纯换色；眼睑、鼻口和服装过渡避免分离或穿插。头盔显示时隐藏头发。
- 环境：海岸都会环线、荒漠州际公路、高山隘口区分植被、山体和建筑；道路中央视野优先。三套主题不等于无缝开放世界。
- 道具：导弹橙、护盾蓝、加速青、地雷洋红；必须同时靠形状与 HUD 标签识别。采用局部透明光晕，不依赖全屏 Bloom。
- 天气：非雪地阵雨逐渐出现，雨丝与雨声随强度变化；不把天气视觉效果写成湿路物理已实现。
- 界面：菜单/HUD 用海军蓝、洋红、青色和暖黄；角色工作室保留中性面板与暖黄控件。以实际 CSS 为准，不宣称所有页面只用一种强调色。

## 限制与后续

没有新增 Blender 工程或导出的 GLB。人物仍缺少精细皮肤/布料贴图、真实毛发、面部表情和柔性蒙皮；需要更高近景精度时应单独制作和接入 DCC 资产。材质与几何测试不代替截图验收，最新证据与历史性能采样分开记录在 [验证记录](VERIFICATION.md)。
