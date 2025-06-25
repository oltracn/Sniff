// api/index.js
const express = require('express');
const cors = require('cors'); // 之前已提到
const dotenv = require('dotenv'); // 导入 dotenv

// 只有在非生产环境下才从 .env 文件加载环境变量
// Vercel 在部署时会自动注入环境变量，不需要 .env 文件
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();

app.use(express.json());
app.use(cors());

app.get('/api/hello', (req, res) => {
  res.status(200).json({ message: 'Hello from your backend API!' });
});

module.exports = app;