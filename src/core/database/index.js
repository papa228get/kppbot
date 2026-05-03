const CacheManager = require('./CacheManager');
const IndexManager = require('./IndexManager');
const StatsCalculator = require('./StatsCalculator');
const VehicleRepository = require('./VehicleRepository');

/**
 * Database - главный фасад для работы с данными
 * Координирует работу всех модулей: кэширование, индексация, статистика, CRUD
 */
class Database {
  constructor(getStore) {
    this.getStore = getStore;
    this.storeName = 'kppbot';

    // Инициализируем модули
    this.cacheManager = new CacheManager();
    this.indexManager = new IndexManager(getStore, this.cacheManager);
    this.statsCalculator = new StatsCalculator(getStore, this.cacheManager);
    this.vehicleRepository = new VehicleRepository(getStore, this.indexManager, this.statsCalculator);
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  // ==================== CRUD операции ====================

  /**
   * Добавить автомобиль (без проверки на дубликаты, без обновления индекса)
   */
  async addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    return await this.vehicleRepository.addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes);
  }

  /**
   * Массовое добавление автомобилей с обновлением индекса одним вызовом
   */
  async addVehiclesBatch(vehicles) {
    return await this.vehicleRepository.addVehiclesBatch(vehicles);
  }

  /**
   * Добавить автомобиль с проверкой на дубликаты
   */
  async addVehicleWithCheck(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    // Проверяем существование
    const existing = await this.findVehicle(plateNumber);
    if (existing) {
      return false;
    }

    return await this.addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes);
  }

  /**
   * Найти автомобиль по точному номеру
   */
  async findVehicle(plateNumber) {
    return await this.vehicleRepository.findVehicle(plateNumber);
  }

  /**
   * Найти автомобили по частичному совпадению номера
   */
  async findVehiclesByPartialPlate(plateNumber) {
    return await this.vehicleRepository.findVehiclesByPartialPlate(plateNumber);
  }

  /**
   * Получить список автомобилей с пагинацией
   */
  async getVehiclesPaginated(page = 1, perPage = 5) {
    return await this.vehicleRepository.getVehiclesPaginated(page, perPage);
  }

  /**
   * Получить все автомобили
   */
  async getAllVehicles() {
    return await this.vehicleRepository.getAllVehicles();
  }

  /**
   * Удалить автомобиль
   */
  async removeVehicle(plateNumber) {
    return await this.vehicleRepository.removeVehicle(plateNumber);
  }

  /**
   * Обновить поле автомобиля
   */
  async updateVehicle(plateNumber, field, value) {
    return await this.vehicleRepository.updateVehicle(plateNumber, field, value);
  }

  /**
   * Полная очистка всех данных (индекс, кэш, статистика, все автомобили)
   */
  async clearAllData() {
    return await this.vehicleRepository.clearAllData();
  }

  // ==================== Статистика ====================

  /**
   * Получить статистику
   */
  async getStats() {
    return await this.statsCalculator.getStats(
      async () => await this.getAllVehicles()
    );
  }

  // ==================== Приватные методы (для обратной совместимости) ====================

  /**
   * Обновить индекс номеров (приватный метод)
   * @deprecated Используется только для обратной совместимости
   */
  async _updateIndex(plateNumber, action) {
    if (action === 'add') {
      await this.indexManager.addToIndex(plateNumber);
    } else if (action === 'remove') {
      await this.indexManager.removeFromIndex(plateNumber);
    }
  }

  /**
   * Инвалидировать кэш статистики (приватный метод)
   * @deprecated Используется только для обратной совместимости
   */
  async _invalidateStatsCache() {
    await this.statsCalculator.invalidateStatsCache();
  }

  /**
   * Пересчитать и сохранить статистику (приватный метод)
   * @deprecated Используется только для обратной совместимости
   */
  async _recalculateStats() {
    const vehicles = await this.getAllVehicles();
    await this.statsCalculator.recalculateStats(vehicles);
  }
}

module.exports = Database;
