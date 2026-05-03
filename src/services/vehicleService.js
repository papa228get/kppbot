const PlateValidator = require('../validators/plateValidator');

/**
 * VehicleService - бизнес-логика работы с автомобилями
 * Обертка над Database с валидацией
 */
class VehicleService {
  constructor(db) {
    this.db = db;
  }

  async addVehicle(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.addVehicle(normalizedPlate, brand, accessStatus, passType, expiryDate, notes);
  }

  async addVehiclesBatch(vehicles) {
    // Нормализуем номера во всех автомобилях
    const normalizedVehicles = vehicles.map(v => ({
      ...v,
      plate_number: PlateValidator.normalize(v.plate_number)
    }));
    return await this.db.addVehiclesBatch(normalizedVehicles);
  }

  async addVehicleWithCheck(plateNumber, brand, accessStatus, passType, expiryDate, notes) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.addVehicleWithCheck(normalizedPlate, brand, accessStatus, passType, expiryDate, notes);
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

  async getStats() {
    return await this.db.getStats();
  }

  async getStatsRealtime() {
    return await this.db.getStatsRealtime();
  }

  async updateVehicleStatus(plateNumber, newStatus) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.updateVehicle(normalizedPlate, 'access_status', newStatus);
  }

  async updateVehicle(plateNumber, field, value) {
    const normalizedPlate = PlateValidator.normalize(plateNumber);
    return await this.db.updateVehicle(normalizedPlate, field, value);
  }
}

module.exports = VehicleService;
