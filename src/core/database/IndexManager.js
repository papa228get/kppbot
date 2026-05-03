/**
 * IndexManager - управление индексом номеров автомобилей
 * Индекс хранится в Blobs как список всех номеров для быстрого доступа
 */
class IndexManager {
  constructor(getStore, cacheManager) {
    this.getStore = getStore;
    this.cacheManager = cacheManager;
    this.storeName = 'kppbot';
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Получить индекс (с кэшированием)
   */
  async getIndex() {
    // Проверяем кэш
    const cached = this.cacheManager.getIndexCache();
    if (cached) {
      return cached;
    }

    // Загружаем из Blobs
    const store = this._getStore();
    const indexData = await store.get('vehicles:index');
    const index = indexData ? JSON.parse(indexData) : [];

    // Обновляем кэш
    this.cacheManager.setIndexCache(index);

    return index;
  }

  /**
   * Получить индекс с strong consistency (без кэша)
   * Используется для гарантированно актуальных данных
   */
  async getIndexStrong() {
    const store = this.getStore({ name: this.storeName, consistency: 'strong' });
    const indexData = await store.get('vehicles:index');
    const index = indexData ? JSON.parse(indexData) : [];
    return index;
  }

  /**
   * Добавить номер в индекс
   */
  async addToIndex(plateNumber) {
    const store = this._getStore();
    const index = await this.getIndex();

    // Добавляем номер, если его еще нет
    if (!index.includes(plateNumber)) {
      index.push(plateNumber);
      await store.set('vehicles:index', JSON.stringify(index));
      this.cacheManager.setIndexCache(index);
    }
  }

  /**
   * Удалить номер из индекса
   */
  async removeFromIndex(plateNumber) {
    const store = this._getStore();
    const index = await this.getIndex();

    // Удаляем номер
    const newIndex = index.filter(plate => plate !== plateNumber);
    await store.set('vehicles:index', JSON.stringify(newIndex));
    this.cacheManager.setIndexCache(newIndex);
  }

  /**
   * Пересоздать индекс из списка номеров
   */
  async rebuildIndex(plateNumbers) {
    const store = this._getStore();
    const uniquePlates = [...new Set(plateNumbers)];
    await store.set('vehicles:index', JSON.stringify(uniquePlates));
    this.cacheManager.setIndexCache(uniquePlates);
  }

  /**
   * Очистить индекс
   */
  async clearIndex() {
    const store = this._getStore();
    await store.delete('vehicles:index');
    this.cacheManager.setIndexCache([]);
  }
}

module.exports = IndexManager;
