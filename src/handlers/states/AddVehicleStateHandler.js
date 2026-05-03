const PlateValidator = require('../../validators/plateValidator');
const KeyboardBuilder = require('../../ui/keyboardBuilder');
const CardFormatter = require('../../formatters/vehicle/cardFormatter');

/**
 * AddVehicleStateHandler - обработка состояний добавления автомобиля
 * Обрабатывает 5 шагов: plate -> brand -> pass_type -> expiry (для временных) -> notes
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
    return state.startsWith('add_vehicle_');
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
    } else if (state === 'add_vehicle_brand') {
      await this.handleBrand(chatId, userId, text, userState);
    } else if (state === 'add_vehicle_pass_type') {
      // Этот шаг обрабатывается через callback
    } else if (state === 'add_vehicle_expiry') {
      await this.handleExpiry(chatId, userId, text, userState);
    } else if (state === 'add_vehicle_notes') {
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

    await this.stateManager.setState(userId, 'add_vehicle_brand', { plate_number: plateNumber });
    const keyboard = KeyboardBuilder.buildNavigationButtons(true);
    await this.telegram.send(chatId, '🏷 Введите марку автомобиля:', keyboard);
  }

  /**
   * Шаг 2: Обработка марки автомобиля
   */
  async handleBrand(chatId, userId, text, userState) {
    // Накапливаем данные локально вместо updateStateData
    const updatedData = {
      ...userState.data,
      brand: text,
      access_status: 'allowed'
    };
    await this.stateManager.setState(userId, 'add_vehicle_pass_type', updatedData);

    const keyboard = KeyboardBuilder.buildPassTypeButtons();
    await this.telegram.send(chatId, '📋 Выберите тип пропуска:', keyboard);
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

    // Накапливаем данные локально вместо updateStateData
    const updatedData = {
      ...userState.data,
      expiry_date: expiryDate
    };
    await this.stateManager.setState(userId, 'add_vehicle_notes', updatedData);

    const keyboard = KeyboardBuilder.buildNavigationButtons(true);
    await this.telegram.send(chatId, `✅ Дата окончания: <b>${expiryDate}</b>\n\nВведите дополнительные заметки или '-' чтобы пропустить:`, keyboard);
  }

  /**
   * Шаг 5: Обработка заметок (финальный шаг)
   */
  async handleNotes(chatId, userId, text, userState) {
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
        const cardData = CardFormatter.formatCard(vehicle, 'list_back', true);
        await this.telegram.send(chatId, cardData.text, cardData.keyboard);
      } else {
        await this.telegram.send(chatId, `✅ Автомобиль ${data.plate_number} успешно добавлен!`);
      }
    } else {
      await this.telegram.send(chatId, '❌ Ошибка при добавлении автомобиля');
    }

    await this.stateManager.clearState(userId);
  }
}

module.exports = AddVehicleStateHandler;
