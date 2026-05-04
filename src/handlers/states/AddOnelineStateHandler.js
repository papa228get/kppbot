const KeyboardBuilder = require('../../ui/keyboardBuilder');
const VehicleFormatter = require('../../formatters/vehicleFormatter');

/**
 * AddOnelineStateHandler - обработка добавления автомобиля одной строкой
 * Формат: Номер Марка Тип [Дата]
 */
class AddOnelineStateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать состояние
   */
  canHandle(state) {
    return state === 'awaiting_add_oneline';
  }

  /**
   * Обработать сообщение
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    const parts = text.split(/\s+/).filter(p => p.length > 0);

    if (parts.length < 3) {
      await this.telegram.send(chatId, '❌ Недостаточно данных\n\nФормат: <code>Номер Марка Тип [Дата]</code>\n\nПример: <code>А123БВ Лада Постоянный</code>');
      return;
    }

    // Парсим данные
    const plateNumber = parts[0];
    const brand = parts[1];
    const passTypeRaw = parts[2];
    const expiryDateRaw = parts[3] || null;

    // Определяем тип пропуска
    let passType = 'permanent';
    if (passTypeRaw.toLowerCase().includes('врем') || passTypeRaw.toLowerCase() === 'temporary') {
      passType = 'temporary';
    }

    // Парсим дату для временных
    let expiryDate = null;
    if (passType === 'temporary') {
      if (!expiryDateRaw) {
        await this.telegram.send(chatId, '❌ Для временного пропуска укажите дату окончания\n\nПример: <code>В456ГД КИА Временный 31.12.2026</code>');
        return;
      }

      const dateMatch = expiryDateRaw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!dateMatch) {
        await this.telegram.send(chatId, '❌ Некорректный формат даты. Используйте ДД.ММ.ГГГГ\n\nПример: 31.12.2026');
        return;
      }

      const day = dateMatch[1];
      const month = dateMatch[2];
      const year = dateMatch[3];
      expiryDate = `${year}-${month}-${day}`;
    }

    // Добавляем автомобиль
    try {
      const result = await this.vehicleService.addVehicleWithCheck(
        plateNumber,
        brand,
        'allowed',
        passType,
        expiryDate,
        ''
      );

      if (result.success) {
        // Успешно добавлено - показываем карточку
        const vehicle = result.vehicle;
        const cardData = VehicleFormatter.formatCard(vehicle, 'menu_back', true);
        await this.telegram.send(
          chatId,
          '✅ <b>Автомобиль успешно добавлен!</b>\n\n' + cardData.text,
          cardData.keyboard
        );
      } else if (result.error === 'duplicate') {
        // Дубликат - показываем ошибку с кнопкой "Главное меню"
        const PlateValidator = require('../../validators/plateValidator');
        const isAdmin = PlateValidator.isAdmin(userId);
        const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
        await this.telegram.send(
          chatId,
          '❌ <b>Ошибка добавления</b>\n\nАвтомобиль с таким номером уже существует в базе данных.',
          keyboard
        );
      } else {
        // Другая ошибка - показываем с кнопкой "Главное меню"
        const PlateValidator = require('../../validators/plateValidator');
        const isAdmin = PlateValidator.isAdmin(userId);
        const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
        await this.telegram.send(
          chatId,
          '❌ <b>Ошибка добавления</b>\n\nПроизошла ошибка при добавлении автомобиля. Попробуйте еще раз.',
          keyboard
        );
      }
    } catch (error) {
      console.error('Error in AddOnelineStateHandler:', error);
      const PlateValidator = require('../../validators/plateValidator');
      const isAdmin = PlateValidator.isAdmin(userId);
      const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
      await this.telegram.send(
        chatId,
        '❌ <b>Ошибка добавления</b>\n\nПроизошла техническая ошибка. Попробуйте позже.',
        keyboard
      );
    }

    // Очищаем состояние
    await this.stateManager.clearState(userId);
  }
}

module.exports = AddOnelineStateHandler;
