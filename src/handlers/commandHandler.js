const KeyboardBuilder = require('../ui/keyboardBuilder');
const MenuFormatter = require('../formatters/menuFormatter');
const StatsFormatter = require('../formatters/statsFormatter');
const VehicleFormatter = require('../formatters/vehicleFormatter');

/**
 * CommandHandler - обработка команд бота
 */
class CommandHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Обработать команду /start
   */
  async handleStart(chatId, isAdmin) {
    const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
    await this.telegram.send(chatId, 'Главное меню', keyboard);
  }

  /**
   * Показать главное меню (для callback)
   */
  async showMainMenu(chatId, messageId, isAdmin) {
    const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
    await this.telegram.edit(chatId, messageId, 'Главное меню', keyboard);
  }

  /**
   * Обработать команду /help
   */
  async handleHelp(chatId, isAdmin) {
    const text = MenuFormatter.formatHelp(isAdmin);
    await this.telegram.send(chatId, text);
  }

  /**
   * Обработать команду /list
   */
  async handleList(chatId, isAdmin) {
    if (!isAdmin) {
      await this.telegram.send(chatId, '❌ У вас нет прав для выполнения этой команды');
      return;
    }

    const paginationData = await this.vehicleService.getVehiclesList(1, 5);
    const stats = await this.vehicleService.getStatsRealtime();
    const listData = VehicleFormatter.formatInteractiveListWithStats(paginationData, stats);
    await this.telegram.send(chatId, listData.text, listData.keyboard);
  }

  /**
   * Обработать команду /add - добавление одной строкой
   * Формат: /add Номер Марка Тип [Дата]
   * Пример: /add А123БВ Лада Постоянный
   * Пример: /add В456ГД КИА Временный 31.12.2026
   */
  async handleAdd(chatId, userId, text, isAdmin) {
    if (!isAdmin) {
      await this.telegram.send(chatId, '❌ У вас нет прав для выполнения этой команды');
      return;
    }

    const parts = text.split(/\s+/).filter(p => p.length > 0);

    if (parts.length < 4) {
      const helpText = '📝 <b>Добавление автомобиля одной строкой</b>\n\n' +
        '<b>Формат:</b>\n' +
        '<code>/add Номер Марка Тип [Дата]</code>\n\n' +
        '<b>Примеры:</b>\n' +
        '<code>/add А123БВ Лада Постоянный</code>\n' +
        '<code>/add В456ГД КИА Временный 31.12.2026</code>\n\n' +
        '<b>Тип:</b> Постоянный или Временный\n' +
        '<b>Дата:</b> обязательна для временных (ДД.ММ.ГГГГ)';

      await this.telegram.send(chatId, helpText);
      return;
    }

    // Парсим данные
    const plateNumber = parts[1]; // /add [Номер] ...
    const brand = parts[2];
    const passTypeRaw = parts[3];
    const expiryDateRaw = parts[4] || null;

    // Определяем тип пропуска
    let passType = 'permanent';
    if (passTypeRaw.toLowerCase().includes('врем') || passTypeRaw.toLowerCase() === 'temporary') {
      passType = 'temporary';
    }

    // Парсим дату для временных
    let expiryDate = null;
    if (passType === 'temporary') {
      if (!expiryDateRaw) {
        await this.telegram.send(chatId, '❌ Для временного пропуска укажите дату окончания\n\nПример: <code>/add В456ГД КИА Временный 31.12.2026</code>');
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

      if (result) {
        const vehicle = await this.vehicleService.findVehicle(plateNumber);
        const VehicleFormatter = require('../formatters/vehicleFormatter');
        const cardData = VehicleFormatter.formatCard(vehicle, 'menu_back', true);
        await this.telegram.send(chatId, '✅ <b>Автомобиль успешно добавлен!</b>\n\n' + cardData.text, cardData.keyboard);
      } else {
        await this.telegram.send(chatId, '❌ Автомобиль с таким номером уже существует');
      }
    } catch (error) {
      console.error('Error in handleAdd:', error);
      await this.telegram.send(chatId, '❌ Ошибка при добавлении автомобиля');
    }
  }


  /**
   * Обработать команду /remove
   */
  async handleRemove(chatId, userId, text, isAdmin) {
    if (!isAdmin) {
      await this.telegram.send(chatId, '❌ У вас нет прав для выполнения этой команды');
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 2) {
      await this.telegram.send(chatId, '❌ Укажите номер автомобиля.\n\nИспользуйте: /remove А123БВ');
      return;
    }

    const plateNumber = parts.slice(1).join(' ');
    const result = await this.vehicleService.removeVehicle(plateNumber);

    if (result) {
      await this.telegram.send(chatId, `✅ Автомобиль ${plateNumber} удален из базы данных`);
    } else {
      await this.telegram.send(chatId, '❌ Автомобиль не найден в базе данных');
    }
  }

  /**
   * Обработать команду /cancel
   */
  async handleCancel(chatId, userId) {
    const userState = await this.stateManager.getState(userId);
    if (userState) {
      await this.stateManager.clearState(userId);
      await this.telegram.send(chatId, '❌ Операция отменена');
    } else {
      await this.telegram.send(chatId, 'Нет активных операций для отмены');
    }
  }

  /**
   * Обработать команду /import
   */
  async handleImport(chatId, userId, isAdmin) {
    if (!isAdmin) {
      await this.telegram.send(chatId, '❌ У вас нет прав для выполнения этой команды');
      return;
    }

    await this.stateManager.setState(userId, 'awaiting_import_file', {});

    let instructions = '📥 <b>Массовый импорт автомобилей</b>\n\n';
    instructions += 'Отправьте текстовый файл (.txt) в формате:\n';
    instructions += '<code>Марка\tНомер\tТип_пропуска\tДата</code>\n\n';
    instructions += '<b>Пример:</b>\n';
    instructions += '<code>Лада Приора\tВ 782 РХ 12\tПостоянный\t31.12.2026</code>\n';
    instructions += '<code>КИА Серато\tН 122 АМ 73\tВременный\t15.06.2026</code>\n\n';
    instructions += '📌 Поля разделяются символом TAB\n';
    instructions += '📌 Тип пропуска: Постоянный или Временный\n';
    instructions += '📌 Дата в формате ДД.ММ.ГГГГ\n';
    instructions += '📌 Дубликаты будут пропущены';

    const keyboard = KeyboardBuilder.buildNavigationButtons(false);
    await this.telegram.send(chatId, instructions, keyboard);
  }

  /**
   * Обработать команду /fulldel - полная очистка базы данных
   */
  async handleFullDelete(chatId, isAdmin) {
    if (!isAdmin) {
      await this.telegram.send(chatId, '❌ У вас нет прав для выполнения этой команды');
      return;
    }

    try {
      // Отправляем сообщение о начале удаления
      const progressMsg = await this.telegram.send(chatId, '🗑️ Удаляю данные из БД...');

      // Получаем количество автомобилей до удаления
      const allVehicles = await this.vehicleService.getAllVehicles();
      const totalCount = allVehicles.length;

      // Полная очистка: удаляем все записи автомобилей, индекс и кэш
      await this.vehicleService.clearAllData();

      if (totalCount === 0) {
        await this.telegram.send(chatId, '📋 База данных уже была пуста\n\n✅ Индекс и кэш очищены');
      } else {
        await this.telegram.send(chatId, `🗑️ <b>База данных полностью очищена</b>\n\n✅ Удалено автомобилей: <b>${totalCount}</b>`);
      }

      // Отправляем главное меню
      const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
      await this.telegram.send(chatId, 'Главное меню', keyboard);
    } catch (error) {
      console.error('Error in handleFullDelete:', error);
      await this.telegram.send(chatId, '❌ Ошибка при очистке базы данных');
    }
  }
}

module.exports = CommandHandler;
