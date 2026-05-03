const VehicleFormatter = require('../formatters/vehicleFormatter');
const PlateValidator = require('../validators/plateValidator');

/**
 * MessageHandler - обработка текстовых сообщений
 */
class MessageHandler {
  constructor(telegram, accessChecker, stateManager) {
    this.telegram = telegram;
    this.accessChecker = accessChecker;
    this.stateManager = stateManager;
  }

  /**
   * Обработать номер автомобиля
   */
  async handlePlateNumber(chatId, userId, text) {
    const plateNumber = PlateValidator.normalize(text);

    if (!plateNumber) {
      await this.telegram.send(chatId, '❌ Пожалуйста, отправьте номер автомобиля');
      return;
    }

    const result = await this.accessChecker.checkAccess(plateNumber);

    // Если найдено несколько автомобилей
    if (result.multiple) {
      const searchData = VehicleFormatter.formatSearchResults(result.vehicles);
      // Сохраняем результаты поиска в состоянии для возврата
      await this.stateManager.setState(userId, 'search_results', { vehicles: result.vehicles });
      await this.telegram.send(chatId, searchData.text, searchData.keyboard);
    } else {
      const message = VehicleFormatter.formatAccessCheck(result);
      await this.telegram.send(chatId, message);
    }
  }
}

module.exports = MessageHandler;
