import {
  useLayoutEffect,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { Button, Input, message, Tooltip } from 'antd';
import { InfoCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { fetchRequest } from 'utils';
import './index.scss';

const Certbot = () => {
  // 邀请码
  const [invitationCode, setInvitationCode] = useState('xiaopi_txdy');
  // 邀请码可用次数
  const [remainNums, setRemainNums] = useState(0);
  // 域名
  const [domain, setDomain] = useState('babazhu.love');
  // 冷却时间
  const [remainTime, setRemainTime] = useState(300);
  // 进程id
  const [processId, setProcessId] = useState(undefined);
  // 申请 loading
  const [applyLoading, setApplyLoading] = useState(false);
  // 冷却时间计时器
  const remainTimeRef = useRef(null);

  // 查询邀请码剩余可用次数
  const queryRemainNums = async () => {
    try {
      const { data: remainNums } = await fetchRequest(
        '/mysql/getRemainNums',
        'post',
        {
          invitationCode,
        },
      );
      if (remainNums > 0) {
        message.success(`邀请码剩余可用次数：${remainNums}`);
        setRemainNums(remainNums);
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
    setRemainTime(300);
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
        const { text, newNums, processId } = data;
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

  // 开始下载正式
  const downCertbot = async () => {
    const { success, data } = await fetchRequest('/mysql/downCertbot', 'post', {
      processId,
      domain,
    });
    if (success) {
      console.log('data', data);
    }
  };

  return (
    <div className="certbot-page">
      <div className="certbot-page-content">
        <div className="line-item">
          <div className="line-item-label">邀请码</div>
          <div className="line-item-content">
            <Input
              placeholder="请输入邀请码"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
            />
            <Tooltip title="由于证书申请需要服务器资源，所以这里需要找作者要邀请码才能继续申请证书，可以点击测试邀请码剩余可用次数">
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
            <Tooltip title="请直接输入顶级域名，申请下来的证书会包含这个顶级域名下的所有一级域名">
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
          </div>
        </div>
        <div className="line-item">
          <div className="line-item-label">下载冷却</div>
          <div className="line-item-content">剩余冷却时间：{remainTime}</div>
        </div>
        <div className="line-item">
          <div className="line-item-label"></div>
          <div className="line-item-content">
            <Tooltip title={remainTime > 0 && '请等待冷却归零后再开始下载'}>
              <Button
                type="primary"
                // disabled={remainTime > 0 || !processId}
                onClick={() => downCertbot()}
              >
                点击下载
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certbot;
