# CashClaw 微店版 - AI 自动接单系统

将你的微店变成一台 24 小时自动营业的 AI 机器

## 快速开始

### 环境要求
- Node.js >= 18
- 微店商家账号 + 开放平台：https://open.weidian.com/
- 智谱 AI API Key：https://open.bigmodel.cn/

### 安装
git clone https://github.com/robinchany/cashclaw-weidian.git
cd cashclaw-weidian
npm install

### 配置
设置环境变量 ZHIPU_API_KEY
复制 config.example.json 为 config.json 并填写微店凭证

### 启动
npm start

## 项目结构
src/index.ts - 入口
src/server.ts - Webhook 服务器
src/agent.ts - AI Agent
src/llm/index.ts - 智谱 GLM-4-flash
src/memory/index.ts - 会话记忆
src/tools/weidian.ts - 微店 API
src/tools/delivery.ts - 自动发货

## 安全
API Key 通过环境变量注入
config.json 已在 .gitignore

## License
MIT
