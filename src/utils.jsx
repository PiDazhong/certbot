/**
 * @des 公共方法
 */

import { message } from 'antd';
import _ from 'lodash';
import qs from 'query-string';

// 请求接口通用方法
export const fetchRequest = async (
  url,
  method,
  body = {},
  setLoading = null,
  signal = null,
) => {
  if (setLoading) {
    setLoading(true);
  }
  try {
    const jwt = localStorage.getItem('quantanalysis_jwt');
    let options = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      signal,
    };

    if (method.toUpperCase() !== 'GET' && body) {
      const bodyUrl = qs.stringify(body);
      options.body = bodyUrl;
    }
    const response = await fetch(url, options);
    const dataJson = await response.text();

    // 处理 JSON 解析错误
    let data;
    try {
      data = JSON.parse(dataJson || '{}');
    } catch (error) {
      console.error('JSON parse错误:', error);
      return {};
    }
    if (data?.error) {
      message.error({ content: data?.error, key: String(data?.error) });
      return {};
    }
    if (data?.warning) {
      message.warning({ content: data?.warning, key: String(data?.warning) });
      return {};
    }
    return data;
  } catch (error) {
    console.error('请求错误:', error);
    return {};
  } finally {
    if (setLoading) {
      setLoading(false);
    }
  }
};
