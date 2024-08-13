import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Certbot from 'pages/index.jsx';

import './_global.scss';
import './_overhide.scss';

// 全局对象，用于调试信息输出
Object.defineProperty(window, 'DEBUG_INFO', {
  get: function () {
    const projectStr = `Certbot 相关信息输出：`;
    const githubStr = `项目地址：https://github.com/PiDazhong/certbot`;
    const certbotStr = `部署地址：https://certbot.quantanalysis.cn`;
    return `\n${projectStr}\n\n${githubStr}\n\n${certbotStr}\n`;
  },
});

console.log(window['DEBUG_INFO']);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Certbot />
  </StrictMode>,
);
