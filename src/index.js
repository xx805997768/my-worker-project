// Cloudflare Workers script for pseudo-ChatGPT page with WebSocket and API proxy using NAT64.
// Renders ChatGPT-like HTML for non-WebSocket/non-API requests.
// Proxies /api/reply with local echo to avoid external dependency failures (fixes 503).
// Handles WebSocket for TCP/UDP forwarding with VLESS and NAT64 IPv6 prefixes.
// Generates VLESS configs at /nodes: workers.dev (80-series), custom domain (80+443 series with TLS).
// Supports NAT64 (2a02:898:146:64::, 2602:fc59:b0:64::, 2602:fc59:11:64::) as target for IPv6-only proxying.
// Includes robust error handling and logging for V2RayN compatibility (10808/10809).
// For testing; proxy may violate ToS.

import { connect } from 'cloudflare:sockets';

// Defaults.
let user = '0acb0ed8-9c48-4048-b8d5-5c336bb76842'; // Override with env.user.
let target = '2a02:898:146:64::'; // NAT64 prefix, override with env.target (e.g., 2602:fc59:b0:64::).
const resolver = 'https://cloudflare-dns.com/dns-query';

// Validate user ID.
function isValidUser(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Check WebSocket.
function isWebSocket(request) {
  return request.headers.get('Upgrade') === 'websocket';
}

// Check API.
function isApi(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/reply') || url.pathname.startsWith('/conversation');
}

// Proxy API with local echo (no external fetch to avoid 503).
async function handleProxy(request) {
  try {
    const url = new URL(request.url);
    console.log('Proxy: Processing request for', url.pathname + url.search);
    return new Response(JSON.stringify({ reply: `Echo: ${url.searchParams.get('msg') || 'Hello'}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Proxy error:', err.message);
    return new Response(JSON.stringify({ reply: 'Simulated: Service busy, echoing query.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DNS resolution with retries.
async function resolveDomain(domain, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(`${resolver}?name=${domain}&type=A`, { headers: { 'Accept': 'application/dns-json' } });
      if (!response.ok) throw new Error(`DNS status ${response.status}`);
      const data = await response.json();
      const ip = data.Answer?.find((record) => record.type === 1)?.data;
      if (ip) return ip;
      throw new Error('No A record');
    } catch (err) {
      if (i === retries) return null;
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
}

// Restricted IP check (placeholder).
function isRestrictedIP(ip) {
  return false;
}

// ChatGPT page with enhanced UI.
function getChatPage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChatGPT - AI Assistant</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; display: flex; flex-direction: column; min-height:100vh; }
    header { background: #007bff; color: white; padding: 1rem; text-align: center; }
    main { max-width: 800px; margin: 2rem auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; }
    h1 { font-size: 1.8rem; margin: 0; }
    form { display: flex; gap: 1rem; margin-top: 1rem; }
    input { flex: 1; padding: 0.8rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; }
    button { padding: 0.8rem 1.5rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    pre { background: #f8f9fa; padding: 1rem; border-radius: 4px; white-space: pre-wrap; }
    .error { color: red; }
    footer { text-align: center; padding: 1rem; color: #666; }
  </style>
</head>
<body>
  <header><h1>ChatGPT - AI Assistant</h1></header>
  <main><p>Send a message to our AI assistant:</p><form id="chat"><input name="msg" placeholder="Type your message..." required /><button type="submit">Send</button></form><pre id="output"></pre></main>
  <footer><p>&copy; 2025 AI Assistant Platform</p></footer>
  <script>
    document.getElementById('chat').onsubmit=async(e)=>{e.preventDefault();const msg=e.target.msg.value,output=document.getElementById('output');output.textContent='Sending...';try{const resp=await fetch('/api/reply?msg='+encodeURIComponent(msg));if(!resp.ok)throw new Error('Status: '+resp.status);const data=await resp.json();output.textContent=data.reply||JSON.stringify(data,null,2);output.classList.remove('error')}catch(err){output.textContent='Error: '+err.message+'. Please try again.';output.classList.add('error')}};
  </script>
</body>
</html>`;
}

// Main handler.
export default {
  async fetch(request, env, ctx) {
    try {
      user = env.user || user;
      target = env.target || target;
      if (!isValidUser(user)) {
        return new Response('Invalid user ID', { status: 400 });
      }
      const url = new URL(request.url);
      const hostName = request.headers.get('Host');
      
      if (url.pathname === '/nodes') {
        const configs = generateConfigs(user, hostName);
        return new Response(configs, { status: 200, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      }

      if (isWebSocket(request)) {
        return await handleConnection(request, ctx);
      } else if (isApi(request)) {
        return await handleProxy(request);
      }

      return new Response(getChatPage(), { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    } catch (err) {
      console.error('Fetch error:', err.message);
      ctx.waitUntil(Promise.resolve().then(() => console.error('Logged:', err.message)));
      return new Response(getChatPage(), { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }
  },
};

// WebSocket connection with NAT64 support.
async function handleConnection(request, ctx) {
  try {
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    webSocket.accept();
    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    const readableStream = makeReadableStream(webSocket, earlyDataHeader);
    let remoteSocket = { value: null };
    let udpWrite = null;
    let isDns = false;
    let address = '';
    let portLog = '';

    webSocket.addEventListener('close', () => {
      safeClose(webSocket);
      if (remoteSocket.value) remoteSocket.value.close();
    });

    await readableStream.pipeTo(new WritableStream({
      async write(chunk) {
        try {
          if (isDns && udpWrite) {
            udpWrite(chunk);
            return;
          }
          if (remoteSocket.value) {
            const writer = remoteSocket.value.writable.getWriter();
            try {
              await writer.write(chunk);
            } finally {
              writer.releaseLock();
            }
            return;
          }
          const { hasError, message, portRemote = 443, addressRemote = '', rawDataIndex, version = new Uint8Array([0, 0]), isUDP, addressType } = parseHeader(chunk, user);
          if (hasError) throw new Error(message);
          address = addressRemote;
          portLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp' : 'tcp'}`;
          if (isUDP && portRemote === 53) isDns = true;
          else if (isUDP) throw new Error('UDP only for DNS (53)');
          const responseHeader = new Uint8Array([version[0], 0]);
          const rawData = chunk.slice(rawDataIndex);
          if (isDns) {
            const { write } = await handleUDP(webSocket, responseHeader);
            udpWrite = write;
            udpWrite(rawData);
            return;
          }
          let resolvedAddress = addressRemote;
          if (addressType === 2) {
            const queryIP = await resolveDomain(addressRemote);
            if (queryIP && isRestrictedIP(queryIP)) {
              resolvedAddress = `[2602:fc59:b0:64::]`; // NAT64 fallback
            } else if (queryIP) {
              resolvedAddress = queryIP;
            } else {
              resolvedAddress = addressRemote;
            }
          }
          await handleTCP(remoteSocket, resolvedAddress, portRemote, rawData, webSocket, responseHeader);
        } catch (writeErr) {
          console.error('Write error:', writeErr.message);
          throw writeErr;
        }
      },
      close() {
        console.log(`[ ${address}:${portLog} ] Stream closed`);
      },
      abort(reason) {
        console.error(`[ ${address}:${portLog} ] Stream aborted:`, reason);
      },
    }));
    ctx.waitUntil(Promise.resolve(readableStream.cancel()));
    return new Response(null, { status: 101, webSocket: client });
  } catch (err) {
    console.error('Connection error:', err.message);
    return new Response('WebSocket connection failed', { status: 500 });
  }
}

// TCP outbound with NAT64 and IPv6 support.
async function handleTCP(remoteSocket, addressRemote, portRemote, rawData, webSocket, responseHeader) {
  try {
    let address = addressRemote.endsWith('.workers.dev') || addressRemote === 'workers.dev' ? target : addressRemote;
    if (address.includes('::')) address = `[${address}]`; // Format IPv6
    if (!address || isRestrictedIP(address)) address = `[2602:fc59:11:64::]`; // Fallback NAT64
    async function connectAndWrite(port) {
      const tcpSocket = connect({ hostname: address, port });
      remoteSocket.value = tcpSocket;
      const writer = tcpSocket.writable.getWriter();
      try {
        await writer.write(rawData);
      } finally {
        writer.releaseLock();
      }
      return tcpSocket;
    }
    async function retry(attempt = 0) {
      if (attempt > 3) return; // Increased retry limit
      try {
        const tcpSocket = await connectAndWrite(portRemote);
        tcpSocket.closed.catch(() => {}).finally(() => safeClose(webSocket));
        await pipeSocket(tcpSocket, webSocket, responseHeader, () => retry(attempt + 1));
      } catch (retryErr) {
        console.error('Retry failed:', retryErr.message);
        await new Promise(resolve => setTimeout(resolve, 300)); // Increased delay
        retry(attempt + 1);
      }
    }
    const tcpSocket = await connectAndWrite(portRemote);
    await pipeSocket(tcpSocket, webSocket, responseHeader, retry);
  } catch (err) {
    console.error('TCP error:', err.message);
    safeClose(webSocket);
    throw err;
  }
}

// Readable WebSocket stream.
function makeReadableStream(webSocketServer, earlyDataHeader) {
  let cancelFlag = false;
  const stream = new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener('message', (event) => {
        if (cancelFlag) return;
        controller.enqueue(event.data);
      });
      webSocketServer.addEventListener('close', () => {
        if (cancelFlag) return;
        controller.close();
      });
      webSocketServer.addEventListener('error', (err) => controller.error(err));
      const { earlyData, error } = decodeEarlyData(earlyDataHeader);
      if (error) controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    cancel() {
      cancelFlag = true;
      safeClose(webSocketServer);
    },
  });
  return stream;
}

// Parse header.
function parseHeader(buffer, userID) {
  try {
    if (buffer.byteLength < 24) return { hasError: true, message: 'Invalid data' };
    const version = new Uint8Array(buffer.slice(0, 1));
    if (formatBytes(new Uint8Array(buffer.slice(1, 17))) !== userID) return { hasError: true, message: 'Invalid user' };
    const optLength = new Uint8Array(buffer.slice(17, 18))[0];
    const command = new Uint8Array(buffer.slice(18 + optLength, 19 + optLength))[0];
    let isUDP = false;
    if (command === 1) {
      // TCP
    } else if (command === 2) {
      isUDP = true;
    } else {
      return { hasError: true, message: `Command ${command} not supported` };
    }
    const portIndex = 19 + optLength;
    const portRemote = new DataView(buffer.slice(portIndex, portIndex + 2)).getUint16(0);
    const addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(buffer.slice(addressIndex, addressIndex + 1));
    const addressType = addressBuffer[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    switch (addressType) {
      case 1:
        addressLength = 4;
        addressValue = new Uint8Array(buffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
        break;
      case 2:
        addressLength = new Uint8Array(buffer.slice(addressValueIndex, addressValueIndex + 1))[0];
        addressValueIndex += 1;
        addressValue = new TextDecoder().decode(buffer.slice(addressValueIndex, addressValueIndex + addressLength));
        break;
      case 3:
        addressLength = 16;
        const dataView = new DataView(buffer.slice(addressValueIndex, addressValueIndex + addressLength));
        const ipv6 = [];
        for (let i = 0; i < 8; i++) ipv6.push(dataView.getUint16(i * 2).toString(16));
        addressValue = ipv6.join(':');
        break;
      default:
        return { hasError: true, message: `Invalid address type ${addressType}` };
    }
    if (!addressValue) return { hasError: true, message: `Address empty, type ${addressType}` };
    return { hasError: false, addressRemote: addressValue, portRemote, rawDataIndex: addressValueIndex + addressLength, version, isUDP, addressType };
  } catch (err) {
    return { hasError: true, message: err.message };
  }
}

// Pipe socket to WebSocket.
async function pipeSocket(remoteSocket, webSocket, responseHeader, retry) {
  let header = responseHeader;
  let hasData = false;
  await remoteSocket.readable.pipeTo(new WritableStream({
    async write(chunk) {
      if (!hasData) {
        hasData = true;
        if (header) chunk = new Uint8Array([...header, ...chunk]);
      }
      webSocket.send(chunk);
    },
    close() {
      safeClose(webSocket);
    },
    abort(reason) {
      console.error('Pipe error:', reason);
    },
  })).catch((error) => {
    console.error('Pipe error:', error);
    safeClose(webSocket);
    if (retry) retry();
  });
}

// Safe WebSocket close.
function safeClose(socket) {
  try {
    if (socket.readyState === 1) socket.close();
  } catch (error) {
    console.error('Close error:', error);
  }
}

// UDP (DNS only).
async function handleUDP(webSocket, responseHeader) {
  let isClosed = false;
  const udpSocket = connect({ hostname: '2001:4860:4860::8888', port: 53 }); // Google DNS64
  udpSocket.closed.catch(() => {}).finally(() => {
    isClosed = true;
    safeClose(webSocket);
  });
  const writer = udpSocket.writable.getWriter();
  return {
    write(chunk) {
      if (isClosed) throw new Error('UDP closed');
      writer.write(chunk);
    },
  };
}

// Decode early data.
function decodeEarlyData(base64Str) {
  if (!base64Str) return { earlyData: null, error: null };
  try {
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { earlyData: null, error };
  }
}

// Format bytes to ID.
function formatBytes(arr) {
  const id = [];
  for (let i = 0; i < arr.length; i += 2) {
    id.push(byteToHex[arr[i]] + byteToHex[arr[i + 1]]);
  }
  return id.join('-');
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push(i.toString(16).padStart(2, '0'));
}

// VLESS configs with dynamic TLS and NAT64 support.
function generateConfigs(userID, hostName) {
  const httpPorts = ['80', '8080', '8880', '2052', '2082', '2086', '2095']; // 80-series.
  const httpsPorts = ['443', '8443', '2053', '2083', '2087', '2096']; // 443-series.
  const isWorkersDev = hostName.endsWith('.workers.dev');
  const portsToUse = isWorkersDev ? httpPorts : [...httpPorts, ...httpsPorts];
  let configs = '连接节点信息：\n\n';
  if (isWorkersDev) {
    configs += '非TLS (HTTP, 80系列端口) 配置：\n';
  } else {
    configs += '非TLS (HTTP, 80系列端口) 配置：\nTLS (HTTPS, 443系列端口) 配置：\n';
  }
  for (const port of portsToUse) {
    const isHttps = httpsPorts.includes(port);
    const security = isHttps ? 'tls' : 'none';
    const allowInsecure = isHttps ? '&allowInsecure=false' : '';
    configs += `vless://${userID}@${hostName}:${port}?type=ws&security=${security}&path=/?ed=2560&host=${hostName}${allowInsecure}#${hostName}-${security.toUpperCase()}-${port}\n`;
  }
  configs += '\n地址：自定义域名/优选域名/IP/反代IP (NAT64: 2a02:898:146:64::)\n传输协议：ws/websocket\n伪装域名：workers.dev分配域名\n路径：/?ed=2560';
  return configs;
}
