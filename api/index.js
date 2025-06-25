// api/index.js
const express = require('express');

const app = express();

// 解析 JSON 请求体
app.use(express.json());

// CORS 允许所有来源（开发时方便，生产环境需限制）
const cors = require('cors'); // 这里用到了 cors，所以等下要安装它
app.use(cors());

// 定义一个简单的 GET 路由作为测试
app.get('/api/hello', (req, res) => {
  res.status(200).json({ message: 'Hello from your backend API!' });
});

// 这里将是你的音乐信息分析接口路由

// Vercel Serverless Function 的默认导出
module.exports = app;