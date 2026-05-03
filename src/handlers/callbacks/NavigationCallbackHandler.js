const VehicleFormatter = require('../../formatters/vehicleFormatter');
const CardFormatter = require('../../formatters/vehicle/cardFormatter');
const KeyboardBuilder = require('../../ui/keyboardBuilder');

/**
 * NavigationCallbackHandler - обработка навигационных callback'ов
 * Обрабатывает: nav_cancel
 */
class NavigationCallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать callback
   */
  canHandle(data) {
    return data.startsWith('nav_');
  }

  /**
   * Обработать callback
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data === 'nav_cancel') {
      await this.handleNavCancel(chatId, messageId, userId);
    }

    await this.telegram.answerCallback(callbackQuery.id);
  }

  /**
   * Обработать nav_cancel - отмена текущей операции
   */
  async handleNavCancel(chatId, messageId, userId) {
    const userState = await this.stateManager.getState(userId);

    // Если пользователь в процессе поиска, возвращаем к списку
    if (userState && userState.state === 'list_search') {
      await this.stateManager.clearState(userId);
      const paginationData = await this.vehicleService.getVehiclesList(1, 5);
      const stats = await this.vehicleService.getStatsRealtime();
      const listData = VehicleFormatter.formatInteractiveListWithStats(paginationData, stats);
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      return;
    }

    // Если пользователь в процессе редактирования, возвращаем к меню настроек
    if (userState && userState.state) {
      const editStates = ['edit_vehicle_plate', 'edit_vehicle_brand', 'edit_vehicle_pass_type', 'edit_vehicle_notes'];

      if (editStates.includes(userState.state)) {
        const plateNumber = userState.data.plate_number || userState.data.old_plate;

        if (plateNumber) {
          await this.stateManager.clearState(userId);
          const vehicle = await this.vehicleService.findVehicle(plateNumber);

          if (vehicle) {
            const editData = CardFormatter.formatEditMenu(vehicle);
            await this.telegram.edit(chatId, messageId, editData.text, editData.keyboard);
            return;
          }
        }
      }
    }

    // В остальных случаях возвращаем в главное меню
    await this.stateManager.clearState(userId);
    const PlateValidator = require('../../validators/plateValidator');
    const isAdmin = PlateValidator.isAdmin(userId);
    const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
    await this.telegram.edit(chatId, messageId, 'Главное меню', keyboard);
  }
}

module.exports = NavigationCallbackHandler;
