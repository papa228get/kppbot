const PlateValidator = require('../../validators/plateValidator');
const CardFormatter = require('../../formatters/vehicle/cardFormatter');

/**
 * EditVehicleStateHandler - обработка состояний редактирования автомобиля
 * Обрабатывает: edit_vehicle_plate, edit_vehicle_brand, edit_vehicle_pass_type, edit_vehicle_notes
 */
class EditVehicleStateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать состояние
   */
  canHandle(state) {
    return state.startsWith('edit_vehicle_');
  }

  /**
   * Обработать сообщение в зависимости от состояния
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';
    const state = userState.state;

    if (state === 'edit_vehicle_plate') {
      await this.handleEditPlate(chatId, userId, text, userState);
    } else if (state === 'edit_vehicle_brand') {
      await this.handleEditBrand(chatId, userId, text, userState);
    } else if (state === 'edit_vehicle_pass_type') {
      await this.handleEditPassType(chatId, userId, text, userState);
    } else if (state === 'edit_vehicle_notes') {
      await this.handleEditNotes(chatId, userId, text, userState);
    }
  }

  /**
   * Обработка изменения номера
   */
  async handleEditPlate(chatId, userId, text, userState) {
    const newPlate = PlateValidator.normalize(text);

    if (!newPlate) {
      await this.telegram.send(chatId, '❌ Некорректный номер. Попробуйте еще раз:');
      return;
    }

    const oldPlate = userState.data.old_plate;

    // Проверяем, не существует ли уже автомобиль с таким номером
    const existing = await this.vehicleService.findVehicle(newPlate);
    if (existing && existing.plate_number !== oldPlate) {
      await this.telegram.send(chatId, `⚠️ Автомобиль с номером ${newPlate} уже существует в базе.\n\nОперация отменена.`);
      await this.stateManager.clearState(userId);
      return;
    }

    const result = await this.vehicleService.updateVehicle(oldPlate, 'plate_number', newPlate);

    if (result && typeof result === 'object') {
      // Получаем обновленные данные и отправляем карточку
      const updatedVehicle = await this.vehicleService.findVehicle(newPlate);
      const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

      let successText = '✅ <b>Гос-номер изменен</b>\n\n';
      successText += `Старый номер: <b>${oldPlate}</b>\n`;
      successText += `Новый номер: <b>${newPlate}</b>\n\n`;
      successText += 'Обновленная карточка автомобиля:';

      await this.telegram.send(chatId, successText);
      await this.telegram.send(chatId, cardData.text, cardData.keyboard);
    } else {
      await this.telegram.send(chatId, '❌ Ошибка при изменении номера');
    }

    await this.stateManager.clearState(userId);
  }

  /**
   * Обработка изменения марки
   */
  async handleEditBrand(chatId, userId, text, userState) {
    const newBrand = text === '-' ? '' : text.trim();
    const plateNumber = userState.data.plate_number;

    const updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'brand', newBrand);

    if (updatedVehicle && typeof updatedVehicle === 'object') {
      const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

      const brandText = newBrand || 'не указана';
      let successText = '✅ <b>Марка изменена</b>\n\n';
      successText += `Новая марка: <b>${brandText}</b>\n\n`;
      successText += cardData.text;

      await this.telegram.send(chatId, successText, cardData.keyboard);
    } else {
      await this.telegram.send(chatId, '❌ Ошибка при изменении марки');
    }

    await this.stateManager.clearState(userId);
  }

  /**
   * Обработка изменения типа пропуска (дата для временного)
   */
  async handleEditPassType(chatId, userId, text, userState) {
    const expiryDate = text.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      await this.telegram.send(chatId, '❌ Неверный формат даты. Используйте формат ГГГГ-ММ-ДД (например: 2026-12-31):');
      return;
    }

    const plateNumber = userState.data.plate_number;
    const newType = userState.data.new_type;

    // Обновляем тип пропуска
    let updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'pass_type', newType);
    // Обновляем дату
    updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'expiry_date', expiryDate);

    const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

    let successText = '✅ <b>Тип пропуска изменен</b>\n\n';
    successText += 'Новый тип: <b>⏳ Временный</b>\n';
    successText += `Действует до: <b>${expiryDate}</b>\n\n`;
    successText += cardData.text;

    await this.telegram.send(chatId, successText, cardData.keyboard);

    await this.stateManager.clearState(userId);
  }

  /**
   * Обработка изменения заметок
   */
  async handleEditNotes(chatId, userId, text, userState) {
    const newNotes = text === '-' ? '' : text.trim();
    const plateNumber = userState.data.plate_number;

    const updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'notes', newNotes);

    if (updatedVehicle && typeof updatedVehicle === 'object') {
      const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

      const notesText = newNotes || 'не указаны';
      let successText = '✅ <b>Заметка изменена</b>\n\n';
      successText += `Новая заметка: <b>${notesText}</b>\n\n`;
      successText += cardData.text;

      await this.telegram.send(chatId, successText, cardData.keyboard);
    } else {
      await this.telegram.send(chatId, '❌ Ошибка при изменении заметки');
    }

    await this.stateManager.clearState(userId);
  }
}

module.exports = EditVehicleStateHandler;
