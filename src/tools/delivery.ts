// CashClaw 微店版 - 自动发货工具
import { getSession, log } from '../memory/index.js';
import { shipOrder, sendWeidianMessage } from './weidian.js';
import { generateDeliveryContent } from '../agent.js';
import { getConfig } from '../config.js';

/**
 * 执行虚拟商品自动发货
 */
export async function deliverOrder(sessionId: string): Promise<boolean> {
  const session = getSession(sessionId);
  if (!session) {
    console.error('[发货] 会话不存在:', sessionId);
    return false;
  }

  const { service, detectedNeed } = session!.context;

  if (!service) {
    console.log('[发货] 未匹配服务，跳过自动发货');
    return false;
  }

  console.log(`[发货] 开始发货 | 服务: ${service.name} | 价格: ${service.price / 100}元`);

  try {
    // 1. 生成交付内容
    const content = await generateDeliveryContent(service, detectedNeed);

    // 2. 组装发货文案
    const deliveryText = buildDeliveryMessage(service, content);

    // 3. 发货
    const success = await shipOrder(session.orderId, deliveryText);

    if (success) {
      // 4. 通知买家
      await sendWeidianMessage(
        session.orderId,
        '✅ 您的订单已发货，请到订单页面查收~'
      );

      // 5. 更新状态
      const { updateSession } = await import('../memory/index.js');
      updateSession(sessionId, { status: 'delivered' });

      await log('发货完成', {
        sessionId,
        orderId: session.orderId,
        service: service.name,
      });

      console.log(`[发货] ✅ 完成 | ${session.orderId}`);
      return true;
    }
  } catch (e) {
    console.error('[发货] 异常:', (e as Error).message);
    await log('发货失败', {
      sessionId,
      error: (e as Error).message,
    });
  }

  return false;
}

/**
 * 构建发货消息
 */
function buildDeliveryMessage(
  service: NonNullable<NonNullable<ReturnType<typeof getSession>>['context']['service']>,
  aiContent: string
): string {
  const wechatContact = '[您的微信号]'; // TODO: 填入真实微信号

  return `🎉 恭喜！您的 ${service.name} 已完成！

═══════════════════════════
${service.name}
═══════════════════════════

${aiContent}

═══════════════════════════
💡 使用说明
═══════════════════════════
${service.description}

📞 如需调整或有疑问，请联系：
微信：${wechatContact}（备注订单号 ${service.id}）

⏰ 虚拟商品一经发货不支持退款，如有问题请在24小时内联系。

—— 胖老板虚拟服务店
`;
}

/**
 * 手动触发发货
 */
export async function manualDeliver(
  sessionId: string,
  customContent?: string
): Promise<{ success: boolean; content?: string }> {
  const session = getSession(sessionId);
  if (!session) {
    return { success: false };
  }

  const content = customContent || await generateDeliveryContent(
    session.context.service!,
    session.context.detectedNeed
  );

  const success = await shipOrder(session.orderId, buildDeliveryMessage(
    session.context.service!,
    content
  ));

  return { success, content: buildDeliveryMessage(session.context.service!, content) };
}
