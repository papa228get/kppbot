/**
 * CacheManager - управление локальным кэшированием
 * Кэширует индекс и статистику для обхода eventual consistency Netlify Blobs
 */
class CacheManager {
  constructor() {
    // Кэш индекса
    this.indexCache = null;
    this.indexCacheTime = null;

    // Кэш статистики
    this.statsCache = null;
    this.statsCacheTime = null;

    // TTL для кэшей (в миллисекундах)
    this.INDEX_TTL = 30000; // 30 секунд
    this.STATS_TTL = 30000; // 30 секунд
  }

  /**
   * Получить кэш индекса (если свежий)
   */
  getIndexCache() {
    const now = Date.now();
    if (this.indexCache && this.indexCacheTime && (now - this.indexCacheTime) < this.INDEX_TTL) {
      return this.indexCache;
    }
    return null;
  }

  /**
   * Установить кэш индекса
   */
  setIndexCache(index) {
    this.indexCache = index;
    this.indexCacheTime = Date.now();
  }

  /**
   * Получить кэш статистики (если свежий)
   */
  getStatsCache() {
    const now = Date.now();
    if (this.statsCache && this.statsCacheTime && (now - this.statsCacheTime) < this.STATS_TTL) {
      return this.statsCache;
    }
    return null;
  }

  /**
   * Установить кэш статистики
   */
  setStatsCache(stats) {
    this.statsCache = stats;
    this.statsCacheTime = Date.now();
  }

  /**
   * Инвалидировать весь кэш
   */
  invalidateAll() {
    this.indexCache = null;
    this.indexCacheTime = null;
    this.statsCache = null;
    this.statsCacheTime = null;
  }

  /**
   * Инвалидировать кэш индекса
   */
  invalidateIndex() {
    this.indexCache = null;
    this.indexCacheTime = null;
  }

  /**
   * Инвалидировать кэш статистики
   */
  invalidateStats() {
    this.statsCache = null;
    this.statsCacheTime = null;
  }
}

module.exports = CacheManager;
