// CashClaw 微店版 - 微店 API 工具
import { getConfig, saveConfig } from '../config.js';
import type { WeidianOrder } from '../types.js';

// ============ Token 管理 ============

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

export async function refreshAccessToken(): Promise<string> {
  const config = getConfig();
  const { appKey, appSecret } = config.weidian;

  if (!appKey || !appSecret) {
    throw new Error('微店 appKey 或 appSecret 未配置');
  }

  const url = 'https://api.vdian.com/oauth2/access_token';
  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    grant_type: 'token',
    refresh_token: config.weidian.refreshToken,
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json() as TokenResponse;

  if (data.errcode) {
    throw new Error(`Token 刷新失败: ${data.errmsg}`);
  }

  // 更新配置
  const updated = {
    weidian: {
      ...config.weidian,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpireAt: Date.now() + data.expires_in * 1000,
    },
  };

  const { updateConfig } = await import('../config.js');
  updateConfig(updated);

  console.log('[微店] Access Token 已刷新');
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  const { accessToken, tokenExpireAt } = config.weidian;

  // 提前 5 分钟刷新
  if (!accessToken || Date.now() > tokenExpireAt - 5 * 60 * 1000) {
    return refreshAccessToken();
  }

  return accessToken;
}

// ============ API 请求 ============

async function vdianRequest<T>(
  apiName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const token = await getAccessToken();
  const config = getConfig();

  const body = {
    access_token: token,
    ...params,
  };

  const url = `https://api.vdian.com/api/${apiName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as {
    status: { code: number; normal?: string; message: string };
    result?: T;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode || (data.status && data.status.code !== 1)) {
    const msg = data.errmsg || data.status?.message || '未知错误';
    throw new Error(`微店 API 错误 [${apiName}]: ${msg}`);
  }

  return data.result as T;
}

// ============ 订单 API ============

interface VdianOrderItem {
  item_id: string;
  item_name: string;
  num: number;
  price: number;
}

interface VdianOrderResult {
  orderid: string;
  pay_time: number;
  buyer_nick: string;
  remark: string; // 买家备注 = 需求描述！
  item_info: VdianOrderItem[];
  freight_price?: number;
  total_price?: number;
  status?: string;
}

function parseOrder(v: VdianOrderResult): WeidianOrder {
  return {
    orderId: v.orderid,
    buyerNick: v.buyer_nick || '匿名买家',
    buyerNote: v.remark || '',
    totalFee: v.total_price || v.freight_price || 0,
    items: (v.item_info || []).map((item) => ({
      itemId: item.item_id,
      itemName: item.item_name,
      quantity: item.num,
      price: item.price,
    })),
    status: 'pending',
    createdAt: v.pay_time ? v.pay_time * 1000 : Date.now(),
    paidAt: v.pay_time ? v.pay_time * 1000 : undefined,
  };
}

/**
 * 获取订单列表
 * status: all | paid | sent | finished
 */
export async function getWeidianOrders(
  status = 'paid',
  page = 1,
  pageSize = 20
): Promise<WeidianOrder[]> {
  try {
    const result = await vdianRequest<{ orders: VdianOrderResult[] }>('order.list.get', {
      status,
      page_index: page,
      page_size: pageSize,
    });

    return (result.orders || []).map(parseOrder);
  } catch (e) {
    console.error('[微店] 获取订单失败:', (e as Error).message);
    return [];
  }
}

/**
 * 获取单个订单详情
 */
export async function getWeidianOrder(orderId: string): Promise<WeidianOrder | null> {
  try {
    const result = await vdianRequest<VdianOrderResult>('order.get', { order_id: orderId });
    return parseOrder(result);
  } catch (e) {
    console.error('[微店] 获取订单失败:', (e as Error).message);
    return null;
  }
}

/**
 * 发送消息给买家（利用订单备注/内部留言）
 * 注：微店个人版 API 发消息能力有限，这里用日志替代
 */
export async function sendWeidianMessage(
  orderId: string,
  message: string
): Promise<void> {
  // 微店 API 本身不直接支持给买家发消息
  // 方案1：利用订单备注（商家视角，买家看不到）
  // 方案2：引导买家加微信
  // 方案3：通过 Webhook 实时推送（如果有微店小程序通知）
  
  console.log(`[消息] 订单 ${orderId} 消息: ${message}`);
  console.log('[提示] 微店个人版 API 不支持直接给买家发消息');
  console.log('[建议] 在发货内容中附上微信联系方式，引导客户添加');
  
  // 如果有配置微信，生成引导文案
  const { getConfig: getC } = await import('../config.js');
  const wechatNote = '如需进一步沟通，请加微信号 xxx （备注订单号）';
  
  // 记录日志
  const { log } = await import('../memory/index.js');
  await log('发送消息', { orderId, message });
}

/**
 * 更新订单状态（发货）
 */
export async function shipOrder(
  orderId: string,
  deliveryContent: string
): Promise<boolean> {
  try {
    // 虚拟商品发货：传卡密/下载链接
    // 微店支持"自动发货"设置，这里用手动发货接口
    await vdianRequest<unknown>('order.send', {
      order_id: orderId,
      logistics_type: 0, // 虚拟发货
      delivery_content: deliveryContent,
    });

    console.log(`[发货] 订单 ${orderId} 已发货`);
    return true;
  } catch (e) {
    console.error('[发货] 失败:', (e as Error).message);
    return false;
  }
}

// ============ 轮询控制器 ============

export const pollOrders = {
  timer: null as NodeJS.Timeout | null,
  lastOrderId: '',

  start(): void {
    if (this.timer) return;
    console.log('[轮询] 启动订单轮询...');

    const run = async () => {
      try {
        const config = getConfig();
        const orders = await getWeidianOrders('paid');

        // 只处理新订单
        for (const order of orders) {
          if (order.orderId !== this.lastOrderId) {
            this.lastOrderId = order.orderId;

            // 触发 Webhook 处理逻辑
            const { handleNewOrder } = await import('../server.js');
            await handleNewOrder(order);
          }
        }
      } catch (e) {
        console.error('[轮询] 异常:', (e as Error).message);
      }
    };

    // 立即执行一次
    run();

    // 定时轮询
    const config = getConfig();
    this.timer = setInterval(run, config.polling.intervalMs);
  },

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[轮询] 已停止');
    }
  },
};
