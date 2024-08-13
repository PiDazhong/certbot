/**
 * @des 公共变量
 */

import mysql from 'mysql2';
import _ from 'lodash';
import { exec } from 'child_process';
import {
  isProd,
  connectionInfo,
  DB_NAME,
  CRYPTO_KEY,
  sshConfig,
} from './constsStatic.mjs';

export { sshConfig, isProd, connectionInfo, DB_NAME, CRYPTO_KEY };

/** ------------------------------------------------以下是可以全量更新的部分------------------------------------------------ */

// log函数
export const log = (str) => {
  if (isProd) {
    return;
  }
  console.log('\x1b[35m%s\x1b[0m', `req.body: ${str}`);
};

// 函数：执行系统命令
export const runExecFroService = (execStr) => {
  exec(execStr, (error, stdout, stderr) => {
    if (error) {
      console.error(`命令执行错误: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`命令执行错误: ${stderr}`);
      return;
    }
    console.log(`命令执行成功: ${stdout}`);
  });
};

/** 延时方法 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connection = mysql.createPool(connectionInfo);

/** 执行sql的方法 */
export const runSql = (sql, name = 'name') => {
  return new Promise((resolve, reject) => {
    log(`==${name}==: ${sql}`);
    connection.query(sql, (err, result, fields) => {
      if (result) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
};

/** 专门处理 先查后插 的方法   没有则插入 有则什么都不干 */
export const insertAfterQuery = async (querySql, insertSql) => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await runSql(querySql);
      if (!(data?.length > 0)) {
        await runSql(insertSql);
        resolve(true);
      } else {
        resolve(true);
      }
    } catch (e) {
      reject(false);
    }
  });
};

/** 专门处理 先查 => 有数据则更新，无数据则插入 的方法 */
export const insertOrUpdateAfterQuery = async (
  querySql,
  updateSql,
  insertSql,
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await runSql(querySql);
      if (data?.length > 0) {
        if (updateSql) {
          await runSql(updateSql);
        }
        resolve(true);
      } else {
        if (insertSql) {
          await runSql(insertSql);
        }
        resolve(true);
      }
    } catch (e) {
      reject(false);
    }
  });
};
