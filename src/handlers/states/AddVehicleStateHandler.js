const PlateValidator = require('../../validators/plateValidator');
const KeyboardBuilder = require('../../ui/keyboardBuilder');
const CardFormatter = require('../../formatters/vehicle/cardFormatter');

/**
 * AddVehicleStateHandler - обработка состояний добавления автомобиля
 *
 * НОВАЯ АРХИТЕКТУРА: Данные передаются через callback_data и хранятся в ключе состояния,
 * а не в Netlify Blobs. Это решает проблему eventual consistency.
 *
 * Шаги:
 * 1. plate -> кнопка "Продолжить" с данными
 * 2. brand -> кнопки выбора типа с данными
 * 3. pass_type -> состояние с данными в ключе
 * 4. expiry (для временных) -> состояние с данными в ключе
 * 5. notes -> сохранение в БД
 */
class AddVehicleStateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать состояние
   */
  canHandle(state) {
    return state.startsWith('add_vehicle_') ||
           state.startsWith('awaiting_brand:') ||
           state.startsWith('awaiting_expiry:') ||
           state.startsWith('awaiting_notes:');
  }

  /**
   * Обработать сообщение в зависимости от состояния
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';
    const state = userState.state;

    if (state === 'add_vehicle_plate') {
      await this.handlePlate(chatId, userId, text);
    } else if (state.startsWith('awaiting_brand:')) {
      await this.handleBrand(chatId, userId, text, userState);
    } else if (state.startsWith('awaiting_expiry:')) {
      await this.handleExpiry(chatId, userId, text, userState);
    } else if (state.startsWith('awaiting_notes:')) {
      await this.handleNotes(chatId, userId, text, userState);
    }
  }

  /**
   * Шаг 1: Обработка номера автомобиля
   */
  async handlePlate(chatId, userId, text) {
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

    // Кодируем данные и отправляем кнопку "Продолжить"
    const data = { plate_number: plateNumber };
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64');
    const keyboard = {
      inline_keyboard: [
        [
          { text: '➡️ Продолжить', callback_data: `continue_add:${encoded}` }
        ],
        [
          { text: '❌ Отмена', callback_data: 'nav_cancel' }
        ]
      ]
    };

    await this.telegram.send(chatId, `✅ Номер принят: <b>${plateNumber}</b>\n\nНажмите "Продолжить" для ввода марки:`, keyboard);

    // Очищаем состояние - данные теперь в callback кнопки
    await this.stateManager.clearState(userId);
  }

  /**
   * Шаг 2: Обработка марки автомобиля
   */
  async handleBrand(chatId, userId, text, userState) {
    // Извлекаем данные из ключа состояния
    const stateData = this.stateManager.extractDataFromState(userState.state);

    if (!stateData || !stateData.plate_number) {
      await this.telegram.send(chatId, '❌ Ошибка: данные потеряны. Начните заново с /add');
      await this.stateManager.clearState(userId);
      return;
    }

    const brand = text.trim();

    // Отправляем кнопки выбора типа пропуска с данными
    const keyboard = KeyboardBuilder.buildPassTypeButtons(stateData.plate_number, brand);
    await this.telegram.send(chatId, '📋 Выберите тип пропуска:', keyboard);

    // Очищаем состояние - данные теперь в callback кнопок
    await this.stateManager.clearState(userId);
  }

  /**
   * Шаг 4: Обработка даты окончания (для временных пропусков)
   */
  async handleExpiry(chatId, userId, text, userState) {
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

    // Извлекаем данные из ключа состояния
    const stateData = this.stateManager.extractDataFromState(userState.state);

    if (!stateData || !stateData.plate_number) {
      await this.telegram.send(chatId, '❌ Ошибка: данные потеряны. Начните заново с /add');
      await this.stateManager.clearState(userId);
      return;
    }

    // Добавляем дату к данным
    const newData = {
      ...stateData,
      expiry_date: expiryDate
    };

    // Устанавливаем состояние ожидания заметок с данными в ключе
    await this.stateManager.setStateWithData(userId, 'awaiting_notes', newData);

    const keyboard = KeyboardBuilder.buildNavigationButtons(true);
    await this.telegram.send(chatId, `✅ Дата окончания: <b>${expiryDate}</b>\n\nВведите дополнительные заметки или '-' чтобы пропустить:`, keyboard);
  }

  /**
   * Шаг 5: Обработка заметок (финальный шаг)
   */
  async handleNotes(chatId, userId, text, userState) {
    const notes = text === '-' ? '' : text.trim();

    // Извлекаем данные из ключа состояния
    const stateData = this.stateManager.extractDataFromState(userState.state);

    if (!stateData || !stateData.plate_number) {
      await this.telegram.send(chatId, '❌ Ошибка: данные потеряны. Начните заново с /add');
      await this.stateManager.clearState(userId);
      return;
    }

    // Сохраняем автомобиль в БД
    const result = await this.vehicleService.addVehicle(
      stateData.plate_number,
      stateData.brand,
      stateData.access_status,
      stateData.pass_type,
      stateData.expiry_date || null,
      notes
    );

    if (result) {
      // Получаем добавленный автомобиль и отправляем полную карточку
      const vehicle = await this.vehicleService.findVehicle(stateData.plate_number);

      if (vehicle) {
        const cardData = CardFormatter.formatCard(vehicle, 'list_back', true);
        await this.telegram.send(chatId, '✅ <b>Автомобиль успешно добавлен!</b>\n\n' + cardData.text, cardData.keyboard);
      } else {
        await this.telegram.send(chatId, `✅ Автомобиль ${stateData.plate_number} успешно добавлен!`);
      }
    } else {
      await this.telegram.send(chatId, '❌ Ошибка при добавлении автомобиля');
    }

    await this.stateManager.clearState(userId);
  }
}

module.exports = AddVehicleStateHandler;
