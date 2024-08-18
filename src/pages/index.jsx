import { useState, useRef } from 'react';
import { Button, Input, message, Tooltip } from 'antd';
import { InfoCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { fetchRequest } from 'utils';
import './index.scss';

const Certbot = () => {
  // 邀请码
  const [invitationCode, setInvitationCode] = useState('');
  // 邀请码可用次数
  const [remainNums, setRemainNums] = useState(0);
  // 域名
  const [domain, setDomain] = useState('example.com');
  // 冷却时间
  const [remainTime, setRemainTime] = useState(120);
  // 进程id
  const [processId, setProcessId] = useState(undefined);
  // 申请 loading
  const [applyLoading, setApplyLoading] = useState(false);
  // 下载 loading
  const [downLoading, setDownLoading] = useState(false);
  // 冷却时间计时器
  const remainTimeRef = useRef(null);

  const downZip = (url) => {
    // 创建一个新的 a 标签
    const a = document.createElement('a');
    // 设置 a 标签的 href 为传入的下载链接
    a.href = url;
    // 设置下载文件的名称
    a.download = `${domain}.zip`;
    // 将 a 标签添加到文档中
    document.body.appendChild(a);
    // 触发 a 标签的点击事件，开始下载
    a.click();
    // 下载完成后移除 a 标签
    document.body.removeChild(a);
  };

  // 从 message 里面 下载
  const messageDown = (url) => {
    console.log('下载地址', url);
    message.success({
      className: 'down-certbot-message',
      content: (
        <div className="down-certbot-message-content">
          <span>下载地址 {url}</span>
          <span className="clickable" onClick={() => downZip(url)}>
            点击下载
          </span>
        </div>
      ),
      key: url,
      duration: 0,
    });
  };

  // 查询邀请码剩余可用次数
  const queryRemainNums = async () => {
    if (!invitationCode || !invitationCode.includes('_')) {
      message.warning('邀请码不合法');
      return;
    }
    try {
      const { success, data: remainNums } = await fetchRequest(
        '/mysql/getRemainNums',
        'post',
        {
          invitationCode,
        },
      );
      if (success) {
        message.success(`邀请码剩余可用次数：${remainNums}`);
        setRemainNums(remainNums || 0);
      } else {
        setRemainNums(0);
      }
    } catch (e) {
      console.error(e);
      setRemainNums(0);
    }
  };

  // 开始申请证书
  const applyCertbot = async () => {
    const regex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!regex.test(domain)) {
      message.warning('域名不合法');
      return;
    }
    setRemainTime(120);
    try {
      const { success, data } = await fetchRequest(
        '/mysql/applyCertbot',
        'post',
        {
          invitationCode,
          domain,
        },
        setApplyLoading,
      );
      if (success) {
        const { text, newNums, processId, existUrl } = data;
        if (existUrl) {
          message.warning('域名已存在证书地址，无需重新申请');
          messageDown(existUrl);
          return;
        }
        setProcessId(processId);
        message.success({
          className: 'apply-certbot-message',
          content: (
            <div className="apply-certbot-message-content">
              <span>证书申请中...</span>
              <span>
                请设置域名的txt解析：设置 _acme-challenge.{domain} 的解析值为
                {text}
              </span>
              <span>这一步是验证你对于域名的拥有权，不要忘记设置解析。</span>
              <span>
                设置成功后，可以调用命令 " nslookup -q=txt _acme-challenge.
                {domain} " 来验证是否设置成功；
              </span>
              <span>
                txt值解析成功后，才可以点击申请下载证书 (请在
                5分钟后、20分钟以内，点击下载申请，否则此次申请进程将被终止)
              </span>
              <span>邀请码剩余可用次数：{newNums}</span>
              <CloseOutlined onClick={() => message.destroy('applyCertbot')} />
            </div>
          ),
          key: 'applyCertbot',
          duration: 0,
        });
        if (remainTimeRef.current) {
          clearInterval(remainTimeRef.current);
          remainTimeRef.current = null;
        }

        remainTimeRef.current = setInterval(() => {
          console.log('Timer ticking');
          setRemainTime((prev) => {
            if (prev <= 1) {
              clearInterval(remainTimeRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setProcessId(undefined);
      }
    } catch (e) {
      setProcessId(undefined);
      console.error(e);
    }
  };
  // 开始下载证书
  const downCertbot = async () => {
    const { success, data } = await fetchRequest(
      '/mysql/downCertbot',
      'post',
      {
        processId,
        domain,
      },
      setDownLoading,
    );
    if (success) {
      messageDown(data);
    }
  };

  // 强制下载证书
  const forceDownCertbot = async () => {
    const { success, data } = await fetchRequest(
      '/mysql/forceDownCertbot',
      'post',
      {
        domain,
      },
      setDownLoading,
    );
    if (success) {
      messageDown(data);
    }
  };

  return (
    <div className="certbot-page">
      <div className="certbot-page-content">
        <div className="title-item">
          <img src="/favicon.ico" alt="Certificate" />
          <div className="title-item-label">SSL证书申请</div>
        </div>
        <div className="line-item">
          <div className="line-item-label">邀请码</div>
          <div className="line-item-content">
            <Input
              placeholder="请输入邀请码"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
            />
            <Tooltip title="由于证书申请需要服务器资源，所以这里需要找作者要邀请码才能继续申请证书，请打开控制台联系作者">
              <InfoCircleOutlined />
            </Tooltip>
            <Button onClick={() => queryRemainNums()}>测试</Button>
          </div>
        </div>
        <div className="line-item">
          <div className="line-item-label">域名</div>
          <div className="line-item-content">
            <Input
              placeholder="请输入域名，如 example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <Tooltip title="请直接输入顶级域名，申请下来的证书会包含这个顶级域名下的所有一级域名，必须点击测试，得到邀请码剩余可用次数才能点击申请">
              <InfoCircleOutlined />
            </Tooltip>
          </div>
        </div>
        <div className="line-item">
          <div className="line-item-label">下载冷却</div>
          <div className="line-item-content">
            <div className="text-content">剩余冷却时间：{remainTime}</div>
            <Tooltip
              title={
                remainTime > 0 &&
                '请等待冷却归零后再开始下载，冷却时间是为了防止dns的txt解析延迟生效，请见谅'
              }
            >
              <InfoCircleOutlined />
            </Tooltip>
          </div>
        </div>
        <div className="line-item">
          <div className="line-item-label"></div>
          <div className="line-item-content">
            <Tooltip
              title={!(remainNums > 0) && '请填写邀请码并且测试邀请码可用次数'}
            >
              <Button
                type="primary"
                disabled={!(remainNums > 0)}
                onClick={() => applyCertbot()}
                loading={applyLoading}
              >
                点击申请
              </Button>
            </Tooltip>
            <Button
              type="primary"
              disabled={remainTime > 0 || !processId}
              onClick={() => downCertbot()}
              loading={downLoading}
            >
              点击下载
            </Button>
            <Button
              type="primary"
              // disabled={remainTime > 0 || !processId}
              onClick={() => forceDownCertbot()}
              loading={downLoading}
            >
              强制下载
            </Button>
            <Tooltip title="有时候可能证书成功生成了，但是接口没有正确返回成功信息，点击强制下载试下即可">
              <InfoCircleOutlined />
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certbot;
