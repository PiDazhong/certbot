/**
 * @des 用户列表 相关接口
 */
import express from 'express';

import { DB_NAME, isProd, runSql, sshConfig } from './constsES5.mjs';

const router = express.Router();

let globalConn = {};

// 获取 板块预览页面的分布 的接口
router.post('/getRemainNums', async (req, res) => {
  const { invitationCode } = req.body;

  try {
    const querySql = `
      select nums from ${DB_NAME}.invitation_code_table
      where 1=1 
      and code='${invitationCode}'
    `;

    const results = await runSql(querySql);

    if (results.length > 0) {
      res.send({
        success: true,
        data: results[0]?.nums,
      });
    } else {
      res.send({
        error: '邀请码无效',
      });
    }
  } catch (e) {
    res.send({
      error: '查询失败',
    });
  }
});

const sendSSHQuery = async (invitationCode, domain, newNums) => {
  return new Promise(async (resolve, reject) => {
    try {
      const processId = Date.now(); // 获取当前时间戳作为 processId
      console.log('processId', processId);

      // 查询库中是否有正在进行的进程
      const querySql = `
        SELECT process_id, status 
        FROM ${DB_NAME}.process_id_table
        WHERE status='running' AND domain='${domain}'
      `;
      const results = await runSql(querySql);

      // 如果有正在进行的进程，则删除该记录
      if (results.length > 0) {
        await runSql(
          `DELETE FROM ${DB_NAME}.process_id_table WHERE domain='${domain}'`,
        );
        console.log('删除正在进行的进程');
      }

      // 初始化 SSH 连接
      globalConn[processId] = new Client();
      const conn = globalConn[processId];

      conn
        .on('ready', async () => {
          console.log('连接服务器成功');

          try {
            // 创建SFTP会话
            const sftp = await createSftpSession(conn);
            console.log('SFTP 会话已创建');

            // 执行 certbot 命令
            const certbotCmd = `sudo certbot certonly --manual --preferred-challenges dns -d "*.${domain}" -d "${domain}"`;
            const txtRecord = await executeCertbotCommand(
              conn,
              certbotCmd,
              domain,
              newNums,
              processId,
            );
            console.log('提取到的 TXT 记录:', txtRecord);

            // 成功提取 TXT 记录，返回结果
            resolve({
              success: true,
              data: {
                text: txtRecord,
                newNums,
                processId,
              },
            });
          } catch (err) {
            console.error('SSH 操作错误:', err);
            reject({ error: err.message });
          } finally {
            // 根据需要选择是否关闭连接
            // conn.end(); // 如果不需要保留连接，取消注释此行
          }
        })
        .on('error', (err) => {
          console.error('连接错误:', err);
          reject({ error: 'SSH 连接失败: ' + err.message });
        })
        .connect(sshConfig);
    } catch (err) {
      console.error('初始化错误:', err);
      reject({ error: err.message });
    }
  });
};

// 辅助函数：创建SFTP会话
const createSftpSession = (conn) => {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(new Error('SFTP 错误: ' + err.message));
      } else {
        resolve(sftp);
      }
    });
  });
};

// 辅助函数：执行certbot命令并提取TXT记录
const executeCertbotCommand = (conn, cmd, domain, newNums, processId) => {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let matched = false;

    conn.exec(cmd, (err, stream) => {
      if (err) {
        reject(new Error('certbot 错误: ' + err.message));
        return;
      }

      console.log('certbot命令正在执行');

      // 将该进程插入到数据库中
      const insertSql = `
        INSERT INTO ${DB_NAME}.process_id_table (process_id, status, domain)
        VALUES ('${processId}', 'running', '${domain}')
      `;
      runSql(insertSql);

      stream
        .on('close', () => {
          console.log('Stream关闭');
          if (!matched) {
            reject(new Error('连接关闭，未能匹配到所需的 TXT 记录'));
          }
        })
        .on('data', (data) => {
          buffer += data.toString();
          console.log('STDOUT:', data.toString());

          const regex = /with the following value:\s+([a-zA-Z0-9_-]+)/;
          const match = buffer.match(regex);
          if (match && match[1]) {
            matched = true;
            resolve(match[1]);
          }
        })
        .stderr.on('data', (errData) => {
          console.error('STDERR:', errData.toString());
          reject(new Error('STDERR: ' + errData.toString()));
        });

      // 定时器在 10 秒后强制关闭连接
      setTimeout(() => {
        if (!matched) {
          console.log('10秒内未匹配到所需的 TXT 记录，终止连接');
          reject(new Error('10秒内未匹配到所需的 TXT 记录，终止连接'));
        }
      }, 10000);
    });
  });
};

// 假设你有一个执行本地命令的辅助函数
const execLocalCommand = async (cmd) => {
  return new Promise((resolve, reject) => {
    const exec = require('child_process').exec;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(`执行命令时发生错误: ${stderr}`);
      } else {
        resolve(stdout);
      }
    });
  });
};

