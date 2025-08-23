import express from 'express';
import apiRouter from './src/routes/api.js';

const app = express();
const port = 3000;

app.use(express.json());

// 根路由
app.get('/', (req, res) => {
  res.send('Hello, Sniff!');
});

// API 路由
app.use('/api', apiRouter);

app.listen(port, () => {
  console.log(`Sniff backend listening at http://localhost:${port}`);
});