import React, { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// 从 menuConfig.js 导入图标，而不是直接在这里导入所有图标
// Icons are now part of menuConfig.js and will be used directly from there
// import {
//   DashboardOutlined, BookOutlined, ScheduleOutlined, FileTextOutlined,
//   TeamOutlined, MessageOutlined, BarChartOutlined, SettingOutlined,
//   UserOutlined, BellOutlined, ReadOutlined, HomeOutlined
// } from '@ant-design/icons';
import {
  commonMenuItems as commonMenuItemsData,
  studentMenuItems as studentMenuItemsData,
  parentMenuItems as parentMenuItemsData,
  teacherMenuItems as teacherMenuItemsData,
  adminMenuItems as adminMenuItemsData,
  overridesByRoleKeyConfig
} from '../../config/menuConfig';

const { Sider } = Layout;

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const pathName = location.pathname;
    // 尝试直接匹配完整路径，如果路径是'/'，则默认为'/dashboard'
    // const currentKey = pathName === '/' ? '/dashboard' : pathName;
    // 如果有多级路径，例如 /resources/view/123，我们希望父级 /resources 高亮
    // 可以根据实际的菜单结构决定是否需要更复杂的匹配逻辑
    // 目前的菜单都是一级，直接匹配或取第一部分即可
    // 为了与新的 key 统一，我们直接使用 currentKey
    // 如果菜单项的 key 是 /resources，而 pathName 是 /resources/detail，那么需要更智能的匹配
    // 暂时以精确匹配为主，如果后续有子路由页面，再优化此逻辑
    // setSelectedKeys([currentKey]); 

    if (pathName === '/') {
      setSelectedKeys(['/dashboard']);
    } else {
      const segments = pathName.split('/'); // e.g., "/foo/bar" -> ["", "foo", "bar"]
      if (segments.length > 1 && segments[1]) {
        const rootPathKey = `/${segments[1]}`; // e.g., "/foo"
        // 检查计算出的 rootPathKey 是否真的存在于菜单项中
        // 这是为了避免当用户访问一个完全不存在的一级路径时，错误地高亮某个东西
        // (虽然路由守卫应该阻止这种情况，但多一层保险)
        // 不过，getMenuItems() 的结果依赖 userRole，在 effect 作用域内直接调用可能不合适
        // 暂时信任路由配置，如果 segments[1] 有效，则其构成的一级路由键应该是有效的菜单项
        setSelectedKeys([rootPathKey]);
      } else {
        // 对于非常规路径，或者路径解析不出第一部分的情况，尝试使用原始路径
        // 这主要是一个回退，正常情况下，路径应该是 "/segment/..." 或 "/"
        setSelectedKeys([pathName]);
      }
    }
  }, [location.pathname]);

  // 根据用户角色返回对应的菜单项
  const getMenuItems = () => {
    // 辅助函数，将配置数据转换为 Menu 组件可用的 items，并附加 onClick
    const processMenuItems = (itemsConfig) =>
      itemsConfig.map(item => ({
        ...item, // key, icon, label from config
        onClick: () => navigate(item.path) // path from config
      }));

    const commonItems = processMenuItems(commonMenuItemsData);
    const studentItems = processMenuItems(studentMenuItemsData);
    const parentItems = processMenuItems(parentMenuItemsData);
    const teacherItems = processMenuItems(teacherMenuItemsData);
    const adminItems = processMenuItems(adminMenuItemsData);

    const overridesByRoleKey = overridesByRoleKeyConfig;

    let roleSpecificItems = [];
    let currentRoleOverrides = {};

    switch (userRole) {
      case 'student':
        roleSpecificItems = studentItems;
        currentRoleOverrides = overridesByRoleKey.student || {};
        break;
      case 'parent':
        roleSpecificItems = parentItems;
        currentRoleOverrides = overridesByRoleKey.parent || {};
        break;
      case 'teacher':
        roleSpecificItems = teacherItems;
        // currentRoleOverrides remains {} as teacher has no overrides defined in config
        break;
      case 'admin':
        roleSpecificItems = adminItems;
        currentRoleOverrides = overridesByRoleKey.admin || {};
        break;
      default:
        return commonItems; // Only common items for undefined/default roles
    }

    const commonKeysToOmit = new Set();
    Object.keys(currentRoleOverrides).forEach(roleSpecificKey => {
      if (roleSpecificItems.some(item => item.key === roleSpecificKey)) {
        commonKeysToOmit.add(currentRoleOverrides[roleSpecificKey]);
      }
    });

    const filteredCommonItems = commonItems.filter(ci => !commonKeysToOmit.has(ci.key));

    const finalItems = [
      ...filteredCommonItems,
      ...roleSpecificItems.filter(rsItem => !filteredCommonItems.find(fci => fci.key === rsItem.key))
    ];

    return finalItems;
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={200}
      style={{ background: '#fff' }}
    >
      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        style={{ height: '100%', borderRight: 0 }}
        items={getMenuItems()}
      />
    </Sider>
  );
};

export default AppSidebar;