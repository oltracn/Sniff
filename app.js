import express from 'express';
import cors from 'cors';
import apiRouter from './src/routes/api.js';
import os from 'os';

const app = express();
const port = 3000;

app.use(express.json());
// 启用 CORS，允许来自移动设备或其他主机的请求（可根据需要收紧 origin）
app.use(cors());

// 根路由
app.get('/', (req, res) => {
  res.send('Hello, Sniff!');
});

// API 路由
app.use('/api', apiRouter);

app.listen(port, '0.0.0.0', () => {
  // 找到第一个非内部的 IPv4 地址用于局域网访问提示
  const ifaces = os.networkInterfaces();
  let lan = 'localhost';
  // 优先选择私有网段地址（10.*, 192.168.*, 172.16-31.*），并跳过常见的虚拟/隧道网卡名称
  const isPrivate = (ip) => /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
  const skipIfName = (name) => /(clash|tun|tap|docker|veth|vm|virtual|hyper|loopback|lo)/i.test(name);

  let candidate = null;
  for (const name of Object.keys(ifaces)) {
    if (skipIfName(name)) continue;
    for (const iface of ifaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      // 跳过保留/实验性的网段（如 Clash tun 使用的 198.18.*）或链路本地地址
      if (/^198\.18\.|^169\.254\./.test(iface.address)) continue;
      if (isPrivate(iface.address)) {
        lan = iface.address;
        candidate = null;
        break;
      }
      if (!candidate) candidate = iface.address;
    }
    if (lan !== 'localhost') break;
  }
  if (lan === 'localhost' && candidate) lan = candidate;

  console.log(`Sniff backend listening at http://localhost:${port}`);
  console.log(`LAN access: http://${lan}:${port}`);
});