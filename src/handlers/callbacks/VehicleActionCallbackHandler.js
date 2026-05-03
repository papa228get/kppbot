const VehicleFormatter = require('../../formatters/vehicleFormatter');
const KeyboardBuilder = require('../../ui/keyboardBuilder');

/**
 * VehicleActionCallbackHandler - обработка действий с автомобилями
 * Обрабатывает: toggle_status, delete_vehicle, confirm_delete, pass_permanent, pass_temporary
 */
class VehicleActionCallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать callback
   */
  canHandle(data) {
    return data.startsWith('toggle_status:') ||
           data.startsWith('delete_vehicle:') ||
           data.startsWith('confirm_delete:') ||
           data === 'pass_permanent' ||
           data === 'pass_temporary';
  }

  /**
   * Обработать callback
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data.startsWith('toggle_status:')) {
      await this.handleToggleStatus(data, chatId, messageId, userId);
    } else if (data.startsWith('delete_vehicle:')) {
      await this.handleDeleteVehicle(data, chatId, messageId);
    } else if (data.startsWith('confirm_delete:')) {
      await this.handleConfirmDelete(data, chatId, messageId, callbackQuery.id);
      return; // Не вызываем answerCallback в конце, т.к. уже вызвали
    } else if (data === 'pass_permanent' || data === 'pass_temporary') {
      await this.handlePassType(data, chatId, userId);
    }

    await this.telegram.answerCallback(callbackQuery.id);
  }

  /**
   * Обработать toggle_status - переключение статуса доступа
   */
  async handleToggleStatus(data, chatId, messageId, userId) {
    const plateNumber = data.split(':')[1];
    const vehicle = await this.vehicleService.findVehicle(plateNumber);

    if (vehicle) {
      const newStatus = vehicle.access_status === 'allowed' ? 'denied' : 'allowed';
      const updatedVehicle = await this.vehicleService.updateVehicleStatus(plateNumber, newStatus);

      const PlateValidator = require('../../validators/plateValidator');
      const isAdmin = PlateValidator.isAdmin(userId);
      const cardData = VehicleFormatter.formatCard(updatedVehicle, 'list_back', isAdmin);
      await this.telegram.edit(chatId, messageId, cardData.text, cardData.keyboard);
    }
  }

  /**
   * Обработать delete_vehicle - запрос подтверждения удаления
   */
  async handleDeleteVehicle(data, chatId, messageId) {
    const plateNumber = data.split(':')[1];
    const vehicle = await this.vehicleService.findVehicle(plateNumber);

    if (!vehicle) {
      return;
    }

    const confirmKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить', callback_data: `confirm_delete:${plateNumber}` },
          { text: '❌ Отмена', callback_data: `view_vehicle:${plateNumber}` }
        ]
      ]
    };

    const confirmText = `⚠️ <b>Подтверждение удаления</b>\n\nВы действительно хотите удалить автомобиль?\n\n🚗 <b>${vehicle.plate_number}</b>\n🏷 ${vehicle.brand || 'Марка не указана'}`;

    await this.telegram.edit(chatId, messageId, confirmText, confirmKeyboard);
  }

  /**
   * Обработать confirm_delete - подтвержденное удаление
   */
  async handleConfirmDelete(data, chatId, messageId, callbackId) {
    const plateNumber = data.split(':')[1];
    await this.vehicleService.removeVehicle(plateNumber);

    await this.telegram.answerCallback(callbackId, '✅ Автомобиль удален', false);

    // Возвращаемся к обновленному списку
    const paginationData = await this.vehicleService.getVehiclesList(1, 5);
    const listData = VehicleFormatter.formatInteractiveList(paginationData);
    await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
  }

  /**
   * Обработать pass_permanent/pass_temporary - выбор типа пропуска при добавлении
   */
  async handlePassType(data, chatId, userId) {
    const userState = await this.stateManager.getState(userId);

    if (userState && userState.state === 'add_vehicle_pass_type') {
      const passType = data === 'pass_permanent' ? 'permanent' : 'temporary';
      await this.stateManager.updateStateData(userId, 'pass_type', passType);

      if (passType === 'permanent') {
        // Для постоянного пропуска сразу переходим к заметкам
        await this.stateManager.setState(userId, 'add_vehicle_notes', userState.data);
        const keyboard = KeyboardBuilder.buildNavigationButtons(true);
        await this.telegram.send(chatId, '📝 Введите заметки (или отправьте "-" чтобы пропустить):', keyboard);
      } else {
        // Для временного пропуска запрашиваем дату
        await this.stateManager.setState(userId, 'add_vehicle_expiry', userState.data);
        const keyboard = KeyboardBuilder.buildNavigationButtons(true);
        await this.telegram.send(chatId, '📅 Введите дату окончания пропуска в формате ДД.ММ.ГГГГ (например: 31.12.2026):', keyboard);
      }
    }
  }
}

module.exports = VehicleActionCallbackHandler;
