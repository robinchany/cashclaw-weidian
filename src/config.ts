// CashClaw 微店版 - 配置管理
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { Config, Service } from './types.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const CONFIG_PATH = join(__dirname, '..', 'config.json');

// 默认虚拟服务（胖老板的生意）
const DEFAULT_SERVICES: Service[] = [
  {
    id: 'ai-copywriting',
    name: 'AI文案定制',
    description: '小红书/公众号/朋友圈爆款文案，含标题+正文+话题标签',
    price: 9900, // 99元
    keywords: ['文案', '小红书', '公众号', '朋友圈', '爆款', '软文', '种草', '笔记'],
    deliveryTemplate: '【AI文案定制完成！】\n\n标题：{title}\n\n正文：\n{content}\n\n话题标签：\n{hashtags}\n\n——\n⚠️ 使用说明：可根据品牌调性微调，欢迎二次创作。如需调整风格或补充信息，请回复~',
    deliveryDelaySeconds: 30,
  },
  {
    id: 'ai-ppt',
    name: 'AI演示文稿',
    description: 'PPT大纲生成+配色建议，支持PPT/Keynote/Google Slides',
    price: 19900, // 199元
    keywords: ['PPT', '演示', '幻灯片', '汇报', '商业计划', '提案', '课件', '培训'],
    deliveryTemplate: '【AI演示文稿已完成！】\n\n主题：{topic}\n\n结构大纲：\n{outline}\n\n配色建议：{colors}\n\n设计要点：{tips}\n\n——\n⚠️ 说明：可直接导入PPT/Keynote使用，也可让AI继续完善某个章节。',
    deliveryDelaySeconds: 60,
  },
  {
    id: 'ai-logo',
    name: 'AI品牌Logo设计',
    description: 'AI生成Logo描述词+设计参考方案，含5种风格方向',
    price: 49900, // 499元
    keywords: ['logo', '品牌', '商标', '标志', '视觉', 'VI', '设计', '图标'],
    deliveryTemplate: '【AI品牌Logo设计方案】\n\n品牌名：{brand}\n行业：{industry}\n风格：{style}\n\n推荐描述词（用于Midjourney/Stable Diffusion）：\n{keywords}\n\n5种风格参考：\n1. 简约现代：{style1}\n2. 科技感：{style2}\n3. 手绘风：{style3}\n4. 高级感：{style4}\n5. 国潮风：{style5}\n\n——\n⚠️ 使用方法：复制描述词到Midjourney即可生成。生成后可再用 Canva/Figma 微调。',
    deliveryDelaySeconds: 120,
  },
  {
    id: 'ai-video-edit',
    name: 'AI视频剪辑',
    description: '短视频脚本+剪辑方案，含字幕文案+分镜建议',
    price: 29900, // 299元
    keywords: ['视频', '剪辑', '短视频', '抖音', '快手', 'B站', '脚本', '分镜', '字幕'],
    deliveryTemplate: '【AI视频剪辑方案】\n\n视频主题：{topic}\n时长：{duration}\n\n完整脚本：\n{script}\n\n分镜表：\n{storyboard}\n\n字幕文案：\n{subtitle}\n\n背景音乐建议：{music}\n\n——\n⚠️ 说明：可配合剪映/CapCut使用，AI可生成配套的数字人口播脚本。',
    deliveryDelaySeconds: 90,
  },
];

const DEFAULT_CONFIG: Config = {
  weidian: {
    appKey: '',
    appSecret: '',
    shopId: '',
    accessToken: '',
    refreshToken: '',
    tokenExpireAt: 0,
  },
  llm: {
    provider: 'zhipu',
    model: 'glm-4-flash',
    apiKey: process.env.ZHIPU_API_KEY || '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  server: {
    port: 3001,
    webhookPath: '/webhook/weidian',
    webhookSecret: 'changeme_random_secret_key_2024',
  },
  polling: {
    enabled: true,
    intervalMs: 30000, // 30秒轮询一次新订单
  },
  services: DEFAULT_SERVICES,
};

let config: Config = { ...DEFAULT_CONFIG };

export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      // 深度合并，保留新字段
      config = {
        ...DEFAULT_CONFIG,
        ...saved,
        weidian: { ...DEFAULT_CONFIG.weidian, ...saved.weidian },
        llm: { ...DEFAULT_CONFIG.llm, ...saved.llm },
        server: { ...DEFAULT_CONFIG.server, ...saved.server },
        polling: { ...DEFAULT_CONFIG.polling, ...saved.polling },
        services: saved.services || DEFAULT_SERVICES,
      };
      console.log('[配置] 配置文件加载成功');
    } else {
      console.log('[配置] 未找到配置文件，使用默认配置');
    }
  } catch (e) {
    console.error('[配置] 加载失败:', e);
  }
  return config;
}

export function saveConfig(): void {
  try {
    const dir = join(__dirname, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[配置] 已保存到 config.json');
  } catch (e) {
    console.error('[配置] 保存失败:', e);
  }
}

export function updateConfig(updates: Partial<Config>): void {
  config = {
    ...config,
    ...updates,
    weidian: updates.weidian ? { ...config.weidian, ...updates.weidian } : config.weidian,
    llm: updates.llm ? { ...config.llm, ...updates.llm } : config.llm,
    server: updates.server ? { ...config.server, ...updates.server } : config.server,
    polling: updates.polling ? { ...config.polling, ...updates.polling } : config.polling,
    services: updates.services || config.services,
  };
  saveConfig();
}

export function getConfig(): Config {
  return config;
}
