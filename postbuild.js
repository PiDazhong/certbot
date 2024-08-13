import fs from 'fs';
import archiver from 'archiver';
import { Client } from 'ssh2';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块的文件路径
const __filename = fileURLToPath(import.meta.url);

// 获取当前模块的目录路径
const __dirname = path.dirname(__filename);

// 打包产物构建
const archiveBuild = (buildDir, outputPath) => {
  return new Promise((resolve, reject) => {
    // 删除本地现有的 d.zip 文件
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    output.on('close', () => {
      // 获取压缩包文件大小
      const fileSizeInBytes = archive.pointer();
      const fileSizeInKB = fileSizeInBytes / 1024;
      const fileSize = fileSizeInKB.toFixed(0) + ' KB';

      // 输出压缩包大小信息
      console.log(`打包完成，包大小: ${fileSize}`);
      resolve();
    });
    output.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(buildDir, false);
    archive.finalize();
  });
};

// 上传并解压
const uploadAndExtract = (
  localPath,
  remoteZipPath,
  remoteDirPath,
  sshConfig,
  retries = 1,
) => {
  return new Promise((resolve, reject) => {
    const attemptUpload = (retryCount) => {
      const conn = new Client();

      conn
        .on('ready', () => {
          console.log('连接服务器成功，开始上传文件...');
          conn.sftp((err, sftp) => {
            if (err) {
              console.error('SFTP 错误:', err);
              return handleRetry(retryCount, err);
            }

            sftp.fastPut(localPath, remoteZipPath, {}, (err) => {
              if (err) {
                console.error('上传错误:', err);
                return handleRetry(retryCount, err);
              }
              const execute = `
                unzip -o ${remoteZipPath} -d ${remoteDirPath} &&
                chmod -R 755 ${remoteDirPath} 
              `;
              console.log(`上传完成，开始执行解压任务命令: ${execute}  ...`);
              conn.exec(execute, (err, stream) => {
                if (err) {
                  console.error('解压错误:', err);
                  return handleRetry(retryCount, err);
                }

                stream
                  .on('close', (code, sinal) => {
                    console.log('解压完成，关闭连接...');
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
            });
          });
        })
        .connect(sshConfig);

      conn.on('error', (err) => {
        // console.error('连接错误:', err);
        handleRetry(retryCount, err);
      });

      conn.on('end', () => {
        // console.log('连接结束');
      });

      conn.on('close', (hadError) => {
        if (hadError) {
          // console.error('连接关闭，发生错误');
          handleRetry(retryCount, new Error('连接关闭'));
        } else {
          // console.log('连接关闭');
        }
      });
    };

    const handleRetry = (retryCount, err) => {
      if (retryCount > 0) {
        console.log(`重试中... (${retries - retryCount + 1}/${retries})`);
        setTimeout(() => attemptUpload(retryCount - 1), 1000);
      } else {
        reject(new Error(`操作失败: ${err.message}`));
      }
    };

    attemptUpload(retries);
  });
};

// 配置参数
const buildDir = path.join(__dirname, 'certbot');
const outputPath = path.join(__dirname, 'certbot.zip');
const remoteZipPath = '/etc/nginx/html/certbot.zip';
const remoteDirPath = '/etc/nginx/html/certbot';

const sshConfigStr = fs.readFileSync(
  '/Users/ming/Downloads/ssh/sshConfig.json',
  'utf8',
);
const sshConfig = JSON.parse(sshConfigStr);

// 执行打包和上传解压流程
const main = async () => {
  try {
    console.log(
      '--------------------------------------------------------------------------',
    );
    console.log('正在打包构建产物...');
    await archiveBuild(buildDir, outputPath);
    console.log('开始上传并解压...');
    await uploadAndExtract(outputPath, remoteZipPath, remoteDirPath, sshConfig);
    console.log('上传并解压任务完成!!!');
    // 删除本地的 build.zip 文件
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    console.log(
      '--------------------------------------------------------------------------',
    );
  } catch (error) {
    console.error('操作失败:', error);
    prcess.exit(1); // 停止构建过程
  }
};

main();
