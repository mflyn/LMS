import React from 'react';
import { SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useChildAuth } from '../../contexts/ChildAuthContext';

const ChildSwitchButton = () => {
  const navigate = useNavigate();
  const { logout } = useChildAuth();
  const switchChild = () => {
    if (!window.confirm('切换孩子将清除本页未提交的内容。结果未确认的提交，需要原孩子重新登录后恢复。继续切换？')) return;
    logout();
    navigate('/child/login', { replace: true });
  };
  return <button type="button" className="child-secondary-button" onClick={switchChild}>
    <SwapOutlined aria-hidden="true" /> 切换孩子
  </button>;
};

export default ChildSwitchButton;
