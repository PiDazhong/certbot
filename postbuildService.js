import fs from 'fs';
import { Client } from 'ssh2';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 获取当前模块的文件路径
const __filename = fileURLToPath(import.meta.url);

// 获取当前模块的目录路径
const __dirname = path.dirname(__filename);

// 检查最近一次 commit 是否有变更指定文件
const checkCommitChanges = (filepaths) => {
  try {
    // 获取最近一次 commit 的文件变更列表
    const changes = execSync('git diff --name-only HEAD^ HEAD')
      .toString()
      .trim()
      .split('\n');
    // 检查变更的文件列表中是否包含指定文件
    const hasChanges = changes.some((file) => filepaths.includes(file));
    return hasChanges;
  } catch (error) {
    console.error('Error checking commit changes:', error);
    return false;
  }
};

const sshConfigStr = fs.readFileSync(
  '/Users/ming/Downloads/ssh/sshConfig.json',
  'utf8',
);
const sshConfig = JSON.parse(sshConfigStr);

const sqlServicePaths = ['scripts/certbotRoute.mjs'];
const remoteSqlPath = '/etc/nginx/service/OPSqlService';
const remoteSqlExecute = 'sudo systemctl restart myOPService.service';

// 上传文件 并 执行命令
const uploadAndExecute = async (localPaths, remotePath, sshConfig, execute) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('连接成功，开始上传文件...');
        conn.sftp((err, sftp) => {
          if (err) {
            // console.error('SFTP 错误:', err);
            conn.end();
            return;
          }
          let uploadCount = 0;

          localPaths.forEach((pathItem) => {
            const localPath = path.join(__dirname, pathItem);
            const remoteFilePath = `${remotePath}/${path.basename(pathItem)}`;

            // 获取本地文件大小
            const fileSize = (fs.statSync(localPath).size / 1024).toFixed(1);

            // 获取本地文件行数
            fs.readFile(localPath, 'utf8', (readErr, readData) => {
              if (readErr) {
                console.error('读取文件错误:', readErr);
                conn.end();
                return reject(readErr);
              }
              const lines = readData.split(/\r\n|\r|\n/).length;

              sftp.fastPut(localPath, remoteFilePath, {}, (err) => {
                if (err) {
                  // console.error('上传错误:', err);
                  conn.end();
                  return;
                }
                console.log(
                  `文件上传成功: ${pathItem.padEnd(30, ' ')}大小: ${fileSize
                    .toString()
                    .padEnd(6, ' ')}KB      行数: ${lines}`,
                );
                uploadCount++;

                // 如果所有文件上传完成，执行指定命令
                if (uploadCount === localPaths.length) {
                  console.log(`开始执行服务重启命令: ${execute} ...`);

                  conn.exec(`${execute}`, (err, stream) => {
                    if (err) {
                      // console.error('执行命令错误:', err);
                      conn.end();
                      return;
                    }

                    stream
                      .on('close', (code, sinal) => {
                        console.log('服务重启完成，关闭连接...');
                        conn.end();
                        resolve();
                      })
                      .on('data', (data) => {
                        // console.log('STDOUT', data.toString())
                      })
                      .stderr.on('data', (errData) => {
                        // console.error('STDERR', errData.toString())
                        reject(errData.toString());
                      });
                  });
                }
              });
            });
          });
        });
      })
      .connect(sshConfig);

    conn.on('error', (err) => {
      // console.error('连接错误:', err);
    });

    conn.on('end', () => {
      // console.log('连接结束');
    });

    conn.on('close', (hadError) => {
      if (hadError) {
        // console.error('连接关闭，发生错误');
      } else {
        // console.log('连接关闭');
      }
    });
  });
};

// 执行打包和上传解压流程
const main = async () => {
  try {
    console.log('正在检测后端文件是否变更...');
    const hasSqlChange = checkCommitChanges(sqlServicePaths);
    if (hasSqlChange) {
      console.log('存在 sqlService 文件变更...');
      await uploadAndExecute(
        sqlServicePaths,
        remoteSqlPath,
        sshConfig,
        remoteSqlExecute,
      );
      console.log('上传文件并执行 sqlService 重启命令完成\n');
    } else {
      console.log('无 sqlService 文件变更!!\n');
    }
    console.log('全部任务执行完成!!!');
    console.log(
      '--------------------------------------------------------------------------',
    );
  } catch (error) {
    console.error('操作失败:', error);
    process.exit(1); // 停止构建过程
  }
};

main();
