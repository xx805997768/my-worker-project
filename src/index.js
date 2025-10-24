const FILE_URLS = [
  'https://free-ssr-clash.github.io/uploads/2025/10/0-20251024.txt',
  'https://free-ssr-clash.github.io/uploads/2025/10/1-20251024.txt',
  'https://free-ssr-clash.github.io/uploads/2025/10/2-20251024.txt',
  'https://free-ssr-clash.github.io/uploads/2025/10/3-20251024.txt',
  'https://free-ssr-clash.github.io/uploads/2025/10/4-20251024.txt'
]
const SECRET = '520'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/sub') {
      // 整合订阅API，给V2ray客户端用，直接返回base64节点串！
      const links = await fetchAndMergeLinks()
      const encoded = btoa(links)
      return new Response(encoded, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      })
    }

    if (request.method === 'POST') {
      const formData = await request.formData()
      const input = formData.get('q') || ''
      if (input.trim() === SECRET) {
        const links = await fetchAndMergeLinks()
        const encoded = btoa(links)
        return new Response(renderGPTPage(links, encoded), {
          headers: { 'Content-Type': 'text/html' }
        })
      } else {
        return new Response(renderGPTPage(), {
          headers: { 'Content-Type': 'text/html' }
        })
      }
    }

    // GET首页显示模拟GPT
    return new Response(renderGPTPage(), {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

function renderGPTPage(links = '', encoded = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>GPT Chat订阅</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; padding: 2em; }
    .chatbox { background: white; padding: 1em; border-radius: 8px; max-width: 700px; margin: auto; }
    input[type=text] { width: 100%; padding: 0.5em; margin-top: 1em; }
    .resultbox { background: #f3f7fa; padding: 1em; margin-top: 2em; border-radius: 6px; word-break:break-all; }
    .subcopy { background: #eee; padding: 0.7em; border-radius:4px; }
    .nodeitem { font-family:monospace; font-size:0.95em; }
  </style>
</head>
<body>
  <div class="chatbox">
    <h2>GPT Chat订阅</h2>
    <p>你好，我是你的 AI 助手。请输入问题（输入<span style="color:#f33;font-weight:bold;">520</span>获取所有节点和整合订阅）：</p>
    <form id="gpform" method="POST">
      <input type="text" name="q" placeholder="请输入内容..." autofocus required />
      <button type="submit" style="margin-top:10px;">提交</button>
    </form>
    ${
      links
        ? `
        <div class="resultbox">
          <h3>所有节点链接：</h3>
          <div style="max-height:280px;overflow:auto;">
            ${links.split('\n').map(l => `<div class="nodeitem">${l}</div>`).join('')}
          </div>
          <h3>整合订阅（base64，复制链接添加到V2ray）：</h3>
          <div class="subcopy" id="base64sub" style="word-break:break-all;">${encoded}</div>
          <button onclick="navigator.clipboard.writeText('${encoded}').then(()=>alert('已复制！'));">复制整合订阅</button>
          <div style="margin-top:20px;color:#888;font-size:0.95em;">
            <b>V2ray节点自动更新方法：</b><br>
            在V2ray客户端订阅地址添加 <span style="color:#0077ff">https://你的worker地址/sub</span><br>
            以后V2ray会自动获取最新节点，无需再访问本页！
          </div>
        </div>
        `
        : ''
    }
  </div>
  <script>
    // 表单提交默认会刷新页面显示对话和节点
  </script>
</body>
</html>
`
}

async function fetchAndMergeLinks() {
  let allLinks = [];
  for (const url of FILE_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const base64txt = await res.text();
      let decoded;
      try {
        decoded = atob(base64txt);
      } catch (e) {
        decoded = '';
      }
      const matches = decoded.match(/(vmess|vless|trojan|ss):\/\/[^\s]+/g);
      if (matches) allLinks.push(...matches);
    } catch (e) {continue;}
  }
  return allLinks.join('\n');
}
