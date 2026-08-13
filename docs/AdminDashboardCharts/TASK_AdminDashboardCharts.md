# 管理员仪表盘图表升级任务拆分 (AdminDashboardCharts)

## 原子任务列表

1. 依赖安装
   - 输入契约：`frontend/package.json`
   - 输出契约：新增 `echarts@^5.5.0` 依赖并成功安装
   - 约束：与 Vue 3 + Vite 兼容

2. 新建图表组件 `AdminCharts.vue`
   - 输入契约：接口 `/api/admin/activities`、`/api/admin/activities/summary`
   - 输出契约：实现折线、柱状、热力图、散点图；支持周期/维度/指标切换
   - 约束：代码简洁、符合现有风格；不引入测试代码；不改后端

3. 集成到 `AdminDashboard.vue`
   - 输入契约：现有仪表盘结构
   - 输出契约：在总览卡片后渲染图表区域
   - 约束：不影响现有总览逻辑

4. 本地预览与验证
   - 输入契约：dev server 可启动
   - 输出契约：打开 `http://localhost:<port>/`，图表显示且交互正常
   - 约束：遇到错误需修复后再继续

5. 部署上线
   - 输入契约：构建产物 `frontend/dist`
   - 输出契约：同步到服务器 `/var/www/mentor-academy/frontend/`，Nginx reload，线上可访问
   - 约束：保持与现有部署流程一致

6.（可选）后端聚合接口
   - 输入契约：数据库模型 `ActivityRegistration.createdAt`
   - 输出契约：提供按日/小时的报名趋势、类别/导师维度聚合接口
   - 约束：确保性能与分页/过滤支持