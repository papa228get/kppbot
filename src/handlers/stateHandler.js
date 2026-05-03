const KeyboardBuilder = require('../ui/keyboardBuilder');
const PlateValidator = require('../validators/plateValidator');

/**
 * StateHandler - обработка состояний пользователей
 * Управляет многошаговыми диалогами
 */
class StateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
    this.documentHandler = null;
  }

  /**
   * Установить DocumentHandler (для обработки импорта файлов)
   */
  setDocumentHandler(documentHandler) {
    this.documentHandler = documentHandler;
  }

  /**
   * Обработать сообщение в зависимости от состояния
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';
    const state = userState.state;

    // Обработка импорта файла
    if (state === 'awaiting_import_file') {
      if (message.document) {
        const isAdmin = PlateValidator.isAdmin(userId);
        await this.documentHandler.handleDocument(message, isAdmin);
        await this.stateManager.clearState(userId);
      } else {
        await this.telegram.send(chatId, '❌ Пожалуйста, отправьте файл');
      }
      return;
    }

    // Обработка добавления автомобиля - шаг 1: номер
    if (state === 'add_vehicle_plate') {
      const plateNumber = PlateValidator.normalize(text);

      if (!plateNumber) {
        await this.telegram.send(chatId, '❌ Некорректный номер. Попробуйте еще раз:');
        return;
      }

      // Проверяем, не существует ли уже
      const existing = await this.vehicleService.findVehicle(plateNumber);
      if (existing) {
        await this.telegram.send(chatId, '❌ Автомобиль с таким номером уже существует');
        await this.stateManager.clearState(userId);
        return;
      }

      await this.stateManager.setState(userId, 'add_vehicle_brand', { plate_number: plateNumber });
      const keyboard = KeyboardBuilder.buildNavigationButtons(true);
      await this.telegram.send(chatId, '🏷 Введите марку автомобиля:', keyboard);
      return;
    }

    // Обработка добавления автомобиля - шаг 2: марка
    if (state === 'add_vehicle_brand') {
      await this.stateManager.updateStateData(userId, 'brand', text);
      // Автоматически устанавливаем статус "allowed" для всех новых авто
      await this.stateManager.updateStateData(userId, 'access_status', 'allowed');
      await this.stateManager.setState(userId, 'add_vehicle_pass_type', userState.data);

      const keyboard = KeyboardBuilder.buildPassTypeButtons();
      await this.telegram.send(chatId, '📋 Выберите тип пропуска:', keyboard);
      return;
    }

    // Обработка добавления автомобиля - шаг 3: тип пропуска (обрабатывается через callback)
    if (state === 'add_vehicle_pass_type') {
      // Этот шаг обрабатывается через callback
      return;
    }

    // Обработка добавления автомобиля - шаг 4: дата окончания (для временных)
    if (state === 'add_vehicle_expiry') {
      const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = text.match(dateRegex);

      if (!match) {
        await this.telegram.send(chatId, '❌ Некорректный формат даты. Используйте ДД.ММ.ГГГГ (например: 31.12.2026):');
        return;
      }

      const day = match[1];
      const month = match[2];
      const year = match[3];
      const expiryDate = `${year}-${month}-${day}`;

      await this.stateManager.updateStateData(userId, 'expiry_date', expiryDate);
      await this.stateManager.setState(userId, 'add_vehicle_notes', userState.data);

      const keyboard = KeyboardBuilder.buildNavigationButtons(true);
      await this.telegram.send(chatId, `✅ Дата окончания: <b>${expiryDate}</b>\n\nВведите дополнительные заметки или '-' чтобы пропустить:`, keyboard);
      return;
    }

    // Обработка добавления автомобиля - шаг 5: заметки
    if (state === 'add_vehicle_notes') {
      const notes = text === '-' ? '' : text;

      const data = userState.data;
      const result = await this.vehicleService.addVehicle(
        data.plate_number,
        data.brand,
        data.access_status,
        data.pass_type,
        data.expiry_date || null,
        notes
      );

      if (result) {
        // Получаем добавленный автомобиль и отправляем полную карточку
        const vehicle = await this.vehicleService.findVehicle(data.plate_number);

        if (vehicle) {
          const CardFormatter = require('../formatters/vehicle/cardFormatter');
          const cardData = CardFormatter.formatCard(vehicle, 'list_back', true);

          // Отправляем только карточку с кнопками
          await this.telegram.send(chatId, cardData.text, cardData.keyboard);
        } else {
          await this.telegram.send(chatId, `✅ Автомобиль ${data.plate_number} успешно добавлен!`);
        }
      } else {
        await this.telegram.send(chatId, '❌ Ошибка при добавлении автомобиля');
      }

      await this.stateManager.clearState(userId);
      return;
    }

    // Обработка редактирования автомобиля - шаг 1: изменение номера
    if (state === 'edit_vehicle_plate') {
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

      const result = await this.vehicleService.updateVehiclePlate(oldPlate, newPlate);

      if (result) {
        // Получаем обновленные данные и отправляем карточку
        const updatedVehicle = await this.vehicleService.findVehicle(newPlate);
        const CardFormatter = require('../formatters/vehicle/cardFormatter');
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
      return;
    }

    // Обработка редактирования автомобиля - шаг 2: изменение марки
    if (state === 'edit_vehicle_brand') {
      const newBrand = text === '-' ? '' : text.trim();
      const plateNumber = userState.data.plate_number;

      const result = await this.vehicleService.updateVehicle(plateNumber, 'brand', newBrand);

      if (result) {
        // Получаем обновленные данные
        const updatedVehicle = await this.vehicleService.findVehicle(plateNumber);
        const CardFormatter = require('../formatters/vehicle/cardFormatter');
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
      return;
    }

    // Обработка редактирования автомобиля - шаг 3: изменение типа пропуска (дата для временного)
    if (state === 'edit_vehicle_pass_type') {
      const expiryDate = text.trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        await this.telegram.send(chatId, '❌ Неверный формат даты. Используйте формат ГГГГ-ММ-ДД (например: 2026-12-31):');
        return;
      }

      const plateNumber = userState.data.plate_number;
      const newType = userState.data.new_type;

      // Обновляем тип пропуска и дату
      await this.vehicleService.updateVehicle(plateNumber, 'pass_type', newType);
      await this.vehicleService.updateVehicle(plateNumber, 'expiry_date', expiryDate);

      // Получаем обновленные данные
      const updatedVehicle = await this.vehicleService.findVehicle(plateNumber);
      const CardFormatter = require('../formatters/vehicle/cardFormatter');
      const cardData = CardFormatter.formatCard(updatedVehicle, 'list_back', true);

      let successText = '✅ <b>Тип пропуска изменен</b>\n\n';
      successText += 'Новый тип: <b>⏳ Временный</b>\n';
      successText += `Действует до: <b>${expiryDate}</b>\n\n`;
      successText += cardData.text;

      await this.telegram.send(chatId, successText, cardData.keyboard);

      await this.stateManager.clearState(userId);
      return;
    }

    // Обработка редактирования автомобиля - шаг 4: изменение заметок
    if (state === 'edit_vehicle_notes') {
      const newNotes = text === '-' ? '' : text.trim();
      const plateNumber = userState.data.plate_number;

      const result = await this.vehicleService.updateVehicle(plateNumber, 'notes', newNotes);

      if (result) {
        // Получаем обновленные данные
        const updatedVehicle = await this.vehicleService.findVehicle(plateNumber);
        const CardFormatter = require('../formatters/vehicle/cardFormatter');
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
      return;
    }
  }
}

module.exports = StateHandler;
