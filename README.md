V2ray/SSR 多源整合订阅 Cloudflare Worker
一键部署到 Cloudflare Worker，实现 V2ray/SSR 节点多文件聚合+网页便捷订阅服务。

功能
多文件自动聚合：支持同时整合多个来源的节点文件（支持 vmess/vless/trojan/ss 等）。
自动更新：客户端订阅 /sub 接口，自动获取最新节点。
网页模拟 GPT 聊天：输入暗号可显示所有节点及整合订阅，支持复制。
客户端完美兼容：直接输出符合 V2ray 客户端的 base64 订阅格式。
部署
Fork 本仓库 / 复制 index.js 文件
登录 Cloudflare Workers ，新建 Worker
替换 Worker 编辑器中的代码为本仓库 index.js
将 FILE_URLS 修改为你的节点源 txt 文件（建议 base64格式，每行一个节点）
保存并部署，记住分配的 Worker 域名，例如：

Collapse
Copy
1
https://your-worker-name.workers.dev/
客户端订阅设置填写：

Collapse
Copy
1
https://your-worker-name.workers.dev/sub
用法
浏览器访问 Worker 域名，出现 GPT 聊天模拟框。
输入 520，显示所有聚合的节点及订阅链接，可一键复制整合订阅。
客户端订阅 /sub 直接自动更新每次访问聚合后的所有节点。
订阅文件示例
你的 FILE_URLS 需指向公开可访问的文本文件，内容为 base64编码的节点列表（如 vmess/vless/ss/trojan）。

每个 txt 文件内容类似：


Collapse
Save
Copy
1
2
3
4
dm1lc3M6Ly9.....
dm1lc3M6Ly9.....
dHJvamFuOi8v....
...
代码说明
FILE_URLS：待聚合的所有 txt 文件 URL。
SECRET：网页输出节点的暗号，推荐自定义。
fetchAndMergeLinks()：自动拉取、解码、聚合所有节点。
注意事项
节点文件请定期维护，或使用第三方自动更新的节点源。
Worker 免费流量有限，请勿用于高频或公开分享。
支持自定义页面样式，可修改 renderGPTPage 方法。
鸣谢
节点源托管推荐使用 GitHub Pages/Gitee/自建公共 CDN


