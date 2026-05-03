const CardFormatter = require('../../formatters/vehicle/cardFormatter');
const KeyboardBuilder = require('../../ui/keyboardBuilder');

/**
 * VehicleEditCallbackHandler - обработка редактирования автомобилей
 * Обрабатывает: edit_vehicle, edit_field, set_pass_type
 */
class VehicleEditCallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать callback
   */
  canHandle(data) {
    return data.startsWith('edit_vehicle:') ||
           data.startsWith('edit_field:') ||
           data.startsWith('set_pass_type:');
  }

  /**
   * Обработать callback
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data.startsWith('edit_vehicle:')) {
      await this.handleEditVehicle(data, chatId, messageId);
    } else if (data.startsWith('edit_field:')) {
      await this.handleEditField(data, chatId, messageId, userId, callbackQuery.id);
      return; // Не вызываем answerCallback в конце для некоторых случаев
    } else if (data.startsWith('set_pass_type:')) {
      await this.handleSetPassType(data, chatId, messageId, userId);
    }

    await this.telegram.answerCallback(callbackQuery.id);
  }

  /**
   * Обработать edit_vehicle - показать меню настроек
   */
  async handleEditVehicle(data, chatId, messageId) {
    const plateNumber = data.split(':')[1];
    const vehicle = await this.vehicleService.findVehicle(plateNumber);

    if (vehicle) {
      const editMenuData = CardFormatter.formatEditMenu(vehicle);
      await this.telegram.edit(chatId, messageId, editMenuData.text, editMenuData.keyboard);
    }
  }

  /**
   * Обработать edit_field - выбор поля для редактирования
   */
  async handleEditField(data, chatId, messageId, userId, callbackId) {
    const parts = data.split(':');
    const field = parts[1];
    const plateNumber = parts[2];

    const vehicle = await this.vehicleService.findVehicle(plateNumber);
    if (!vehicle) {
      await this.telegram.answerCallback(callbackId, '❌ Автомобиль не найден', true);
      return;
    }

    let promptText = '';
    let newState = '';

    switch (field) {
      case 'plate':
        promptText = `🚗 <b>Изменение гос-номера</b>\n\nТекущий номер: <b>${vehicle.plate_number}</b>\n\nВведите новый номер:`;
        newState = 'edit_vehicle_plate';
        await this.stateManager.setState(userId, newState, { old_plate: vehicle.plate_number });
        break;

      case 'brand':
        promptText = `🏷 <b>Изменение марки</b>\n\nТекущая марка: <b>${vehicle.brand || 'не указана'}</b>\n\nВведите новую марку (или '-' чтобы очистить):`;
        newState = 'edit_vehicle_brand';
        await this.stateManager.setState(userId, newState, { plate_number: vehicle.plate_number });
        break;

      case 'pass_type':
        promptText = `📋 <b>Изменение типа пропуска</b>\n\nТекущий тип: <b>${vehicle.pass_type === 'permanent' ? '🔄 Постоянный' : '⏳ Временный'}</b>\n\nВыберите новый тип:`;
        newState = 'edit_vehicle_pass_type_select';
        await this.stateManager.setState(userId, newState, { plate_number: vehicle.plate_number });

        const passTypeKeyboard = {
          inline_keyboard: [
            [
              { text: '🔄 Постоянный', callback_data: `set_pass_type:permanent:${vehicle.plate_number}` },
              { text: '⏳ Временный', callback_data: `set_pass_type:temporary:${vehicle.plate_number}` }
            ],
            [
              { text: '❌ Отмена', callback_data: `edit_vehicle:${vehicle.plate_number}` }
            ]
          ]
        };
        await this.telegram.send(chatId, promptText, passTypeKeyboard);
        await this.telegram.answerCallback(callbackId);
        return;

      case 'notes':
        promptText = `📝 <b>Изменение заметки</b>\n\nТекущая заметка: <b>${vehicle.notes || 'не указана'}</b>\n\nВведите новую заметку (или '-' чтобы очистить):`;
        newState = 'edit_vehicle_notes';
        await this.stateManager.setState(userId, newState, { plate_number: vehicle.plate_number });
        break;
    }

    if (field !== 'pass_type') {
      const keyboard = KeyboardBuilder.buildEditNavigationButtons(vehicle.plate_number);
      await this.telegram.send(chatId, promptText, keyboard);
    }

    await this.telegram.answerCallback(callbackId);
  }

  /**
   * Обработать set_pass_type - установка типа пропуска
   */
  async handleSetPassType(data, chatId, messageId, userId) {
    const parts = data.split(':');
    const newType = parts[1];
    const plateNumber = parts[2];

    const vehicle = await this.vehicleService.findVehicle(plateNumber);
    if (!vehicle) {
      return;
    }

    if (newType === 'permanent') {
      // Для постоянного пропуска сразу обновляем
      let updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'pass_type', 'permanent');
      updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'expiry_date', null);

      const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

      let successText = '✅ <b>Тип пропуска изменен</b>\n\n';
      successText += 'Новый тип: <b>🔄 Постоянный</b>\n\n';
      successText += cardData.text;

      await this.telegram.send(chatId, successText, cardData.keyboard);
      await this.stateManager.clearState(userId);
    } else {
      // Для временного пропуска запрашиваем дату
      await this.stateManager.setState(userId, 'edit_vehicle_pass_type', {
        plate_number: plateNumber,
        new_type: 'temporary'
      });
      const keyboard = KeyboardBuilder.buildEditNavigationButtons(plateNumber);
      await this.telegram.send(chatId, '📅 Введите дату окончания пропуска в формате ГГГГ-ММ-ДД (например: 2026-12-31):', keyboard);
    }
  }
}

module.exports = VehicleEditCallbackHandler;
