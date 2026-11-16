# 充气打工人 · Air Worker

光滑、短胖的充气上班族：深色中分头发、桃肤色脸与圆手、浅蓝衬衫、白领口、深灰领带、藏蓝裤身，搭配半眯眼、弯鼻子、嘟嘴表情。

## 三种状态

- 没气：身体扁塌躺平，手臂软垂，静止休息。
- 气少：身体半鼓起、弯腰垂手，缓慢摆动。
- 气多：身体饱满站立，活跃摇摆、鼓胀与回弹。

预览中可直接切换状态，下载按钮跟随当前状态。运动状态为 8 秒循环、64 个形态采样，底座固定；头发、表情与衣服随身体变形。动作是程序化变形模拟，不是布料或流体物理解算。

## 文件

- `public/air-dancer.glb`：气多，动画 `Air_high_Loop`。
- `public/air-dancer-low.glb`：气少，动画 `Air_low_Loop`。
- `public/air-dancer-none.glb`：没气，静态塌陷模型。
- `model.mjs`：建模、状态与动作源码。
- `toon.js`：无光照色块和细描边。
- `dist/`：已构建预览，无外部 CDN、字体或图片依赖。

三个 GLB 均为 Y 轴向上、单位米，使用 KHR_materials_unlit 保存不受灯光影响的色块。预览也采用无光照材质，没有定向灯、高光条、明暗条纹或投影；细描边由预览额外绘制。可导入 Blender 等支持 glTF 的软件。

## 使用

安装 Node.js 后，双击 `start-preview.cmd`，或运行 `node preview.cjs` 并打开 http://127.0.0.1:5187/ 。请通过本地 HTTP 服务访问，不要直接双击 dist/index.html。

开发：`npm install` → `npm run dev`。
重新生成模型：`npm run model`。
构建预览：`npm run build`。

预览支持旋转、缩放、暂停与调速。没气状态静止，暂停与调速控件会禁用。

