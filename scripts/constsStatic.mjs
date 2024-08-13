/**
 * @des 公共变量   不可更改的变量
 */
import fs from 'fs';

const sshConfigStr = fs.readFileSync(
  '/Users/ming/Downloads/ssh/sshConfig.json',
  'utf8',
);
export const sshConfig = JSON.parse(sshConfigStr);

const connectStr = fs.readFileSync(
  '/Users/ming/Downloads/ssh/connectOver.json',
  'utf8',
);

const connectObj = JSON.parse(connectStr);

const cryptoStr = fs.readFileSync(
  '/Users/ming/Downloads/ssh/crypto.json',
  'utf8',
);

const { CRYPTO_KEY } = JSON.parse(cryptoStr);

export const isProd = false;
export const connectionInfo = {
  ...connectObj,
  waitForConnections: true,
  connectionLimit: 8, // 可以根据服务器性能进行调整
  queueLimit: 0, // 等待队列的最大数量，设置为0表示不限制。
};
export const DB_NAME = 'over_page';
export { CRYPTO_KEY };
