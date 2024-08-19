/**
 * @des 获取路由中 ？ 后面的参数
 */

import React from 'react';

const useUrlParams = () => {
  const { search } = window.location;

  const params = new URLSearchParams(search);

  // 将参数转换为对象
  const paramsObj = {};
  for (const [key, value] of params.entries()) {
    paramsObj[key] = value;
  }

  return paramsObj;
};

export default useUrlParams;
