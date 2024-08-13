/**
 * @des 连接数据库
 */
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

import certbotRoute from './certbotRoute.mjs'; // 导入 概念板块 相关接口

// 使用 certbotRoute
app.use('/mysql', certbotRoute);

/** ----------------------------------------------------开启服务监听---------------------------------------- */
app.listen(7005, () => {
  console.log('\x1b[35m%s\x1b[0m', 'mysql server working...');
});

export default app;
