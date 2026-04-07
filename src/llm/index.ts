// CashClaw 微店版 - LLM 调用模块（智谱 AI）
import { getConfig } from '../config.js';
import type { AIMessage } from '../types.js';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ChatOptions {
  messages: AIMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

/**
 * 调用智谱 AI GLM-4 接口
 */
export async function chat(options: ChatOptions): Promise<LLMResponse> {
  const config = getConfig();
  const { apiKey, model, baseUrl } = config.llm;

  const systemMsg = options.system
    ? { role: 'system', content: options.system }
    : null;

  // 转换消息格式
  const messages = [
    ...(options.messages[0]?.role !== 'system' && options.system
      ? [systemMsg!]
      : []),
    ...options.messages.filter((m) => m.role !== 'system'),
  ];

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  };

  // 添加工具调用支持
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    if (options.toolChoice) {
      body.tool_choice = 'auto';
    }
  }

  const url = (baseUrl || 'https://open.bigmodel.cn/api/paas/v4') + '/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API 错误: ${response.status} ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{
      message: {
        content: string;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason: string;
    }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    model: string;
  };

  const choice = data.choices[0];

  // 处理工具调用
  let content = choice.message.content || '';
  const toolCalls = choice.message.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    // 如果有工具调用，返回格式化的工具调用信息
    const toolInfo = toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
    content = `[TOOL_CALLS] ${JSON.stringify(toolInfo)}`;
  }

  return {
    content,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
    model: data.model,
  };
}

/**
 * 简单对话（用于闲聊/分析）
 */
export async function ask(
  prompt: string,
  system?: string,
  options?: Partial<Pick<ChatOptions, 'temperature' | 'maxTokens'>>
): Promise<string> {
  const result = await chat({
    messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
    system,
    ...options,
  });
  return result.content;
}

/**
 * 成本估算
 */
export function estimateCost(usage: { promptTokens: number; completionTokens: number }): string {
  // GLM-4-flash 价格（参考）
  const inputPrice = 0.1 / 1_000_000; // $0.1/1M tokens
  const outputPrice = 0.1 / 1_000_000;

  const cost = usage.promptTokens * inputPrice + usage.completionTokens * outputPrice;
  return `$${cost.toFixed(6)}`;
}
