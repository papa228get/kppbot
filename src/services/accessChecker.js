const PlateValidator = require('../validators/plateValidator');

/**
 * AccessChecker - проверка доступа автомобилей
 */
class AccessChecker {
  constructor(db) {
    this.db = db;
  }

  /**
   * Проверить доступ автомобиля
   */
  async checkAccess(plateNumber) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    const vehicles = await this.db.findVehiclesByPartialPlate(normalizedPlate);

    if (vehicles.length === 0) {
      return {
        found: false,
        multiple: false,
        message: '❌ Автомобиль не найден в базе данных'
      };
    }

    // Если найдено несколько автомобилей
    if (vehicles.length > 1) {
      return {
        found: true,
        multiple: true,
        vehicles: vehicles,
        message: '🔍 Найдено несколько автомобилей. Выберите нужный:'
      };
    }

    // Если найден один автомобиль
    const vehicle = vehicles[0];

    // Проверка срока действия пропуска
    if (this.isExpired(vehicle)) {
      return {
        found: true,
        multiple: false,
        allowed: false,
        vehicle: vehicle,
        expired: true
      };
    }

    // Проверка статуса доступа
    const allowed = this.isAllowed(vehicle);

    return {
      found: true,
      multiple: false,
      allowed: allowed,
      vehicle: vehicle,
      expired: false
    };
  }

  /**
   * Проверить, истек ли срок действия пропуска
   */
  isExpired(vehicle) {
    if (vehicle.pass_type !== 'temporary' || !vehicle.expiry_date) {
      return false;
    }

    const expiryDate = new Date(vehicle.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  }

  /**
   * Проверить, разрешен ли доступ
   */
  isAllowed(vehicle) {
    return vehicle.access_status === 'allowed' && !this.isExpired(vehicle);
  }
}

module.exports = AccessChecker;
