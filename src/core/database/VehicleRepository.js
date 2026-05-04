/**
 * VehicleRepository - CRUD операции с автомобилями
 * Базовые операции работы с данными в Netlify Blobs
 */
class VehicleRepository {
  constructor(getStore, indexManager, statsCalculator) {
    this.getStore = getStore;
    this.indexManager = indexManager;
    this.statsCalculator = statsCalculator;
    this.storeName = 'kppbot';
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Добавить автомобиль (обновляет индекс и инвалидирует кэш статистики)
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

    // Обновляем индекс
    await this.indexManager.addToIndex(plateNumber);

    // Инвалидируем кэш статистики
    await this.statsCalculator.invalidateStatsCache();

    return vehicle; // Возвращаем объект вместо true
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
    const currentIndex = await this.indexManager.getIndex();
    const platesSet = new Set(currentIndex);
    for (const vehicle of vehicles) {
      platesSet.add(vehicle.plate_number);
    }
    const newIndex = [...platesSet];
    await this.indexManager.rebuildIndex(newIndex);

    // Пересчитываем статистику по ВСЕМ автомобилям из нового индекса
    const allVehicles = [];
    for (const plate of newIndex) {
      const vehicleData = await store.get(`vehicle:${plate}`);
      if (vehicleData) {
        allVehicles.push(JSON.parse(vehicleData));
      }
    }

    await this.statsCalculator.recalculateStats(allVehicles);

    return vehicles.length;
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
    // Сначала пробуем точное совпадение
    const exactMatch = await this.findVehicle(plateNumber);
    if (exactMatch) {
      return [exactMatch];
    }

    // Получаем индекс всех номеров
    const allPlates = await this.indexManager.getIndex();

    // Фильтруем по началу номера
    const matches = allPlates.filter(plate => plate.startsWith(plateNumber));

    // Загружаем данные для каждого совпадения
    const vehicles = [];
    for (const plate of matches) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    // Инвертируем порядок - последние добавленные первыми
    return vehicles.reverse();
  }

  /**
   * Получить список автомобилей с пагинацией
   */
  async getVehiclesPaginated(page = 1, perPage = 5) {
    const allPlates = await this.indexManager.getIndex();
    // Инвертируем порядок - последние добавленные первыми
    const reversedPlates = [...allPlates].reverse();
    const total = reversedPlates.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;

    // Получаем номера для текущей страницы
    const pagePlates = reversedPlates.slice(offset, offset + perPage);

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
    const allPlates = await this.indexManager.getIndex();

    // Загружаем данные всех автомобилей
    const vehicles = [];
    for (const plate of allPlates) {
      const vehicle = await this.findVehicle(plate);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    // Инвертируем порядок - последние добавленные первыми
    return vehicles.reverse();
  }

  /**
   * Получить все автомобили напрямую из Blobs (без индекса)
   * Используется для гарантированно актуальных данных
   */
  async getAllVehiclesDirect() {
    const store = this._getStore();

    // Получаем список всех ключей с префиксом vehicle:
    // Добавляем случайный параметр для обхода кэша
    const { blobs } = await store.list({ prefix: 'vehicle:' });

    const vehicles = [];
    for (const blob of blobs) {
      const data = await store.get(blob.key);
      if (data) {
        try {
          vehicles.push(JSON.parse(data));
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
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
    await this.indexManager.removeFromIndex(plateNumber);

    // Пересчитываем статистику
    const allVehicles = await this.getAllVehicles();
    await this.statsCalculator.recalculateStats(allVehicles);

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
      await this.indexManager.removeFromIndex(plateNumber);

      // Создаем новую запись
      vehicle.plate_number = newPlateNumber;
      await store.set(`vehicle:${newPlateNumber}`, JSON.stringify(vehicle));
      await this.indexManager.addToIndex(newPlateNumber);
    } else {
      // Обновляем поле
      vehicle[field] = value;
      await store.set(`vehicle:${plateNumber}`, JSON.stringify(vehicle));
    }

    // Инвалидируем кэш статистики
    await this.statsCalculator.invalidateStatsCache();

    // Возвращаем обновлённый объект
    return vehicle;
  }

  /**
   * Полная очистка всех данных
   */
  async clearAllData() {
    const store = this._getStore();

    // Получаем список всех номеров из индекса
    const allPlates = await this.indexManager.getIndex();

    // Удаляем все записи автомобилей
    for (const plate of allPlates) {
      await store.delete(`vehicle:${plate}`);
    }

    // Очищаем индекс
    await this.indexManager.clearIndex();

    // Пересчитываем статистику (будет 0 по всем полям)
    await this.statsCalculator.recalculateStats([]);

    return true;
  }
}

module.exports = VehicleRepository;
