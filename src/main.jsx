import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Certbot from 'pages/index.jsx';

import './_global.scss';
import './_overhide.scss';

// 全局对象，用于调试信息输出
Object.defineProperty(window, 'DEBUG_INFO', {
  get: function () {
    const projectStr = `/      Certbot 相关信息:                                /`;
    const githubStr = `/      项目地址：https://github.com/PiDazhong/certbot   /`;
    const certbotStr = `/      部署地址：https://certbot.quantanalysis.cn       /`;
    const authorStr = `/      作者vx: pdz_wechat                              /`;
    const testStr = `/      测试邀请码: qwsd_cvfd_wdfc                       /`;
    const lineStr = `- - - - - - - - - - - - - - - - - - - - - - - - - - - -`;
    return `${lineStr}\n${projectStr}\n\n${githubStr}\n\n${certbotStr}\n\n${authorStr}\n\n${testStr}\n\n${lineStr}\n`;
  },
});

console.log(window['DEBUG_INFO']);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Certbot />
  </StrictMode>,
);
