# WeChat Mini Program (WeChatProject)

本目录包含导师进书院的小程序工程示例，已实现：
- 首页一键登录（`wx.login` 获取 `code` → 调后端 `/api/weapp/login` → 获得 `sso_ticket`）
- 通过 `web-view` 打开 H5 的 `WeAppSso` 回调页，完成 SSO 交换站点 JWT

使用步骤：
- 安装并打开微信开发者工具，选择「导入项目」，目录指向本文件夹
- 在 `project.config.json` 中填写你的 `appid`
- 在微信平台后台「开发管理 → 开发设置」配置合法域名：
  - request 合法域名：`https://cdsyzh.cn`（或你的生产域名）
  - web-view（业务域名）：`https://cdsyzh.cn`
- 修改 `utils/config.js` 里的 `API_BASE` 与 `H5_BASE` 为你的实际线上域名
- 运行小程序：点击首页“一键登录”按钮，将进入 `web-view` 页面并完成站点登录

说明：
- 不在小程序内存储站点密钥；一次性票据由后端生成并校验
- 首次登录如未绑定账号，H5 会根据后端返回的状态引导绑定流程
- 完成后可在 `web-view` 内使用站点功能，或返回小程序继续操作