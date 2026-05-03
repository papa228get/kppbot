const VehicleFormatter = require('../../formatters/vehicleFormatter');
const KeyboardBuilder = require('../../ui/keyboardBuilder');

/**
 * ListCallbackHandler - обработка callback'ов списка
 * Обрабатывает: list_page, list_back, list_search, list_page_info, view_vehicle
 */
class ListCallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать callback
   */
  canHandle(data) {
    return data.startsWith('list_') || data.startsWith('view_vehicle:');
  }

  /**
   * Обработать callback
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data.startsWith('view_vehicle:')) {
      await this.handleViewVehicle(data, chatId, messageId, userId);
    } else if (data.startsWith('list_page:')) {
      await this.handleListPage(data, chatId, messageId);
    } else if (data === 'list_back') {
      await this.handleListBack(chatId, messageId);
    } else if (data === 'list_search') {
      await this.handleListSearch(chatId, messageId, userId);
    } else if (data === 'list_page_info') {
      // Просто игнорируем (это информационная кнопка с номером страницы)
    }

    await this.telegram.answerCallback(callbackQuery.id);
  }

  /**
   * Обработать view_vehicle - показать карточку автомобиля
   */
  async handleViewVehicle(data, chatId, messageId, userId) {
    const plateNumber = data.split(':')[1];
    const vehicle = await this.vehicleService.findVehicle(plateNumber);

    if (vehicle) {
      const PlateValidator = require('../../validators/plateValidator');
      const isAdmin = PlateValidator.isAdmin(userId);
      const cardData = VehicleFormatter.formatCard(vehicle, 'list_back', isAdmin);
      await this.telegram.edit(chatId, messageId, cardData.text, cardData.keyboard);
    }
  }

  /**
   * Обработать list_page - переключение страницы списка
   */
  async handleListPage(data, chatId, messageId) {
    const page = parseInt(data.split(':')[1]);
    const paginationData = await this.vehicleService.getVehiclesList(page, 5);
    const listData = VehicleFormatter.formatInteractiveList(paginationData);
    // Добавляем кнопку "Назад" в главное меню
    if (listData.keyboard) {
      listData.keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_back' }]);
    }
    await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
  }

  /**
   * Обработать list_back - возврат к списку
   */
  async handleListBack(chatId, messageId) {
    const paginationData = await this.vehicleService.getVehiclesList(1, 5);
    const listData = VehicleFormatter.formatInteractiveList(paginationData);
    // Добавляем кнопку "Назад" в главное меню
    if (listData.keyboard) {
      listData.keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_back' }]);
    }
    await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
  }

  /**
   * Обработать list_search - начать поиск
   */
  async handleListSearch(chatId, messageId, userId) {
    await this.stateManager.setState(userId, 'list_search', {});
    const keyboard = KeyboardBuilder.buildNavigationButtons(false);
    await this.telegram.edit(chatId, messageId, '🔍 <b>Поиск автомобиля</b>\n\nУкажите гос.номер разыскиваемого авто:', keyboard);
  }
}

module.exports = ListCallbackHandler;
