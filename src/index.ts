// CashClaw 微店版 - 入口文件
import { loadConfig } from './config.js';
import { loadMemory, log } from './memory/index.js';
import { startServer } from './server.js';
import { pollOrders } from './tools/weidian.js';

// ============ 启动流程 ============

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         CashClaw 微店版 v1.0                      ║
║         AI 自动接单系统                            ║
╚═══════════════════════════════════════════════════╝
  `);

  // 1. 加载配置
  const config = loadConfig();

  // 2. 加载记忆
  loadMemory();
  await log('CashClaw 微店版启动', {
    llm: config.llm.model,
    polling: config.polling.enabled,
    services: config.services.length,
  });

  // 3. 启动 Webhook 服务器
  await startServer();

  // 4. 如果启用轮询，启动订单轮询
  if (config.polling.enabled) {
    console.log(`[轮询] 已启用，每 ${config.polling.intervalMs / 1000}s 检查一次`);
    pollOrders.start();
  } else {
    console.log('[轮询] 已禁用，仅通过 Webhook 接收订单');
  }

  console.log('[就绪] CashClaw 微店版运行中，按 Ctrl+C 停止');
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n[退出] 正在保存状态...');
  await log('CashClaw 微店版关闭', { time: Date.now() });
  pollOrders.stop();
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('[错误] 未捕获异常:', err);
  await log('崩溃', { error: err.message, stack: err.stack });
  process.exit(1);
});

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
