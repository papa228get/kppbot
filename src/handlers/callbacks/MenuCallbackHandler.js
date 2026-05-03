const KeyboardBuilder = require('../../ui/keyboardBuilder');
const MenuFormatter = require('../../formatters/menuFormatter');
const StatsFormatter = require('../../formatters/statsFormatter');
const VehicleFormatter = require('../../formatters/vehicleFormatter');

/**
 * MenuCallbackHandler - обработка callback'ов меню
 * Обрабатывает: menu_back, menu_help, menu_list, menu_stats, menu_add, menu_import
 */
class MenuCallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Проверить, может ли этот обработчик обработать callback
   */
  canHandle(data) {
    return data.startsWith('menu_');
  }

  /**
   * Обработать callback
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data === 'menu_back') {
      await this.handleMenuBack(chatId, messageId, userId);
    } else if (data === 'menu_help') {
      await this.handleMenuHelp(chatId, messageId, userId);
    } else if (data === 'menu_list') {
      await this.handleMenuList(chatId, messageId);
    } else if (data === 'menu_add') {
      await this.handleMenuAdd(chatId, messageId, userId);
    } else if (data === 'menu_import') {
      await this.handleMenuImport(chatId, messageId, userId);
    }

    await this.telegram.answerCallback(callbackQuery.id);
  }

  /**
   * Обработать menu_back - возврат в главное меню
   */
  async handleMenuBack(chatId, messageId, userId) {
    const PlateValidator = require('../../validators/plateValidator');
    const isAdmin = PlateValidator.isAdmin(userId);
    const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
    await this.telegram.edit(chatId, messageId, 'Главное меню', keyboard);
  }

  /**
   * Обработать menu_help - показать справку
   */
  async handleMenuHelp(chatId, messageId, userId) {
    const PlateValidator = require('../../validators/plateValidator');
    const isAdmin = PlateValidator.isAdmin(userId);
    const text = MenuFormatter.formatHelp(isAdmin);
    const keyboard = {
      inline_keyboard: [
        [{ text: '⬅️ Назад', callback_data: 'menu_back' }]
      ]
    };
    await this.telegram.edit(chatId, messageId, text, keyboard);
  }

  /**
   * Обработать menu_list - показать список автомобилей со статистикой
   */
  async handleMenuList(chatId, messageId) {
    const paginationData = await this.vehicleService.getVehiclesList(1, 5);
    const stats = await this.vehicleService.getStatsRealtime();
    const listData = VehicleFormatter.formatInteractiveListWithStats(paginationData, stats);
    await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
  }

  /**
   * Обработать menu_add - ОТКЛЮЧЕНО
   */
  async handleMenuAdd(chatId, messageId, userId) {
    const PlateValidator = require('../../validators/plateValidator');
    const isAdmin = PlateValidator.isAdmin(userId);

    if (!isAdmin) {
      await this.telegram.answerCallback(callbackQuery.id, '❌ У вас нет прав для выполнения этой команды', true);
      return;
    }

    await this.telegram.edit(chatId, messageId, '❌ Добавление через меню отключено.\n\nИспользуйте /import для массового импорта автомобилей из файла.');
  }


  /**
   * Обработать menu_import - начать импорт файла
   */
  async handleMenuImport(chatId, messageId, userId) {
    const PlateValidator = require('../../validators/plateValidator');
    const isAdmin = PlateValidator.isAdmin(userId);

    if (!isAdmin) {
      await this.telegram.answerCallback(callbackQuery.id, '❌ У вас нет прав для выполнения этой команды', true);
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
    await this.telegram.edit(chatId, messageId, instructions, keyboard);
  }
}

module.exports = MenuCallbackHandler;
