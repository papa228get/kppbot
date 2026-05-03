/**
 * StatsCalculator - подсчет и кэширование статистики
 * Статистика хранится в Blobs с TTL для обхода eventual consistency
 */
class StatsCalculator {
  constructor(getStore, cacheManager) {
    this.getStore = getStore;
    this.cacheManager = cacheManager;
    this.storeName = 'kppbot';
    this.STATS_BLOBS_TTL = 15000; // 15 секунд TTL для Blobs кэша
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Подсчитать статистику по списку автомобилей
   */
  calculateStats(vehicles) {
    return {
      total: vehicles.length,
      allowed: vehicles.filter(v => v.access_status === 'allowed').length,
      denied: vehicles.filter(v => v.access_status === 'denied').length,
      permanent: vehicles.filter(v => v.pass_type === 'permanent').length,
      temporary: vehicles.filter(v => v.pass_type === 'temporary').length
    };
  }

  /**
   * Получить статистику (с многоуровневым кэшированием)
   */
  async getStats(getAllVehiclesFn) {
    // Уровень 1: Локальный кэш
    const cached = this.cacheManager.getStatsCache();
    if (cached) {
      return cached;
    }

    const store = this._getStore();

    // Уровень 2: Blobs кэш
    const cachedStats = await store.get('vehicles:stats');
    if (cachedStats) {
      const stats = JSON.parse(cachedStats);
      // Проверяем, не устарел ли кэш
      const cacheAge = Date.now() - new Date(stats.cached_at).getTime();
      if (cacheAge < this.STATS_BLOBS_TTL) {
        // Обновляем локальный кэш
        this.cacheManager.setStatsCache(stats.data);
        return stats.data;
      }
    }

    // Уровень 3: Пересчитываем
    const vehicles = await getAllVehiclesFn();
    const stats = this.calculateStats(vehicles);

    // Сохраняем в Blobs кэш
    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш
    this.cacheManager.setStatsCache(stats);

    return stats;
  }

  /**
   * Пересчитать и сохранить статистику
   */
  async recalculateStats(vehicles) {
    const store = this._getStore();
    const stats = this.calculateStats(vehicles);

    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш
    this.cacheManager.setStatsCache(stats);

    return stats;
  }

  /**
   * Инвалидировать кэш статистики
   */
  async invalidateStatsCache() {
    const store = this._getStore();
    await store.delete('vehicles:stats');
    this.cacheManager.invalidateStats();
  }

  /**
   * Пересчитать статистику на лету без кэширования в Blobs
   * Используется для мгновенного обновления статистики
   * @param {Function} getIndexFn - функция для получения индекса номеров
   * @param {Function} getVehicleFn - функция для получения данных автомобиля по номеру
   * @returns {Object} статистика
   */
  async calculateStatsOnTheFly(getIndexFn, getVehicleFn) {
    // Получаем свежий индекс (использует локальный кэш если доступен)
    const allPlates = await getIndexFn();

    // Загружаем данные всех автомобилей
    const vehicles = [];
    for (const plate of allPlates) {
      const vehicle = await getVehicleFn(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    // Пересчитываем статистику
    return this.calculateStats(vehicles);
  }
}

module.exports = StatsCalculator;
