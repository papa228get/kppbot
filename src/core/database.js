/**
 * Database класс для работы с Netlify Blobs
 * Заменяет SQLite из PHP версии
 */
class Database {
  constructor(getStore) {
    this.getStore = getStore;
    this.storeName = 'kppbot';
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Добавить автомобиль
   */
  async addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    const store = this._getStore();

    // Проверяем существование
    const existing = await this.findVehicle(plateNumber);
    if (existing) {
      return false;
    }

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

    // Обновляем индекс
    await this._updateIndex(plateNumber, 'add');

    // Инвалидируем кэш статистики
    await this._invalidateStatsCache();

    return true;
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

    // Получаем индекс
    const indexData = await store.get('vehicles:index');
    const allPlates = indexData ? JSON.parse(indexData) : [];

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

    // Инвалидируем кэш статистики
    await this._invalidateStatsCache();

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

    return true;
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
   * Получить статистику
   */
  async getStats() {
    const store = this._getStore();

    // Пробуем получить из кэша
    const cachedStats = await store.get('vehicles:stats');
    if (cachedStats) {
      const stats = JSON.parse(cachedStats);
      // Проверяем, не устарел ли кэш (5 минут)
      const cacheAge = Date.now() - new Date(stats.cached_at).getTime();
      if (cacheAge < 5 * 60 * 1000) {
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

    // Сохраняем в кэш
    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

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
  }

  /**
   * Инвалидировать кэш статистики (приватный метод)
   */
  async _invalidateStatsCache() {
    const store = this._getStore();
    await store.delete('vehicles:stats');
  }
}

module.exports = Database;