// 辅助函数：执行命令并设置超时
const executeWithTimeout = (cmd, timeout) => {
  return new Promise((resolve, reject) => {
    const exec = require('child_process').exec;
    const child = exec(cmd);

    let buffer = ''; // 缓存命令输出
    let isTimedOut = false;

    // 监听命令输出
    child.stdout.on('data', (data) => {
      buffer += data.toString();
    });

    child.stderr.on('data', (data) => {
      buffer += data.toString();
    });

    // 监听命令结束
    child.on('close', (code) => {
      if (!isTimedOut) {
        resolve(buffer);
      }
    });

    // 设置超时处理
    setTimeout(() => {
      isTimedOut = true;
      child.kill(); // 终止命令
      reject(new Error('命令执行超时'));
    }, timeout);
  });
};

const sendQuery = async (invitationCode, domain, newNums) => {
  try {
    const processId = Date.now(); // 获取当前时间戳作为 processId
    console.log('processId', processId);

    // 查询数据库中是否有正在进行的进程
    const querySql = `
      SELECT process_id, status 
      FROM ${DB_NAME}.process_id_table
      WHERE status='running' AND domain='${domain}'
    `;
    const results = await runSql(querySql);
    console.log('查询结果:', results);

    // 如果有正在进行的进程，则删除该记录
    if (results.length > 0) {
      await runSql(
        `DELETE FROM ${DB_NAME}.process_id_table WHERE domain='${domain}'`,
      );
      console.log('删除正在进行的进程');
    }

    // 执行 certbot 命令
    const certbotCmd = `sudo certbot certonly --manual --preferred-challenges dns -d "*.${domain}" -d "${domain}"`;

    const execResult = await executeWithTimeout(certbotCmd, 10000); // 设置10秒超时
    console.log('certbot 执行结果:', execResult);

    // 使用正则表达式匹配输出中的 TXT 记录
    const regex = /with the following value:\s+([a-zA-Z0-9_-]+)/;
    const match = execResult.match(regex);

    if (match && match[1]) {
      const txtRecord = match[1];
      console.log('提取出的 TXT 记录:', txtRecord);

      // 将该进程插入到数据库中
      const insertSql = `
        INSERT INTO ${DB_NAME}.process_id_table (process_id, status, domain)
        VALUES ('${processId}', 'running', '${domain}')
      `;
      await runSql(insertSql);

      return {
        success: true,
        message: '操作成功',
        data: {
          text: txtRecord,
          newNums,
          processId,
        },
      };
    } else {
      return {
        error: '未能匹配到所需的 TXT 记录',
      };
    }
  } catch (err) {
    console.error('生产环境操作错误:', err);
    return {
      error: err.message,
    };
  }
};

// 开始证书的申请 的接口
router.post('/applyCertbot', async (req, res) => {
  const { invitationCode, domain } = req.body;

  try {
    const querySql = `
      select nums from ${DB_NAME}.invitation_code_table
      where 1=1 
      and code='${invitationCode}'
    `;
    const nums = (await runSql(querySql))[0]?.nums;

    if (nums > 0) {
      const newNums = nums - 1;
      const querySql = `
        update ${DB_NAME}.invitation_code_table
        set nums=${newNums}
        where 1=1 
        and code='${invitationCode}'
      `;
      await runSql(querySql);

      if (!isProd) {
        const result = await sendSSHQuery(invitationCode, domain, newNums);
        res.send(result);
      } else {
        const result = await sendQuery(invitationCode, domain, newNums);
        res.send(result);
      }
    } else {
      res.send({
        error: `邀请码可用次数${nums}`,
      });
    }
  } catch (e) {
    console.log('e', e);
    res.send({
      error: '申请失败',
    });
  }
});

// 开始证书的下载 接口
router.post('/downCertbot', async (req, res) => {
  const { processId } = req.body;

  try {
    // 从全局存储中获取对应的 SSH 连接
    const conn = globalConn[processId];

    if (!conn) {
      return res.send({
        error: '无法找到对应的 SSH 连接',
      });
    }

    // 执行回车键来继续证书下载
    conn.exec(' ', (err, stream) => {
      if (err) {
        console.error('exec 错误:', err);
        return res.send({
          error: '执行回车键失败',
        });
      }

      let buffer = '';
      let success = false;

      stream
        .on('close', () => {
          if (!success) {
            res.send({
              error: '未成功获取到证书下载的结果',
            });
          }
        })
        .on('data', (data) => {
          console.log('STDOUT:', data.toString());
          buffer += data.toString();

          // 解析数据，根据具体的命令输出来判断证书是否下载成功
          if (
            buffer.includes(
              'Congratulations! Your certificate and chain have been saved',
            )
          ) {
            success = true;
            res.send({
              success: true,
              message: '证书下载成功',
            });
          }
        })
        .stderr.on('data', (errData) => {
          console.error('STDERR:', errData.toString());
          res.send({
            error: `证书下载过程中发生错误: ${errData.toString()}`,
          });
        });
    });
  } catch (e) {
    console.log('e', e);
    res.send({
      error: `申请失败 ${e}`,
    });
  }
});

export default router;
