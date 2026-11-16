# 充气打工人 · Air Worker

短胖的充气上班族，保留无打光色块、短手臂和慵懒表情。

## 实时模拟
预览通过 physics.js 的固定 120 Hz 位置约束求解器计算动作：25 个身体节点、两条独立手臂、重力、惯性阻尼、送风推力、随压力变化的弯曲刚度、底部到顶部的压力传输、折弯压力损失、地面接触。相关随机扰动使摆动不再固定循环。

三种状态直接改变送风量。切换不重置位置或速度：没气逐渐软塌，气少支撑较弱，气多恢复鼓胀并摆动。暂停和调速对所有状态有效，底部进度条显示顶部压力。

这是为交互效果设计的简化弹性杆和气压模型，参数为视觉调校，尚未用实物数据标定，不是完整流固耦合或布料求解。极端折叠仍可能自交。

## 交付
- model.mjs：角色几何；预览使用 rest 模式生成静止网格，旧曲线代码仅保留供历史参考。
- physics.js：实时动力学与网格变形。
- toon.js：不受灯光影响的色块和细描边。
- public/air-dancer.glb、air-dancer-low.glb：分别为气多、气少模拟的 6 秒动作采样（不是无缝循环，也不携带实时求解器）。
- public/air-dancer-none.glb：关风后稳定下来的姿态。
- dist/：已构建的预览；GLB 使用 KHR_materials_unlit。

## 运行
npm install 后运行 npm run dev。npm run model 重新采样并导出三个 GLB，npm run build 构建预览。node physics.test.mjs 检查状态切换连续性、关风落地、重新充气与稳定性。

已安装 Node.js 可双击 start-preview.cmd，或 node preview.cjs 后打开 http://127.0.0.1:5187/ 。使用本地 HTTP 服务访问，不能直接双击 dist/index.html。

