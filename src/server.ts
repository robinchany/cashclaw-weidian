// CashClaw 微店版 - Webhook 服务器
import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { getConfig } from './config.js';
import { createSession, log, getSession } from './memory/index.js';
import { handleMessage, executeTool } from './agent.js';
import { getWeidianOrders } from './tools/weidian.js';
import type { WeidianOrder, TaskSession } from './types.js';

// ============ Webhook 签名验证 ============

function verifyWeidianSign(
  body: string,
  sign: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return sign === expected;
}

// ============ 创建 Express App ============

export function createApp() {
  const app = express();
  const config = getConfig();

  app.use(cors());
  app.use(express.json({ verify: (req: Request) => {
    // 保存原始 body 用于签名验证
    (req as Request & { rawBody: Buffer }).rawBody = (req as Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body));
  }}));

  // 健康检查
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 状态面板
  app.get('/status', async (_req: Request, res: Response) => {
    const { getStats } = await import('./memory/index.js');
    const stats = getStats();
    res.json({
      status: 'running',
      config: {
        llm: config.llm.model,
        polling: config.polling,
        services: config.services.map(s => ({ id: s.id, name: s.name, price: s.price })),
      },
      stats,
    });
  });

  // ============ 微店 Webhook ============
  // 微店会 POST 订单事件到这个端点

  app.post(config.server.webhookPath, async (req: Request, res: Response) => {
    const body = req.body;
    const sign = req.headers['x-weidian-sign'] as string || '';

    console.log('[Webhook] 收到请求:', JSON.stringify(body).slice(0, 200));

    // 签名验证（如果配置了密钥）
    if (config.server.webhookSecret && config.server.webhookSecret !== 'changeme_random_secret_key_2024') {
      const rawBody = JSON.stringify(body);
      if (!verifyWeidianSign(rawBody, sign, config.server.webhookSecret)) {
        console.warn('[Webhook] 签名验证失败');
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // 处理不同类型的消息
    const eventType = body.event || body.type || '';

    try {
      switch (eventType) {
        case 'order_created':
        case 'ORDER_CREATED':
          await handleNewOrder(body.order);
          break;

        case 'order_paid':
        case 'ORDER_PAID':
          await handleOrderPaid(body.order);
          break;

        case 'order_message':
        case 'ORDER_MESSAGE':
          await handleCustomerMessage(body);
          break;

        default:
          console.log('[Webhook] 未知事件类型:', eventType);
      }

      res.json({ code: 0, message: 'ok' });
    } catch (e) {
      const err = e as Error;
      console.error('[Webhook] 处理错误:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ============ 手动触发轮询 ============
  // 用于测试或手动补抓订单

  app.post('/api/poll-orders', async (_req: Request, res: Response) => {
    try {
      console.log('[手动轮询] 开始检查新订单...');
      const orders = await getWeidianOrders();
      for (const order of orders) {
        await handleNewOrder(order);
      }
      res.json({ code: 0, polled: orders.length });
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message });
    }
  });

  // ============ 发送消息 ============
  // AI 回复后调用此接口发送消息给买家

  app.post('/api/send-message', async (req: Request, res: Response) => {
    const { orderId, message } = req.body as { orderId: string; message: string };
    if (!orderId || !message) {
      return res.status(400).json({ error: '缺少 orderId 或 message' });
    }

    try {
      const { sendWeidianMessage } = await import('./tools/weidian.js');
      await sendWeidianMessage(orderId, message);
      res.json({ code: 0 });
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message });
    }
  });

  // ============ 测试 AI 回复 ============
  // POST /api/test-chat?message=xxx

  app.post('/api/test-chat', async (req: Request, res: Response) => {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };
    if (!message) {
      return res.status(400).json({ error: '缺少 message' });
    }

    // 创建测试会话
    const sid = sessionId || `test-${Date.now()}`;
    if (!getSession(sid)) {
      createSession(sid, 'test-order', 'test-user');
    }

    const reply = await handleMessage(sid, message);
    res.json({ sessionId: sid, reply });
  });

  // ============ 管理接口 ============
  // 查看 / 修改配置

  app.get('/api/config', (_req: Request, res: Response) => {
    // 隐藏敏感信息
    const safe = {
      weidian: { shopId: config.weidian.shopId, configured: !!config.weidian.appKey },
      llm: { provider: config.llm.provider, model: config.llm.model },
      server: config.server,
      polling: config.polling,
      services: config.services,
    };
    res.json(safe);
  });

  return app;
}

// ============ 订单处理流程 ============

export async function handleNewOrder(order: Partial<WeidianOrder>): Promise<void> {
  const config = getConfig();
  const orderId = order.orderId || '';
  const buyerNote = order.buyerNote || '';
  const buyerNick = order.buyerNick || '买家';

  console.log(`[订单] 新订单 ${orderId} | 买家: ${buyerNick} | 备注: ${buyerNote}`);

  // 创建会话
  const sessionId = `order-${orderId}`;
  const session = createSession(sessionId, orderId, buyerNick);

  // 初始化对话
  await log('新订单', { orderId, buyerNick, buyerNote });

  // AI 自动生成欢迎语
  const welcomeMessage = `您好${buyerNick}！感谢您的信任~ 我已收到您的订单，正在为您准备服务。\n\n请告诉我您的具体需求，例如：\n- 文案用途/平台/风格偏好\n- 需要突出哪些卖点\n- 有没有参考案例\n\n越详细，交付越精准！`;

  await handleMessage(sessionId, welcomeMessage);

  // 如果有备注，分析需求
  if (buyerNote) {
    await handleMessage(
      sessionId,
      `补充信息：${buyerNote}`
    );
  }
}

async function handleOrderPaid(order: Partial<WeidianOrder>): Promise<void> {
  const orderId = order.orderId || '';
  console.log(`[订单] 订单已支付 ${orderId}`);
  await log('订单支付', { orderId });

  // 触发发货流程
  const sessionId = `order-${orderId}`;
  const session = getSession(sessionId);

  if (session) {
    const { deliverOrder } = await import('./tools/delivery.js');
    await deliverOrder(sessionId);
  }
}

async function handleCustomerMessage(data: {
  orderId?: string;
  message?: string;
  buyerId?: string;
}): Promise<void> {
  const { orderId, message, buyerId } = data;
  if (!orderId || !message) return;

  console.log(`[消息] 来自 ${orderId}: ${message}`);
  await log('客户消息', { orderId, message });

  const sessionId = `order-${orderId}`;
  let session = getSession(sessionId);

  if (!session) {
    session = createSession(sessionId, orderId, buyerId || 'unknown');
  }

  // AI 处理回复
  const reply = await handleMessage(sessionId, message);

  // 发送消息给买家
  try {
    const { sendWeidianMessage } = await import('./tools/weidian.js');
    await sendWeidianMessage(orderId, reply);
    console.log(`[发送] 已回复 ${orderId}`);
  } catch (e) {
    console.error('[发送] 回复失败:', (e as Error).message);
  }
}

// ============ 启动服务器 ============

export async function startServer(): Promise<void> {
  const config = getConfig();
  const app = createApp();

  app.listen(config.server.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║   CashClaw 微店版 已启动！                          ║
╠═══════════════════════════════════════════════════╣
║  Webhook: http://localhost:${config.server.port}${config.server.webhookPath}  ║
║  状态面板: http://localhost:${config.server.port}/status     ║
║  测试聊天: POST /api/test-chat                   ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}
