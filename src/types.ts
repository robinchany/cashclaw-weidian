// CashClaw 微店版 - 类型定义

export interface Config {
  // 微店 API 配置
  weidian: {
    appKey: string;
    appSecret: string;
    shopId: string;
    accessToken: string;
    refreshToken: string;
    tokenExpireAt: number; // unix ms
  };
  // LLM 配置（复用智谱）
  llm: {
    provider: 'zhipu';
    model: string;
    apiKey: string;
    baseUrl?: string;
  };
  // 服务配置
  server: {
    port: number;
    webhookPath: string;
    webhookSecret: string; // 签名密钥
  };
  // Polling 配置
  polling: {
    enabled: boolean;
    intervalMs: number;
  };
  // 虚拟服务列表
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number; // 分
  keywords: string[]; // 触发关键词
  deliveryTemplate: string; // 发货模板
  deliveryDelaySeconds: number; // 发货延迟
}

// 订单状态
export type OrderStatus = 
  | 'pending'      // 待处理
  | 'processing'   // 处理中
  | 'paid'         // 已支付
  | 'delivered'    // 已发货
  | 'completed'    // 已完成
  | 'cancelled'    // 已取消
  | 'refunded';    // 已退款

// 微店订单
export interface WeidianOrder {
  orderId: string;
  buyerNick: string;
  buyerNote: string; // 买家备注 = 需求描述
  totalFee: number; // 总金额（分）
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  paidAt?: number;
}

export interface OrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
}

// 任务会话
export interface TaskSession {
  sessionId: string;
  orderId: string;
  userId: string;
  status: OrderStatus;
  messages: AIMessage[];
  context: {
    service: Service | null;
    detectedNeed: string; // 检测到的需求
    price: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// 工具执行结果
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

// Polling 任务
export interface PollingJob {
  lastOrderId: string;
  lastCheckAt: number;
}
