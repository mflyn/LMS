@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo 开始从官网拉取所有项目依赖...
echo ==========================================

REM 检查 npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 npm，请先安装 Node.js
    pause
    exit /b 1
)

REM 设置官方源
echo [信息] 设置 npm 官方源...
npm config set registry https://registry.npmjs.org/
echo [成功] npm 源已设置为官方源

REM 清理缓存
echo [信息] 清理 npm 缓存...
npm cache clean --force

REM 安装根目录依赖
echo [信息] 安装根目录依赖...
if exist package-lock.json del package-lock.json
npm install --registry https://registry.npmjs.org/
if %errorlevel% neq 0 (
    echo [错误] 根目录依赖安装失败
    pause
    exit /b 1
)
echo [成功] 根目录依赖安装完成

REM 安装前端 Web 依赖
echo [信息] 安装前端 Web 依赖...
cd frontend\web
if exist package-lock.json del package-lock.json
npm install --registry https://registry.npmjs.org/
if %errorlevel% neq 0 (
    echo [错误] 前端 Web 依赖安装失败
    cd ..\..
    pause
    exit /b 1
)
echo [成功] 前端 Web 依赖安装完成
cd ..\..

REM 安装移动端依赖
echo [信息] 安装移动端依赖...
cd frontend\mobile
if exist package-lock.json del package-lock.json
npm install --registry https://registry.npmjs.org/
if %errorlevel% neq 0 (
    echo [错误] 移动端依赖安装失败
    cd ..\..
    pause
    exit /b 1
)
echo [成功] 移动端依赖安装完成
cd ..\..

REM 安装网关依赖
echo [信息] 安装网关依赖...
cd backend\gateway
if exist package-lock.json del package-lock.json
npm install --registry https://registry.npmjs.org/
if %errorlevel% neq 0 (
    echo [错误] 网关依赖安装失败
    cd ..\..
    pause
    exit /b 1
)
echo [成功] 网关依赖安装完成
cd ..\..

REM 安装后端服务依赖
echo [信息] 安装后端微服务依赖...
set services=analytics-service data-service homework-service interaction-service progress-service resource-service user-service

for %%s in (%services%) do (
    if exist "backend\services\%%s\package.json" (
        echo [信息] 安装 %%s 依赖...
        cd "backend\services\%%s"
        if exist package-lock.json del package-lock.json
        npm install --registry https://registry.npmjs.org/
        if !errorlevel! neq 0 (
            echo [错误] %%s 依赖安装失败
            cd ..\..\..
            pause
            exit /b 1
        )
        echo [成功] %%s 依赖安装完成
        cd ..\..\..
    ) else (
        echo [警告] %%s 不存在或没有 package.json 文件
    )
)

REM 安装测试依赖
if exist "backend\tests\package.json" (
    echo [信息] 安装测试依赖...
    cd backend\tests
    if exist package-lock.json del package-lock.json
    npm install --registry https://registry.npmjs.org/
    if %errorlevel% neq 0 (
        echo [错误] 测试依赖安装失败
        cd ..\..
        pause
        exit /b 1
    )
    echo [成功] 测试依赖安装完成
    cd ..\..
)

echo ==========================================
echo [成功] 所有依赖拉取完成！
echo ==========================================
echo.
echo [信息] 后续操作建议：
echo 1. 运行 'npm test' 验证后端功能
echo 2. 运行 'cd frontend\web && npm start' 启动前端
echo 3. 运行 'cd frontend\mobile && npm start' 启动移动端
echo 4. 运行 'docker-compose up' 启动完整系统
echo.
pause 