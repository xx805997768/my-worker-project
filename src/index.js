import { connect } from 'cloudflare:sockets';

// 环境变量
let user = '0acb0ed8-9c48-4048-b8d5-5c336bb76842';
let target = '2a02:898:146:64::';
let upstream = 'bpb.yousef.isegaro.com';

// 验证 UUID
function isValidUser(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// 判断 WebSocket 请求
function isWebSocket(request) {
  return request.headers.get('Upgrade') === 'websocket';
}

// API 本地 echo 代理
async function handleApi(request) {
  const url = new URL(request.url);
  const reply = `Echo: ${url.searchParams.get('msg') || 'Hello from Worker'}`;
  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 简单 HTML 测试页面
function getHtmlPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ChatGPT Worker</title>
<style>
body { font-family:sans-serif; background:#f5f5f5; margin:0; padding:0; }
header{background:#007bff;color:#fff;padding:1rem;text-align:center;}
main{max-width:800px;margin:2rem auto;background:#fff;padding:2rem;border-radius:8px;}
input, button {padding:0.8rem;font-size:1rem;}
pre {background:#f8f9fa;padding:1rem;border-radius:4px;}
</style>
</head>
<body>
<header><h1>ChatGPT Worker</h1></header>
<main>
<form id="chat">
<input name="msg" placeholder="Type message..." required />
<button type="submit">Send</button>
</form>
<pre id="output"></pre>
</main>
<script>
document.getElementById('chat').onsubmit=async(e)=>{
e.preventDefault();
const msg=e.target.msg.value;
const output=document.getElementById('output');
output.textContent='Sending...';
try{
  const resp=await fetch('/api/reply?msg='+encodeURIComponent(msg));
  const data=await resp.json();
  output.textContent=data.reply||JSON.stringify(data,null,2);
}catch(err){
  output.textContent='Error: '+err.message;
}};
</script>
</body>
</html>`;
}

// WebSocket 连接处理（VLESS over WS）
async function handleWs(request, env, ctx) {
  const wsPair = new WebSocketPair();
  const [client, server] = Object.values(wsPair);
  server.accept();

  server.addEventListener('message', async (e) => {
    try {
      const buffer = e.data instanceof ArrayBuffer ? e.data : e.data.buffer;
      const { hasError, portRemote } = parseHeader(buffer, user);
      if (hasError) return;

      // 中转到 IPv4 上游
      const tcpSocket = connect({ hostname: upstream, port: portRemote });
      const writer = tcpSocket.writable.getWriter();
      await writer.write(buffer.slice(24)); // 去掉 header
      writer.releaseLock();

      tcpSocket.readable.pipeTo(new WritableStream({
        write(chunk) { server.send(chunk); },
        close() { server.close(); },
        abort(err) { server.close(); }
      }));
    } catch (err) {
      console.error('WS message error:', err);
      server.close();
    }
  });

  server.addEventListener('close', () => server.close());
  return new Response(null, { status: 101, webSocket: client });
}

// 解析 VLESS Header
function parseHeader(buffer, userID) {
  if (buffer.byteLength < 24) return { hasError: true };
  const idCheck = new Uint8Array(buffer.slice(1,17));
  const userStr = Array.from(idCheck).map(x=>x.toString(16).padStart(2,'0')).join('-');
  if (userStr !== userID) return { hasError:true };
  const portRemote = new DataView(buffer.slice(19,21)).getUint16(0);
  return { hasError:false, portRemote };
}

// Worker 主入口
export default {
  async fetch(request, env, ctx) {
    user = env.user || user;
    target = env.target || target;
    upstream = env.upstream || upstream;

    if (!isValidUser(user)) return new Response('Invalid UUID', { status: 400 });

    const url = new URL(request.url);

    if (url.pathname === '/nodes') {
      return new Response(`vless://${user}@${url.host}:443?type=ws&security=tls&path=/?ed=2560`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (isWebSocket(request)) return handleWs(request, env, ctx);
    if (url.pathname.startsWith('/api/reply')) return handleApi(request);
    return new Response(getHtmlPage(), { status: 200, headers: { 'Content-Type': 'text/html' } });
  },
};
