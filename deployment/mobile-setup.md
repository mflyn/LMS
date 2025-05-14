# 移动端开发与测试指南

本文档提供了在 iPhone 设备上测试和使用小学生学习追踪系统的详细步骤。

## 移动端访问方式

小学生学习追踪系统提供了两种在移动设备上访问的方式：

1. **响应式 Web 应用**：通过移动浏览器访问，可添加到主屏幕
2. **原生移动应用**：使用 React Native 开发的原生应用（如果项目包含）

## 方法一：通过 Safari 浏览器访问 Web 应用

### 前提条件

- iPhone 设备（iOS 14 或更高版本）
- Safari 浏览器
- 与后端服务器（Ubuntu 虚拟机）和前端开发机（MacBook Pro）在同一网络

### 步骤

1. **确认前端应用已启动**
   - 在 MacBook Pro 上启动前端应用：
     ```bash
     cd LMS/frontend
     npm start
     ```
   - 或确认 Docker 中的前端服务已启动：
     ```bash
     docker compose ps
     ```

2. **在 iPhone 上访问应用**
   - 打开 Safari 浏览器
   - 访问以下 URL 之一：
     - 直接访问 MacBook Pro 上的开发服务器：`http://<MacBook的IP>:3000`
     - 访问 Ubuntu 虚拟机上的 Docker 服务：`http://<虚拟机IP>:80`
     - 如果配置了域名：`http://backend.local`

3. **添加到主屏幕（创建 Web App）**
   - 在 Safari 中打开应用
   - 点击底部的"分享"按钮（方框加箭头图标）
   - 滚动并选择"添加到主屏幕"
   - 输入应用名称（例如"学习追踪系统"）
   - 点击"添加"

4. **使用主屏幕图标启动**
   - 应用将以全屏模式运行，类似于原生应用
   - 注意：需要网络连接才能使用

### 故障排除

- **无法访问应用**
  - 确认 iPhone 与 MacBook Pro/Ubuntu 虚拟机在同一 Wi-Fi 网络
  - 尝试使用 IP 地址而非主机名
  - 检查防火墙设置

- **页面显示不正确**
  - 清除 Safari 缓存：设置 > Safari > 清除历史记录与网站数据
  - 确认前端应用已正确配置响应式设计

## 方法二：使用 React Native 应用（如果适用）

### 前提条件

- iPhone 设备（iOS 14 或更高版本）
- App Store 账号
- Expo Go 应用（从 App Store 安装）
- MacBook Pro 上安装了 Expo CLI

### 开发模式测试

1. **在 MacBook Pro 上设置 Expo 开发环境**
   ```bash
   # 安装 Expo CLI
   npm install -g expo-cli
   
   # 进入移动应用目录
   cd LMS/mobile
   
   # 安装依赖
   npm install
   
   # 启动 Expo 开发服务器
   expo start
   ```

2. **在 iPhone 上使用 Expo Go 测试**
   - 在 iPhone 上安装 Expo Go 应用
   - 确保 iPhone 与 MacBook Pro 在同一 Wi-Fi 网络
   - 打开 Expo Go 应用
   - 扫描 MacBook Pro 上显示的二维码
   - 应用将在 Expo Go 中加载

3. **配置后端 API 连接**
   - 在移动应用的配置文件中设置 API URL：
     ```javascript
     // app/config/index.js 或类似文件
     export const API_URL = 'http://<虚拟机IP>:3000/api';
     ```

### 构建独立应用（发布前测试）

1. **配置 app.json**
   ```json
   {
     "expo": {
       "name": "学习追踪系统",
       "slug": "learning-tracker",
       "version": "1.0.0",
       "orientation": "portrait",
       "icon": "./assets/icon.png",
       "splash": {
         "image": "./assets/splash.png",
         "resizeMode": "contain",
         "backgroundColor": "#ffffff"
       },
       "updates": {
         "fallbackToCacheTimeout": 0
       },
       "assetBundlePatterns": [
         "**/*"
       ],
       "ios": {
         "supportsTablet": true,
         "bundleIdentifier": "com.yourcompany.learningtracker"
       }
     }
   }
   ```

2. **构建 iOS 应用**
   ```bash
   expo build:ios
   ```

3. **使用 TestFlight 进行测试**
   - 在 [Apple Developer](https://developer.apple.com) 账号中设置应用
   - 上传构建版本到 TestFlight
   - 邀请测试人员

## 使用 PWA 功能增强 Web 应用体验

如果您希望 Web 应用提供更接近原生应用的体验，可以实现 Progressive Web App (PWA) 功能：

1. **在前端项目中添加 PWA 支持**
   ```bash
   # 如果使用 Create React App
   npm install --save workbox-webpack-plugin
   ```

2. **创建 Service Worker**
   ```javascript
   // src/service-worker.js
   self.addEventListener('install', event => {
     console.log('Service worker installed');
   });
   
   self.addEventListener('activate', event => {
     console.log('Service worker activated');
   });
   
   self.addEventListener('fetch', event => {
     console.log('Fetching:', event.request.url);
   });
   ```

3. **创建 Web App Manifest**
   ```json
   {
     "short_name": "学习追踪",
     "name": "小学生学习追踪系统",
     "icons": [
       {
         "src": "favicon.ico",
         "sizes": "64x64",
         "type": "image/x-icon"
       },
       {
         "src": "logo192.png",
         "type": "image/png",
         "sizes": "192x192"
       },
       {
         "src": "logo512.png",
         "type": "image/png",
         "sizes": "512x512"
       }
     ],
     "start_url": ".",
     "display": "standalone",
     "theme_color": "#000000",
     "background_color": "#ffffff"
   }
   ```

4. **在 HTML 中注册**
   ```html
   <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
   <script>
     if ('serviceWorker' in navigator) {
       window.addEventListener('load', () => {
         navigator.serviceWorker.register('/service-worker.js');
       });
     }
   </script>
   ```

## 移动端特定功能开发建议

1. **响应式设计最佳实践**
   - 使用相对单位（%, em, rem）而非固定像素
   - 实现移动优先设计
   - 使用 CSS Grid 和 Flexbox 进行布局
   - 测试不同屏幕尺寸（iPhone SE 到 iPhone Pro Max）

2. **移动端性能优化**
   - 减少 JavaScript 包大小
   - 优化图片（使用 WebP 格式和响应式图片）
   - 实现懒加载
   - 减少网络请求

3. **移动端特定功能**
   - 实现离线模式（使用 IndexedDB 或 localStorage）
   - 添加下拉刷新功能
   - 优化触摸交互（增大点击区域）
   - 适配 iOS 安全区域（顶部刘海和底部手势条）

## 测试清单

在 iPhone 上测试应用时，请检查以下内容：

- [ ] 应用在不同 iPhone 型号上显示正常（SE、标准、Pro、Pro Max）
- [ ] 横屏和竖屏模式都能正常工作
- [ ] 表单输入和键盘交互正常
- [ ] 触摸手势响应良好
- [ ] 网络连接中断时的行为正确
- [ ] 应用性能流畅（无明显卡顿）
- [ ] 字体大小适当，文本可读性好
- [ ] 颜色对比度符合可访问性标准
- [ ] 深色模式支持（如果适用）

---

如需更多帮助，请参考[完整部署文档](./README.md)或联系开发团队。
