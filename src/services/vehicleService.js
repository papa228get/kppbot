const PlateValidator = require('../validators/plateValidator');

/**
 * VehicleService - бизнес-логика работы с автомобилями
 * Обертка над Database с валидацией
 */
class VehicleService {
  constructor(db) {
    this.db = db;
  }

  async addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes, skipDuplicateCheck = false) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.addVehicle(normalizedPlate, brand, accessStatus, passType, expiryDate, notes, skipDuplicateCheck);
  }

  async removeVehicle(plateNumber) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.removeVehicle(normalizedPlate);
  }

  async findVehicle(plateNumber) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.findVehicle(normalizedPlate);
  }

  async searchVehicles(query) {
    const normalizedQuery = PlateValidator.normalize(query);
    return await this.db.findVehiclesByPartialPlate(normalizedQuery);
  }

  async getVehiclesList(page = 1, perPage = 5) {
    return await this.db.getVehiclesPaginated(page, perPage);
  }

  async getAllVehicles() {
    return await this.db.getAllVehicles();
  }

  async clearAllData() {
    return await this.db.clearAllData();
  }

  async wasDatabaseRecentlyCleared(withinMinutes = 2) {
    return await this.db.wasDatabaseRecentlyCleared(withinMinutes);
  }

  async getStats() {
    return await this.db.getStats();
  }

  async updateVehicleStatus(plateNumber, newStatus) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.updateVehicle(normalizedPlate, 'access_status', newStatus);
  }

  async updateVehicle(plateNumber, field, value) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.updateVehicle(normalizedPlate, field, value);
  }

  async updateVehiclePlate(oldPlate, newPlate) {
    const normalizedOldPlate = PlateValidator.normalize(oldPlate);
    const normalizedNewPlate = PlateValidator.normalize(newPlate);

    // Проверяем, не существует ли уже автомобиль с новым номером
    const existing = await this.db.findVehicle(normalizedNewPlate);
    if (existing) {
      return false;
    }

    return await this.db.updateVehicle(normalizedOldPlate, 'plate_number', normalizedNewPlate);
  }
}

module.exports = VehicleService;
