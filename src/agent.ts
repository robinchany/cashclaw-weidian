// CashClaw 微店版 - AI Agent 核心
import { chat } from './llm/index.js';
import { getConfig } from './config.js';
import type { 
  TaskSession, 
  AIMessage, 
  Service, 
  ToolResult 
} from './types.js';
import { addMessage, updateSession, log } from './memory/index.js';

// 系统提示词
const SYSTEM_PROMPT = `你是胖老板的 AI 助手，帮他在微店自动接待客户、销售虚拟服务。

【你的身份】
- 你是胖老板虚拟服务店的 24 小时 AI 客服
- 店铺主打：AI文案定制、AI PPT、AI Logo设计、AI视频剪辑
- 语气：专业、热情、真诚，像朋友帮你出主意，不生硬推销

【服务介绍】
1. **AI文案定制**（99元）- 小红书/公众号/朋友圈爆款文案，含标题+正文+话题标签
2. **AI演示文稿**（199元）- PPT大纲+配色建议，支持各类演示场景
3. **AI品牌Logo设计**（499元）- AI生成描述词+5种风格方案
4. **AI视频剪辑**（299元）- 短视频脚本+分镜+字幕文案

【回复原则】
1. 先了解客户需求，再推荐合适的服务
2. 不要直接甩价格，先描述价值
3. 如果客户需求不明确，多问一句
4. 客户确认后，告知"马上下单，备注写好需求，下单后我马上开始"
5. 发货后告知客户"已发货，请查收，有问题随时联系"
6. 不要说"我是AI"，表现得像一个专业的真人员工

【注意】
- 不要夸大效果，如实描述
- 不要承诺做不到的事
- 虚拟服务一经发货不退换，提前告知
- 遇到复杂问题可以转人工`;

// 工具集
const TOOLS = {
  // 匹配服务
  matchService: {
    name: 'matchService',
    description: '根据用户描述的需求，匹配最合适的服务',
    parameters: {
      type: 'object',
      properties: {
        userNeed: { type: 'string', description: '用户描述的需求' },
      },
      required: ['userNeed'],
    },
  },
  
  // 生成订单摘要
  generateOrderSummary: {
    name: 'generateOrderSummary',
    description: '生成订单摘要和发货内容',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话ID' },
        userNeed: { type: 'string', description: '用户需求' },
        serviceId: { type: 'string', description: '服务ID' },
        extraInfo: { type: 'string', description: '额外信息（如品牌名/主题等）' },
      },
      required: ['sessionId', 'serviceId'],
    },
  },
  
  // 发送消息给客户
  sendMessage: {
    name: 'sendMessage',
    description: '向客户发送消息',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话ID' },
        message: { type: 'string', description: '要发送的消息内容' },
      },
      required: ['sessionId', 'message'],
    },
  },
  
  // 更新订单状态
  updateOrderStatus: {
    name: 'updateOrderStatus',
    description: '更新订单状态',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: '会话ID' },
        status: { type: 'string', description: '新状态' },
        note: { type: 'string', description: '备注' },
      },
      required: ['sessionId', 'status'],
    },
  },
};

export { TOOLS };

// ============ 核心函数 ============

/**
 * 处理用户消息
 */
export async function handleMessage(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const config = getConfig();
  
  // 记录消息
  addMessage(sessionId, { role: 'user', content: userMessage });
  await log('收到消息', { sessionId, message: userMessage });

  // 构建消息历史
  const session = await import('./memory/index.js').then(m => 
    (m as typeof import('./memory/index.js')).getSession(sessionId)
  );

  if (!session) {
    return '会话不存在，请重新开始';
  }

  const history = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));

  // 调用 LLM
  try {
    const result = await chat({
      messages: [
        { role: 'user', content: userMessage, timestamp: Date.now() },
      ],
      system: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1000,
    });

    const reply = result.content;
    
    // 记录回复
    addMessage(sessionId, { role: 'assistant', content: reply });
    await log('发送回复', { sessionId, reply });

    return reply;
  } catch (e) {
    const err = e as Error;
    await log('LLM 错误', { sessionId, error: err.message });
    return '抱歉，系统有点问题，请稍后再试~';
  }
}

/**
 * 工具执行器
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (toolName) {
    case 'matchService': {
      const { userNeed } = args as { userNeed: string };
      const config = getConfig();
      const matched = matchServiceByKeyword(userNeed, config.services);
      return {
        success: true,
        output: JSON.stringify(matched),
      };
    }

    case 'generateOrderSummary': {
      const { sessionId, serviceId, extraInfo } = args as {
        sessionId: string;
        serviceId: string;
        extraInfo?: string;
      };
      const config = getConfig();
      const service = config.services.find((s) => s.id === serviceId);
      if (!service) {
        return { success: false, error: '服务不存在' };
      }

      // 用 LLM 生成发货内容
      const content = await generateDeliveryContent(service, extraInfo || '');
      
      // 更新会话上下文
      updateSession(sessionId, {
        context: {
          service,
          detectedNeed: extraInfo || '',
          price: service.price,
        },
      });

      return { success: true, output: content };
    }

    case 'sendMessage': {
      const { sessionId, message } = args as { sessionId: string; message: string };
      // TODO: 调用微店 API 发送消息
      console.log(`[发送消息] ${sessionId}: ${message}`);
      return { success: true, output: '消息已发送' };
    }

    case 'updateOrderStatus': {
      const { sessionId, status, note } = args as {
        sessionId: string;
        status: string;
        note?: string;
      };
      updateSession(sessionId, { status: status as TaskSession['status'] });
      return { success: true, output: `状态已更新为: ${status}` };
    }

    default:
      return { success: false, error: `未知工具: ${toolName}` };
  }
}

/**
 * 关键词匹配服务
 */
function matchServiceByKeyword(
  userNeed: string,
  services: Service[]
): { service: Service | null; confidence: number }[] {
  const results: { service: Service; confidence: number }[] = [];
  const need = userNeed.toLowerCase();

  for (const service of services) {
    let score = 0;
    for (const kw of service.keywords) {
      if (need.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > 0) {
      results.push({ service, confidence: score / service.keywords.length });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 生成发货内容（导出供 delivery.ts 使用）
 */
export async function generateDeliveryContent(
  service: Service,
  userNeed: string
): Promise<string> {
  const prompt = `用户需求：${userNeed}

请根据以上需求，生成${service.name}的完整交付内容。

要求：
1. 内容要专业、完整、可直接使用
2. 结合用户具体需求定制
3. 格式清晰，便于阅读

请用 JSON 格式输出：
{
  "summary": "一句话总结",
  "content": "详细交付内容",
  "tips": "使用建议"
}`;

  try {
    const result = await chat({
      messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
      system: '你是一个专业的虚拟服务交付助手，输出 JSON 格式。',
      temperature: 0.5,
      maxTokens: 2000,
    });

    return result.content;
  } catch {
    // 如果失败，返回基础模板
    return service.deliveryTemplate.replace('{topic}', userNeed);
  }
}

/**
 * 判断是否需要发货
 */
export function shouldDeliver(session: TaskSession): boolean {
  // 有明确的服务 + 用户确认 + 状态为 processing
  return (
    session.context.service !== null &&
    session.messages.some((m) => {
      const c = m.content.toLowerCase();
      return (
        c.includes('下单') ||
        c.includes('确认') ||
        c.includes('好了') ||
        c.includes('开始')
      );
    })
  );
}
