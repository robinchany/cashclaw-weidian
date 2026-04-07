# CashClaw 微店版 · AI 自动接单系统

> **将你的微店变成一台 24 小时自动营业的 AI 机器**
>
> 用户下单 → AI 理解需求 → 自动发货虚拟商品 · 无需值守

---

## 🎯 这是什么

一个基于 Webhook + AI Agent 的**虚拟商品自动接单发货系统**。

```
用户下单微店虚拟商品
        ↓
微店推送 Webhook 到本系统
        ↓
AI Agent 分析买家留言
识别需求类型（文案/PPT/Logo/视频剪辑）
        ↓
AI 生成个性化服务内容
        ↓
自动发送发货（评论/私信/文件）
        ↓
订单完成，人工零介入
```

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **Webhook 实时接收订单** | 微店订单推送，毫秒级响应 |
| **AI 意图识别** | 自动理解买家"要做什么" |
| **4 种虚拟服务** | 文案定制 / PPT 制作 / Logo 设计 / 视频剪辑 |
| **AI 内容生成** | 基于智谱 GLM-4-flash，真实发货内容 |
| **轮询兜底** | 无 Webhook 时每 30 秒主动拉取新订单 |
| **记忆上下文** | 多轮对话记忆，跨订单理解用户偏好 |
| **Webhook 安全签名** | HMAC-SHA256 防伪造请求 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                  微店开放平台                    │
│         (用户下单 → Webhook 推送)                │
└──────────────────┬──────────────────────────────┘
                   │ HTTP POST /webhook/weidian
                   ▼
┌─────────────────────────────────────────────────┐
│              Express Webhook Server            │
│              (端口 3001，本地运行)               │
└──────────────────┬──────────────────────────────┘
                   │
          ┌────────▼────────┐
          │  AI Agent Loop  │
          │                 │
          │  1. 意图识别    │
          │  2. 服务匹配    │
          │  3. 内容生成    │
          │  4. 发货执行    │
          └────────┬────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ 智谱 GLM │  │ 会话记忆  │  │ 微店 API  │
│ 4-flash │  │ (JSON)   │  │ 订单状态  │
└─────────┘  └──────────┘  └──────────┘
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **微店商家账号** + [开放平台应用](https://open.weidian.com/)
- **智谱 AI API Key**（[申请地址](https://open.bigmodel.cn/)）

### 1. 克隆 & 安装

```bash
git clone <your-repo-url>
cd cashclaw-weidian
npm install
```

### 2. 配置环境变量

```bash
# Linux / macOS
export ZHIPU_API_KEY="your_zhipu_api_key"

# Windows PowerShell
$env:ZHIPU_API_KEY="your_zhipu_api_key"
```

### 3. 配置微店凭证

首次运行后会自动生成 `config.json`，或直接复制修改：

```bash
cp config.example.json config.json
# 然后编辑 config.json 填入微店 appKey / appSecret / shopId
```

### 4. 启动

```bash
npm start
```

### 5. 配置 Webhook（重要！）

在 [微店开放平台](https://open.weidian.com/) → 你的应用 → 消息推送：

- **推送地址**：`https://你的公网IP:3001/webhook/weidian`
- （本地调试可用内网穿透，如 [cpolar](https://www.cpolar.com/) 或 [ngrok](https://ngrok.com/)）

---

## 📁 项目结构

```
cashclaw-weidian/
├── src/
│   ├── index.ts          # 入口，轮询调度
│   ├── server.ts         # Express Webhook 服务器
│   ├── agent.ts          # AI Agent（意图识别 + 内容生成）
│   ├── config.ts         # 配置管理（环境变量 + config.json）
│   ├── types.ts          # TypeScript 类型定义
│   ├── llm/
│   │   └── index.ts      # 智谱 GLM-4-flash 调用层
│   ├── memory/
│   │   └── index.ts      # 会话记忆（JSON 持久化）
│   └── tools/
│       ├── weidian.ts    # 微店 API 封装（OAuth + 订单查询）
│       └── delivery.ts   # 自动发货工具
├── config.example.json   # 配置模板（不含真实凭证）
├── .gitignore            # 排除 config.json / node_modules
└── package.json
```

---

## 🔐 安全说明

| 文件 | 是否上传 GitHub | 说明 |
|------|:---------------:|------|
| `config.json` | ❌ | 含真实凭证，已在 .gitignore |
| `config.example.json` | ✅ | 无敏感数据的模板 |
| `.gitignore` | ✅ | 排除所有密钥文件 |
| 源代码 | ✅ | 不含硬编码密钥 |

**API Key 注入方式**：通过环境变量 `ZHIPU_API_KEY` 注入，代码中不裸写。

---

## 🔧 配置文件字段说明

```json
{
  "weidian": {
    "appKey": "微店开放平台应用 Key",
    "appSecret": "微店应用密钥",
    "shopId": "店铺 ID",
    "accessToken": "自动刷新，无需手动填",
    "refreshToken": "自动刷新，无需手动填"
  },
  "llm": {
    "provider": "zhipu",
    "model": "glm-4-flash",
    "apiKey": "从 ZHIPU_API_KEY 环境变量读取"
  },
  "server": {
    "port": 3001,
    "webhookSecret": "Webhook 签名密钥（生产环境请修改）"
  },
  "polling": {
    "enabled": true,
    "intervalMs": 30000
  }
}
```

---

## 🧪 测试 AI 对话

无需微店账号，直接测试 AI 内容生成能力：

```bash
curl -X POST http://localhost:3001/api/test-chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"帮我写个小红书文案，关于 AI 工具提升工作效率\"}"
```

---

## 💡 下一步

- [ ] 接入微信客服消息推送（提升触达率）
- [ ] 添加更多虚拟服务类型
- [ ] 接入支付回调实现"先付款后发货"完整闭环
- [ ] 部署到云服务器（阿里云/腾讯云）实现 24 小时在线

---

## 📜 License

MIT

---

> Built with 💡 by [陈艺明] · Powered by 智谱 GLM-4-flash
