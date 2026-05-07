const KeyboardBuilder = require('../../ui/keyboardBuilder');
const VehicleFormatter = require('../../formatters/vehicleFormatter');

/**
 * AddOnelineStateHandler - обработка добавления автомобиля одной строкой
 * Формат: Марка Номер Тип [Дата]
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
      await this.telegram.send(chatId, '❌ Недостаточно данных\n\nФормат: <code>Марка Номер Тип [Дата] [Комментарий]</code>\n\nПример: <code>Лада А123БВ Постоянный Директор</code>');
      return;
    }

    // Парсим данные
    const brand = parts[0];
    const plateNumber = parts[1];
    const passTypeRaw = parts[2];

    // Определяем тип пропуска
    let passType = 'permanent';
    if (passTypeRaw.toLowerCase().includes('врем') || passTypeRaw.toLowerCase() === 'temporary') {
      passType = 'temporary';
    }

    // Парсим дату и комментарий
    let expiryDate = null;
    let notes = '';

    if (passType === 'temporary') {
      // Для временного пропуска ищем дату в формате ДД.ММ.ГГГГ
      if (parts.length < 4) {
        await this.telegram.send(chatId, '❌ Для временного пропуска укажите дату окончания\n\nПример: <code>КИА В456ГД Временный 31.12.2026</code>');
        return;
      }

      const dateMatch = parts[3].match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!dateMatch) {
        await this.telegram.send(chatId, '❌ Некорректный формат даты. Используйте ДД.ММ.ГГГГ\n\nПример: 31.12.2026');
        return;
      }

      const day = dateMatch[1];
      const month = dateMatch[2];
      const year = dateMatch[3];
      expiryDate = `${year}-${month}-${day}`;

      // Все что после даты (с индекса 4) - это комментарий
      if (parts.length > 4) {
        notes = parts.slice(4).join(' ');
      }
    } else {
      // Для постоянного пропуска все что после типа (с индекса 3) - это комментарий
      if (parts.length > 3) {
        notes = parts.slice(3).join(' ');
      }
    }

    // Добавляем автомобиль
    try {
      const result = await this.vehicleService.addVehicleWithCheck(
        plateNumber,
        brand,
        'allowed',
        passType,
        expiryDate,
        notes
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
