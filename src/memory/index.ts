// CashClaw 微店版 - 记忆系统
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TaskSession, AIMessage } from '../types.js';

const __dirname = join(fileURLToPath(import.meta.url), '..', '..');
const MEMORY_DIR = join(__dirname, '.memory');
const SESSIONS_FILE = join(MEMORY_DIR, 'sessions.json');
const LOG_FILE = join(MEMORY_DIR, 'log.jsonl');

interface MemoryStore {
  sessions: Record<string, TaskSession>;
  sessionsIndex: string[];
}

let store: MemoryStore = { sessions: {}, sessionsIndex: [] };

export function loadMemory(): void {
  try {
    mkdirSync(MEMORY_DIR, { recursive: true });
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, 'utf-8');
      store = JSON.parse(data);
      console.log(`[记忆] 加载了 ${store.sessionsIndex.length} 个会话`);
    }
  } catch (e) {
    console.error('[记忆] 加载失败:', e);
    store = { sessions: {}, sessionsIndex: [] };
  }
}

export function saveMemory(): void {
  try {
    mkdirSync(MEMORY_DIR, { recursive: true });
    writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[记忆] 保存失败:', e);
  }
}

export async function log(message: string, context?: Record<string, unknown>): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    context,
  };
  try {
    mkdirSync(MEMORY_DIR, { recursive: true });
    const line = JSON.stringify(entry) + '\n';
    writeFileSync(LOG_FILE, line, { flag: 'a' });
  } catch (e) {
    console.error('[记忆] 日志写入失败:', e);
  }
}

export function createSession(sessionId: string, orderId: string, userId: string): TaskSession {
  const session: TaskSession = {
    sessionId,
    orderId,
    userId,
    status: 'pending',
    messages: [],
    context: {
      service: null,
      detectedNeed: '',
      price: 0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.sessions[sessionId] = session;
  store.sessionsIndex.unshift(sessionId);
  saveMemory();
  return session;
}

export function getSession(sessionId: string): TaskSession | null {
  return store.sessions[sessionId] || null;
}

export function getSessionByOrder(orderId: string): TaskSession | null {
  const found = Object.values(store.sessions).find((s) => s.orderId === orderId);
  return found || null;
}

export function updateSession(
  sessionId: string,
  updates: Partial<TaskSession>
): TaskSession | null {
  const session = store.sessions[sessionId];
  if (!session) return null;
  Object.assign(session, updates, { updatedAt: Date.now() });
  saveMemory();
  return session;
}

export function addMessage(
  sessionId: string,
  message: Omit<AIMessage, 'timestamp'>
): void {
  const session = store.sessions[sessionId];
  if (!session) return;
  session.messages.push({ ...message, timestamp: Date.now() });
  session.updatedAt = Date.now();
  saveMemory();
}

export function getRecentSessions(limit = 10): TaskSession[] {
  return store.sessionsIndex
    .slice(0, limit)
    .map((id) => store.sessions[id])
    .filter(Boolean);
}

export function searchSessions(query: string, limit = 5): TaskSession[] {
  const q = query.toLowerCase();
  const results: TaskSession[] = [];
  for (const s of Object.values(store.sessions)) {
    if (
      s.orderId.includes(q) ||
      s.context.detectedNeed.toLowerCase().includes(q) ||
      s.messages.some((m) => m.content.toLowerCase().includes(q))
    ) {
      results.push(s);
    }
    if (results.length >= limit) break;
  }
  return results;
}

export interface Stats {
  totalSessions: number;
  pending: number;
  completed: number;
  avgResponseTime: number;
}

export function getStats(): Stats {
  const sessions = Object.values(store.sessions);
  const completed = sessions.filter((s) => s.status === 'completed');
  const pending = sessions.filter((s) => s.status === 'pending' || s.status === 'processing');
  let avgResponseTime = 0;
  if (completed.length > 0) {
    let totalTime = 0;
    let count = 0;
    for (const s of completed) {
      const first = s.messages.find((m) => m.role === 'user');
      const last = s.messages.find((m) => m.role === 'assistant');
      if (first && last) {
        totalTime += last.timestamp - first.timestamp;
        count++;
      }
    }
    avgResponseTime = count > 0 ? Math.round(totalTime / count / 1000) : 0;
  }
  return {
    totalSessions: sessions.length,
    pending: pending.length,
    completed: completed.length,
    avgResponseTime,
  };
}
