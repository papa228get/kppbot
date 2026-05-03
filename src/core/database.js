/**
 * Database класс для работы с Netlify Blobs
 * Заменяет SQLite из PHP версии
 */
class Database {
  constructor(getStore) {
    this.getStore = getStore;
    this.storeName = 'kppbot';
    // Локальный кэш индекса для обхода eventual consistency
    this.indexCache = null;
    this.indexCacheTime = null;
    // Локальный кэш статистики для обхода eventual consistency
    this.statsCache = null;
    this.statsCacheTime = null;
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Добавить автомобиль (без проверки на дубликаты, без обновления индекса)
   */
  async addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    const store = this._getStore();

    const vehicle = {
      plate_number: plateNumber,
      brand: brand || '',
      access_status: accessStatus || 'allowed',
      pass_type: passType || 'temporary',
      expiry_date: expiryDate || null,
      notes: notes || '',
      created_at: new Date().toISOString()
    };

    // Сохраняем автомобиль
    await store.set(`vehicle:${plateNumber}`, JSON.stringify(vehicle));

    return true;
  }

  /**
   * Массовое добавление автомобилей с обновлением индекса одним вызовом
   */
  async addVehiclesBatch(vehicles) {
    const store = this._getStore();

    // Добавляем все автомобили
    for (const vehicle of vehicles) {
      const vehicleData = {
        plate_number: vehicle.plate_number,
        brand: vehicle.brand || '',
        access_status: vehicle.access_status || 'allowed',
        pass_type: vehicle.pass_type || 'temporary',
        expiry_date: vehicle.expiry_date || null,
        notes: vehicle.notes || '',
        created_at: new Date().toISOString()
      };

      await store.set(`vehicle:${vehicle.plate_number}`, JSON.stringify(vehicleData));
    }

    // Обновляем индекс ОДИН РАЗ после всех добавлений
    const indexData = await store.get('vehicles:index');
    let allPlates = indexData ? JSON.parse(indexData) : [];

    // Используем Set для дедупликации
    const platesSet = new Set(allPlates);
    for (const vehicle of vehicles) {
      platesSet.add(vehicle.plate_number);
    }

    const newIndex = [...platesSet];
    await store.set('vehicles:index', JSON.stringify(newIndex));

    // Обновляем локальный кэш
    this.indexCache = newIndex;
    this.indexCacheTime = Date.now();

    // Пересчитываем статистику по ВСЕМ автомобилям из нового индекса
    const allVehicles = [];
    for (const plate of newIndex) {
      const vehicleData = await store.get(`vehicle:${plate}`);
      if (vehicleData) {
        allVehicles.push(JSON.parse(vehicleData));
      }
    }

    const stats = {
      total: allVehicles.length,
      allowed: allVehicles.filter(v => v.access_status === 'allowed').length,
      denied: allVehicles.filter(v => v.access_status === 'denied').length,
      permanent: allVehicles.filter(v => v.pass_type === 'permanent').length,
      temporary: allVehicles.filter(v => v.pass_type === 'temporary').length
    };

    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш статистики
    this.statsCache = stats;
    this.statsCacheTime = Date.now();

    return vehicles.length;
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
    const store = this._getStore();
    const data = await store.get(`vehicle:${plateNumber}`);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Найти автомобили по частичному совпадению номера
   */
  async findVehiclesByPartialPlate(plateNumber) {
    const store = this._getStore();

    // Сначала пробуем точное совпадение
    const exactMatch = await this.findVehicle(plateNumber);
    if (exactMatch) {
      return [exactMatch];
    }

    // Получаем индекс всех номеров
    const indexData = await store.get('vehicles:index');
    if (!indexData) {
      return [];
    }

    const allPlates = JSON.parse(indexData);

    // Фильтруем по началу номера (без региона)
    const matches = allPlates.filter(plate => plate.startsWith(plateNumber));

    // Загружаем данные для каждого совпадения
    const vehicles = [];
    for (const plate of matches) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  }

  /**
   * Получить список автомобилей с пагинацией
   */
  async getVehiclesPaginated(page = 1, perPage = 5) {
    const store = this._getStore();

    // Используем кэш индекса если он свежий (менее 30 секунд)
    let allPlates;
    const now = Date.now();
    if (this.indexCache && this.indexCacheTime && (now - this.indexCacheTime) < 30000) {
      allPlates = this.indexCache;
    } else {
      // Получаем индекс из Blobs
      const indexData = await store.get('vehicles:index');
      allPlates = indexData ? JSON.parse(indexData) : [];
      // Обновляем кэш
      this.indexCache = allPlates;
      this.indexCacheTime = now;
    }

    const total = allPlates.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;

    // Получаем номера для текущей страницы
    const pagePlates = allPlates.slice(offset, offset + perPage);

    // Загружаем данные автомобилей
    const vehicles = [];
    for (const plate of pagePlates) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return {
      vehicles,
      total,
      page,
      total_pages: totalPages
    };
  }

  /**
   * Получить все автомобили
   */
  async getAllVehicles() {
    const store = this._getStore();

    // Получаем индекс всех номеров
    const indexData = await store.get('vehicles:index');
    const allPlates = indexData ? JSON.parse(indexData) : [];

    // Загружаем данные всех автомобилей
    const vehicles = [];
    for (const plate of allPlates) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  }

  /**
   * Удалить автомобиль
   */
  async removeVehicle(plateNumber) {
    const store = this._getStore();

    // Проверяем существование
    const existing = await this.findVehicle(plateNumber);
    if (!existing) {
      return false;
    }

    // Удаляем автомобиль
    await store.delete(`vehicle:${plateNumber}`);

    // Обновляем индекс
    await this._updateIndex(plateNumber, 'remove');

    // Пересчитываем статистику сразу
    await this._recalculateStats();

    return true;
  }

  /**
   * Обновить поле автомобиля
   */
  async updateVehicle(plateNumber, field, value) {
    const allowedFields = ['plate_number', 'brand', 'access_status', 'pass_type', 'expiry_date', 'notes'];

    if (!allowedFields.includes(field)) {
      return false;
    }

    const store = this._getStore();
    const vehicle = await this.findVehicle(plateNumber);

    if (!vehicle) {
      return false;
    }

    // Если меняем номер, нужно переместить запись
    if (field === 'plate_number') {
      const newPlateNumber = value;

      // Проверяем, не существует ли уже автомобиль с новым номером
      const existing = await this.findVehicle(newPlateNumber);
      if (existing) {
        return false;
      }

      // Удаляем старую запись
      await store.delete(`vehicle:${plateNumber}`);
      await this._updateIndex(plateNumber, 'remove');

      // Создаем новую запись
      vehicle.plate_number = newPlateNumber;
      await store.set(`vehicle:${newPlateNumber}`, JSON.stringify(vehicle));
      await this._updateIndex(newPlateNumber, 'add');
    } else {
      // Обновляем поле
      vehicle[field] = value;
      await store.set(`vehicle:${plateNumber}`, JSON.stringify(vehicle));
    }

    // Инвалидируем кэш статистики
    await this._invalidateStatsCache();

    // Возвращаем обновлённый объект вместо true
    return vehicle;
  }

  /**
   * Получить все автомобили
   */
  async getAllVehicles() {
    const store = this._getStore();

    // Получаем индекс
    const indexData = await store.get('vehicles:index');
    const allPlates = indexData ? JSON.parse(indexData) : [];

    // Загружаем все автомобили
    const vehicles = [];
    for (const plate of allPlates) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  }

  /**
   * Полная очистка всех данных (индекс, кэш, статистика, все автомобили)
   */
  async clearAllData() {
    const store = this._getStore();

    // Получаем список всех номеров из индекса
    const indexData = await store.get('vehicles:index');
    const allPlates = indexData ? JSON.parse(indexData) : [];

    // Удаляем все записи автомобилей
    for (const plate of allPlates) {
      await store.delete(`vehicle:${plate}`);
    }

    // Очищаем индекс
    await store.delete('vehicles:index');

    // Очищаем локальный кэш индекса
    this.indexCache = [];
    this.indexCacheTime = Date.now();

    // Пересчитываем статистику (будет 0 по всем полям)
    const stats = {
      total: 0,
      allowed: 0,
      denied: 0,
      permanent: 0,
      temporary: 0
    };

    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш статистики
    this.statsCache = stats;
    this.statsCacheTime = Date.now();

    return true;
  }

  /**
   * Получить статистику
   */
  async getStats() {
    // Используем локальный кэш если он свежий (менее 30 секунд)
    const now = Date.now();
    if (this.statsCache && this.statsCacheTime && (now - this.statsCacheTime) < 30000) {
      return this.statsCache;
    }

    const store = this._getStore();

    // Пробуем получить из Blobs кэша
    const cachedStats = await store.get('vehicles:stats');
    if (cachedStats) {
      const stats = JSON.parse(cachedStats);
      // Проверяем, не устарел ли кэш (15 секунд вместо 5 минут)
      // Короткий TTL позволяет eventual consistency синхронизироваться
      const cacheAge = Date.now() - new Date(stats.cached_at).getTime();
      if (cacheAge < 15 * 1000) {
        // Обновляем локальный кэш
        this.statsCache = stats.data;
        this.statsCacheTime = now;
        return stats.data;
      }
    }

    // Пересчитываем статистику
    const vehicles = await this.getAllVehicles();

    const stats = {
      total: vehicles.length,
      allowed: vehicles.filter(v => v.access_status === 'allowed').length,
      denied: vehicles.filter(v => v.access_status === 'denied').length,
      permanent: vehicles.filter(v => v.pass_type === 'permanent').length,
      temporary: vehicles.filter(v => v.pass_type === 'temporary').length
    };

    // Сохраняем в Blobs кэш
    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш
    this.statsCache = stats;
    this.statsCacheTime = now;

    return stats;
  }

  /**
   * Обновить индекс номеров (приватный метод)
   */
  async _updateIndex(plateNumber, action) {
    const store = this._getStore();

    // Получаем текущий индекс
    const indexData = await store.get('vehicles:index');
    let allPlates = indexData ? JSON.parse(indexData) : [];

    if (action === 'add') {
      // Добавляем номер, если его еще нет
      if (!allPlates.includes(plateNumber)) {
        allPlates.push(plateNumber);
      }
    } else if (action === 'remove') {
      // Удаляем номер
      allPlates = allPlates.filter(plate => plate !== plateNumber);
    }

    // Сохраняем обновленный индекс
    await store.set('vehicles:index', JSON.stringify(allPlates));

    // Обновляем локальный кэш
    this.indexCache = allPlates;
    this.indexCacheTime = Date.now();
  }

  /**
   * Инвалидировать кэш статистики (приватный метод)
   */
  async _invalidateStatsCache() {
    const store = this._getStore();
    await store.delete('vehicles:stats');
  }

  /**
   * Пересчитать и сохранить статистику (приватный метод)
   */
  async _recalculateStats() {
    const store = this._getStore();

    // Получаем индекс
    const indexData = await store.get('vehicles:index');
    const allPlates = indexData ? JSON.parse(indexData) : [];

    // Загружаем все автомобили
    const allVehicles = [];
    for (const plate of allPlates) {
      const vehicleData = await store.get(`vehicle:${plate}`);
      if (vehicleData) {
        allVehicles.push(JSON.parse(vehicleData));
      }
    }

    const stats = {
      total: allVehicles.length,
      allowed: allVehicles.filter(v => v.access_status === 'allowed').length,
      denied: allVehicles.filter(v => v.access_status === 'denied').length,
      permanent: allVehicles.filter(v => v.pass_type === 'permanent').length,
      temporary: allVehicles.filter(v => v.pass_type === 'temporary').length
    };

    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    // Обновляем локальный кэш статистики
    this.statsCache = stats;
    this.statsCacheTime = Date.now();
  }
}

module.exports = Database;
