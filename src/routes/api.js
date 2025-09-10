
import express from 'express';
import urlRouter from './url.js';
import sniffRouter from './sniff.js';
import musicRouter from './music.js';
import userRouter from './user.js';
import guestRouter from './guest.js';

const router = express.Router();

// 挂载 url 子路由
router.use('/urls', urlRouter);

// 挂载 sniff 子路由
router.use('/sniffs', sniffRouter);

// 挂载 music 子路由
router.use('/music', musicRouter);

// 挂载 user 子路由
router.use('/users', userRouter);

// 挂载 guest 路由
router.use('/guests', guestRouter);

export default router;
