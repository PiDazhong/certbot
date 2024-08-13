/**
 * @des 用户列表 相关接口
 */
import express from 'express';
import { exec } from 'child_process';

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

const sendQuery = async (invitationCode, domain, newNums) => {
  return new Promise(async (resolve, reject) => {
    const processId = Date.now(); // 获取当前时间戳作为 processId
    console.log('processId', processId);

    try {
      const querySql = `
        SELECT process_id, status 
        FROM ${DB_NAME}.process_id_table
        WHERE status='running' AND domain='${domain}'
      `;
      const results = runSql(querySql);
      // 如果有正在进行的进程，则删除该记录
      if (results.length > 0) {
        await runSql(
          `DELETE FROM ${DB_NAME}.process_id_table WHERE domain='${domain}'`,
        );
      }

      const certbotCmd = `sudo certbot certonly --manual --preferred-challenges dns -d "*.${domain}" -d "${domain}"`;
      // 初始化 SSH 连接
      const child = exec(certbotCmd);
      globalConn[processId] = child;
      let buffer = '';
      let matched = false;

      child.stdout.on('data', (data) => {
        buffer += data.toString();
        console.log('STDOUT:', data.toString());
      });

      child.stderr.on('data', (errData) => {
        console.error('STDERR:', errData.toString());
        reject(new Error('STDERR: ' + errData.toString()));
      });

      // 启动定时器，每秒检查一次缓存的数据
      const timer = setInterval(() => {
        const regex = /with the following value:\s+([a-zA-Z0-9_-]+)/;
        const match = buffer.match(regex);
        if (match && match[1]) {
          matched = true;
          const txtRecord = match[1];
          console.log('提取出的 TXT 记录:', txtRecord);

          clearInterval(timer); // 清除定时器
          // 保存匹配到的结果到 global.processid
          global.processid = global.processid || {};
          global.processid[processId] = { txtRecord };

          resolve({
            success: true,
            data: {
              text: txtRecord,
              newNums,
              processId,
            },
          });
        }
      }, 1000);

      // 10秒后检查是否匹配成功，未成功则终止进程
      setTimeout(() => {
        if (!matched) {
          console.log('10秒内未匹配到所需的 TXT 记录，终止进程');
          clearInterval(timer); // 清除定时器
          child.kill(); // 终止命令进程
          resolve({
            error: `10秒内未匹配到所需的 TXT 记录`,
          });
        }
      }, 10000);
    } catch (err) {
      console.error('错误:', err);
      reject(new Error('error: ' + err.toString()));
    }
  });
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
      error: `申请失败 ${e}`,
    });
  }
});

// 开始证书的下载 接口
router.post('/downCertbot', (req, res) => {
  const { processId, domain } = req.body;

  const child = globalConn[processId];

  if (!child) {
    return res.send({
      error: '无法找到对应的进程',
    });
  }

  // 继续向进程中发送输入
  child.stdin.write('\n'); // 发送回车

  let buffer = '';
  let responseSent = false;

  const sendResponse = (response) => {
    if (!responseSent) {
      responseSent = true;
      res.send(response);
      // 确保在发送响应后，正确关闭进程并清理资源
      child.kill();
      delete globalConn[processId];
    }
  };

  child.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('STDOUT:', output);
    buffer += output;

    // 正则检测 "verify the TXT record has been deployed" 的提示
    const pressEnterRegex = /verify the TXT record has been deployed/;
    if (pressEnterRegex.test(output)) {
      child.stdin.write('\n'); // 如果匹配到提示，则继续输入回车
    }

    // 正则检测 "Some challenges have failed" 的提示
    const overRegex = /Some challenges have failed/;
    if (overRegex.test(output)) {
      sendResponse({
        error: `证书下载过程中发生错误: ${output}`,
      });
    }

    // 正则检测 "Successfully received certificate" 的提示
    const successRegex = /Successfully received certificate/;
    if (successRegex.test(output)) {
      // 生成压缩包命令
      const destinationPath = '/icons/Certificate';
      const folderPath = `/etc/letsencrypt/live/${domain}`;
      const zipCommand = `zip -r ${destinationPath}/${processId}.zip ${folderPath}`;
      exec(zipCommand, (err, stdout, stderr) => {
        if (err) {
          // 证书下载成功
          sendResponse({
            error: `执行压缩证书文件夹命令时出错: ${stderr}`,
          });
        } else {
          sendResponse({
            success: true,
            data: `https://certbot.quantanalysis.cn${destinationPath}/${processId}.zip`,
          });
        }
      });
    }

    // 检测证书下载成功的提示
    if (
      buffer.includes(
        'Congratulations! Your certificate and chain have been saved',
      )
    ) {
      sendResponse({
        success: true,
        message: '证书下载成功',
      });
    }
  });

  child.stderr.on('data', (errData) => {
    console.error('STDERR:', errData.toString());
    sendResponse({
      error: `证书下载过程中发生错误: ${errData.toString()}`,
    });
  });

  child.on('close', (code) => {
    if (!responseSent) {
      sendResponse({
        error: '未成功获取到证书下载的结果',
      });
    }
    // 无论如何，确保进程被杀死并清理资源
    delete globalConn[processId];
  });
});

export default router;
