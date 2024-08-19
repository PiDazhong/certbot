/**
 * @des 获取路由中 ？ 后面的参数
 */

import React from 'react';
import { useLocation } from 'react-router-dom';

const useUrlParams = () => {
  const { search } = useLocation();

  const params = new URLSearchParams(search);

  // 将参数转换为对象
  const paramsObj = {};
  for (const [key, value] of params.entries()) {
    paramsObj[key] = value;
  }

  return paramsObj;
};

export default useUrlParams;
