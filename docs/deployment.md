# 部署文档

## 环境要求

### 1. 服务器要求
- 操作系统：Ubuntu 20.04 LTS 或更高版本
- CPU：2核或以上
- 内存：4GB或以上
- 存储：50GB或以上
- 网络：稳定的网络连接

### 2. 软件要求
- Node.js >= 14.x
- MongoDB >= 4.x
- Redis >= 6.x
- Nginx >= 1.18
- PM2 >= 4.x

## 部署流程

### 1. 环境准备
```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 安装必要软件
sudo apt install -y nginx redis-server

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2
sudo npm install -g pm2
```

### 2. 配置数据库
```bash
# 安装 MongoDB
sudo apt install -y mongodb

# 启动 MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# 配置 Redis
sudo systemctl start redis
sudo systemctl enable redis
```

### 3. 部署后端服务
```bash
# 克隆代码
git clone https://github.com/your-repo/backend.git
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 构建项目
npm run build

# 使用 PM2 启动服务
pm2 start ecosystem.config.js
```

### 4. 部署前端服务
```bash
# 克隆代码
git clone https://github.com/your-repo/frontend.git
cd frontend

# 安装依赖
npm install

# 构建项目
npm run build

# 配置 Nginx
sudo cp nginx.conf /etc/nginx/sites-available/your-site
sudo ln -s /etc/nginx/sites-available/your-site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 配置文件

### 1. PM2 配置文件
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 2. Nginx 配置文件
```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 监控与维护

### 1. 服务监控
```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 监控资源使用
pm2 monit
```

### 2. 日志管理
```bash
# 配置日志轮转
sudo cp logrotate.conf /etc/logrotate.d/your-app

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 3. 备份策略
```bash
# 数据库备份
mongodump --out /backup/mongodb
redis-cli SAVE

# 配置文件备份
tar -czf /backup/config.tar.gz /etc/nginx /etc/mongodb
```

## 安全配置

### 1. 防火墙配置
```bash
# 配置 UFW
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. SSL 配置
```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

### 3. 安全加固
```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 配置 fail2ban
sudo apt install -y fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

## 故障处理

### 1. 常见问题
- 服务无法启动
- 数据库连接失败
- 内存泄漏
- 性能问题

### 2. 排查步骤
1. 检查服务状态
2. 查看错误日志
3. 检查资源使用
4. 验证网络连接

### 3. 恢复流程
1. 备份当前状态
2. 回滚到稳定版本
3. 修复问题
4. 重新部署

## 更新流程

### 1. 后端更新
```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart backend
```

### 2. 前端更新
```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启 Nginx
sudo systemctl restart nginx
```

## 性能优化

### 1. 数据库优化
- 创建合适的索引
- 优化查询语句
- 配置缓存策略
- 定期维护

### 2. 应用优化
- 启用 Gzip 压缩
- 配置缓存头
- 优化静态资源
- 启用 HTTP/2

### 3. 服务器优化
- 调整系统参数
- 优化内存使用
- 配置负载均衡
- 启用 CDN 