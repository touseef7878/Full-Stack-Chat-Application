/**
 * localStorage-based message cache for instant chat load.
 * Messages appear immediately from cache while fresh data loads in background.
 * Cache is keyed by chatId+chatType, stores last 100 messages per chat.
 */

const CACHE_PREFIX = 'prochat_msgs_';
const MAX_CACHED_MESSAGES = 100;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  messages: any[];
  cachedAt: number;
}

const getCacheKey = (chatId: string, chatType: string) =>
  `${CACHE_PREFIX}${chatType}_${chatId}`;

export const readMessageCache = (chatId: string, chatType: string): any[] => {
  try {
    const raw = localStorage.getItem(getCacheKey(chatId, chatType));
    if (!raw) return [];
    const entry: CacheEntry = JSON.parse(raw);
    // Expire stale cache
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(chatId, chatType));
      return [];
    }
    return entry.messages;
  } catch {
    return [];
  }
};

export const writeMessageCache = (chatId: string, chatType: string, messages: any[]) => {
  try {
    const entry: CacheEntry = {
      messages: messages.slice(-MAX_CACHED_MESSAGES),
      cachedAt: Date.now(),
    };
    localStorage.setItem(getCacheKey(chatId, chatType), JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
};

export const clearMessageCache = (chatId: string, chatType: string) => {
  try {
    localStorage.removeItem(getCacheKey(chatId, chatType));
  } catch {}
};

/** Prune all prochat cache entries older than TTL */
export const pruneExpiredCaches = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  } catch {}
};
