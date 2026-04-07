# 🤖 CashClaw 微店版

**把你的微店变成一台 24 小时自动营业的 AI 机器**

客户下单 → AI 自动接单 → 虚拟商品秒发货 → 你睡觉也在赚

---

## 💡 解决什么痛点

做虚拟商品（文案 / PPT / Logo / 视频剪辑）最难的不是做内容，**是 24 小时守着等客户下单**。

- 半夜客户来问，你睡着了，单子跑了
- 同时来 5 个客户，回不过来，服务质量崩盘
- 手动发货麻烦，容易漏发错发

**CashClaw 微店版**把这些全部自动化——你只管供货，AI 帮你接单、沟通、发货。

---

## ⚡ 工作流程

```
客户下单
    ↓
微店 Webhook 推送订单
    ↓
AI Agent 识别需求（文案？PPT？Logo？）
    ↓
自动生成对应虚拟商品内容
    ↓
秒发货到客户，微信通知
    ↓
你只需要躺着
```

---

## 🏗️ 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 订单接收 | Express Webhook | 微店开放平台订单推送 |
| AI 决策 | Agent Loop | 意图识别 + 服务匹配 + 内容生成 |
| LLM | 智谱 GLM-4-flash | 低成本中文理解 |
| 记忆系统 | MiniSearch | 会话上下文持久化 |
| 发货 | 微店开放 API | 虚拟商品自动发货 |

---

## 🚀 快速开始

### 1. 环境要求

```
Node.js >= 18
微店商家账号
微店开放平台应用：https://open.weidian.com/
智谱 AI API Key（免费额度）：https://open.bigmodel.cn/
```

### 2. 克隆 & 安装

```bash
git clone https://github.com/robinchany/cashclaw-weidian.git
cd cashclaw-weidian
npm install
```

### 3. 配置

创建 `config.json`（从模板复制）：

```bash
copy config.example.json config.json
```

填入以下配置：

```json
{
  "weidian": {
    "appKey": "你的微店 appKey",
    "appSecret": "你的微店 appSecret",
    "shopId": "你的微店 ID"
  },
  "zhipu": {
    "apiKey": "你的智谱 API Key"
  },
  "server": {
    "port": 3001
  }
}
```

**设置环境变量**（可选，更安全）：

```bash
# Windows
set ZHIPU_API_KEY=你的智谱APIKey

# macOS / Linux
export ZHIPU_API_KEY=你的智谱APIKey
```

### 4. 配置微店 Webhook

在 [微店开放平台](https://open.weidian.com/) 你的应用设置中：

- 回调地址填：`http://你的服务器IP:3001/webhook/order`
- 订阅事件：订单创建

### 5. 启动

```bash
npm start
```

看到以下输出即启动成功：

```
🚀 CashClaw 微店版已启动
📡 Webhook 服务监听 :3001
🤖 AI Agent 就绪
⏰ 轮询调度启动
```

---

## 📁 项目结构

```
cashclaw-weidian/
├── src/
│   ├── index.ts          # 入口，轮询调度
│   ├── server.ts         # Express Webhook 服务器
│   ├── agent.ts          # AI Agent（意图识别 + 内容生成）
│   ├── config.ts         # 配置管理
│   ├── prompt.ts         # Agent 系统提示词
│   ├── types.ts          # TypeScript 类型定义
│   ├── heartbeat.ts      # 心跳保活调度器
│   ├── llm/
│   │   └── index.ts      # 智谱 GLM-4-flash 调用层
│   ├── memory/
│   │   ├── index.ts      # 会话记忆持久化
│   │   └── search.ts     # MiniSearch 全文检索
│   └── tools/
│       ├── weidian.ts    # 微店开放 API 封装
│       └── delivery.ts   # 自动发货工具
├── screenshots/          # 截图调试目录
├── config.example.json   # 配置模板
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔒 安全说明

- ✅ API Key 通过环境变量注入，**不硬编码**
- ✅ `config.json` 已在 `.gitignore` 排除
- ✅ `package-lock.json` 中无真实凭证

---

## 🔮 路线图

- [ ] 支持多微店账号
- [ ] 支持更多虚拟商品类型（视频/音频）
- [ ] AI 客服多轮对话
- [ ] 订单数据分析面板
- [ ] 闲鱼 / 淘宝 多平台扩展

---

## 📄 License

MIT · 开源可商用

---

**如果你觉得这项目有用，欢迎 Star ⭐ · 有问题提 Issue · 想参与开发欢迎 PR**
