const VehicleFormatter = require('../../formatters/vehicleFormatter');
const KeyboardBuilder = require('../../ui/keyboardBuilder');

/**
 * SearchStateHandler - обработка поиска автомобилей из списка
 */
class SearchStateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать состояние
   */
  canHandle(state) {
    return state === 'list_search';
  }

  /**
   * Обработать сообщение с номером для поиска
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    if (!text.trim()) {
      await this.telegram.send(chatId, '❌ Введите номер автомобиля для поиска');
      return;
    }

    // Ищем автомобили
    const vehicles = await this.vehicleService.searchVehicles(text.trim());

    if (vehicles.length === 0) {
      // Ничего не найдено - возвращаем к списку
      const keyboard = KeyboardBuilder.buildNavigationButtons(false);
      await this.telegram.send(
        chatId,
        '❌ <b>Ничего не найдено</b>\n\nАвтомобили с таким номером не найдены в базе данных.',
        keyboard
      );
    } else if (vehicles.length === 1) {
      // Найден один автомобиль - показываем карточку
      const PlateValidator = require('../../validators/plateValidator');
      const isAdmin = PlateValidator.isAdmin(userId);
      const vehicle = vehicles[0];
      const cardData = VehicleFormatter.formatCard(vehicle, 'list_back', isAdmin);
      await this.telegram.send(chatId, cardData.text, cardData.keyboard);
    } else {
      // Найдено несколько - показываем список результатов
      const searchData = VehicleFormatter.formatSearchResults(vehicles);
      await this.telegram.send(chatId, searchData.text, searchData.keyboard);
    }

    // Очищаем состояние
    await this.stateManager.clearState(userId);
  }
}

module.exports = SearchStateHandler;
