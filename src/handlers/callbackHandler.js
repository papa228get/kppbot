/**
 * CallbackHandler - обработка callback запросов
 * Делегирует в специализированные обработчики
 */
class CallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;

    // Здесь будут инициализированы специализированные обработчики
    // Пока используем упрощенную версию
  }

  /**
   * Обработать callback query
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    // Базовая обработка основных callback'ов
    if (data === 'menu_back') {
      const PlateValidator = require('../validators/plateValidator');
      const KeyboardBuilder = require('../ui/keyboardBuilder');
      const isAdmin = PlateValidator.isAdmin(userId);
      const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
      await this.telegram.edit(chatId, messageId, 'Главное меню', keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'menu_help') {
      const PlateValidator = require('../validators/plateValidator');
      const MenuFormatter = require('../formatters/menuFormatter');
      const isAdmin = PlateValidator.isAdmin(userId);
      const text = MenuFormatter.formatHelp(isAdmin);
      const keyboard = {
        inline_keyboard: [
          [{ text: '⬅️ Назад', callback_data: 'menu_back' }]
        ]
      };
      await this.telegram.edit(chatId, messageId, text, keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'menu_list') {
      const VehicleFormatter = require('../formatters/vehicleFormatter');
      const paginationData = await this.vehicleService.getVehiclesList(1, 5);
      const listData = VehicleFormatter.formatInteractiveList(paginationData);
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'menu_stats') {
      const StatsFormatter = require('../formatters/statsFormatter');

      // Читаем статистику из кэша (который обновляется после каждого изменения)
      const stats = await this.vehicleService.getStats();

      const text = StatsFormatter.format(stats);
      const keyboard = {
        inline_keyboard: [
          [{ text: '⬅️ Назад', callback_data: 'menu_back' }]
        ]
      };
      await this.telegram.edit(chatId, messageId, text, keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'menu_add') {
      const PlateValidator = require('../validators/plateValidator');
      const KeyboardBuilder = require('../ui/keyboardBuilder');
      const isAdmin = PlateValidator.isAdmin(userId);

      if (!isAdmin) {
        await this.telegram.answerCallback(callbackQuery.id, '❌ У вас нет прав для выполнения этой команды', true);
        return;
      }

      await this.stateManager.setState(userId, 'add_vehicle_plate', {});
      const keyboard = KeyboardBuilder.buildNavigationButtons(false);
      await this.telegram.edit(chatId, messageId, '🚗 Добавление нового автомобиля\n\nВведите номер автомобиля (например: А123БВ):', keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'menu_import') {
      const PlateValidator = require('../validators/plateValidator');
      const KeyboardBuilder = require('../ui/keyboardBuilder');
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
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('view_vehicle:')) {
      const plateNumber = data.split(':')[1];
      const vehicle = await this.vehicleService.findVehicle(plateNumber);

      if (vehicle) {
        const VehicleFormatter = require('../formatters/vehicleFormatter');
        const PlateValidator = require('../validators/plateValidator');
        const isAdmin = PlateValidator.isAdmin(userId);
        const cardData = VehicleFormatter.formatCard(vehicle, 'list_back', isAdmin);
        await this.telegram.edit(chatId, messageId, cardData.text, cardData.keyboard);
      }

      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('list_page:')) {
      const page = parseInt(data.split(':')[1]);
      const VehicleFormatter = require('../formatters/vehicleFormatter');
      const paginationData = await this.vehicleService.getVehiclesList(page, 5);
      const listData = VehicleFormatter.formatInteractiveList(paginationData);
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'list_back') {
      const VehicleFormatter = require('../formatters/vehicleFormatter');
      const paginationData = await this.vehicleService.getVehiclesList(1, 5);
      const listData = VehicleFormatter.formatInteractiveList(paginationData);
      // Добавляем кнопку "Назад" в главное меню
      if (listData.keyboard) {
        listData.keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_back' }]);
      }
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('list_page:')) {
      const page = parseInt(data.split(':')[1]);
      const VehicleFormatter = require('../formatters/vehicleFormatter');
      const paginationData = await this.vehicleService.getVehiclesList(page, 5);
      const listData = VehicleFormatter.formatInteractiveList(paginationData);
      // Добавляем кнопку "Назад" в главное меню
      if (listData.keyboard) {
        listData.keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_back' }]);
      }
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'list_page_info') {
      // Просто игнорируем (это информационная кнопка с номером страницы)
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data === 'list_search') {
      await this.stateManager.setState(userId, 'list_search', {});
      const KeyboardBuilder = require('../ui/keyboardBuilder');
      const keyboard = KeyboardBuilder.buildNavigationButtons(false);
      await this.telegram.edit(chatId, messageId, '🔍 <b>Поиск автомобиля</b>\n\nУкажите гос.номер разыскиваемого авто:', keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('toggle_status:')) {
      const plateNumber = data.split(':')[1];
      const vehicle = await this.vehicleService.findVehicle(plateNumber);

      if (vehicle) {
        const newStatus = vehicle.access_status === 'allowed' ? 'denied' : 'allowed';
        const updatedVehicle = await this.vehicleService.updateVehicleStatus(plateNumber, newStatus);

        // updateVehicleStatus теперь возвращает обновлённый объект
        const VehicleFormatter = require('../formatters/vehicleFormatter');
        const PlateValidator = require('../validators/plateValidator');
        const isAdmin = PlateValidator.isAdmin(userId);
        const cardData = VehicleFormatter.formatCard(updatedVehicle, 'list_back', isAdmin);
        await this.telegram.edit(chatId, messageId, cardData.text, cardData.keyboard);
      }

      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('delete_vehicle:')) {
      const plateNumber = data.split(':')[1];

      // Добавляем подтверждение удаления
      const vehicle = await this.vehicleService.findVehicle(plateNumber);
      if (!vehicle) {
        await this.telegram.answerCallback(callbackQuery.id, '❌ Автомобиль не найден', true);
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
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    if (data.startsWith('confirm_delete:')) {
      const plateNumber = data.split(':')[1];
      await this.vehicleService.removeVehicle(plateNumber);

      await this.telegram.answerCallback(callbackQuery.id, '✅ Автомобиль удален', false);

      // Возвращаемся к обновленному списку (принудительно пересчитываем)
      const VehicleFormatter = require('../formatters/vehicleFormatter');
      const paginationData = await this.vehicleService.getVehiclesList(1, 5);
      const listData = VehicleFormatter.formatInteractiveList(paginationData);
      await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
      return;
    }

    // Обработка выбора типа пропуска при добавлении автомобиля
    if (data === 'pass_permanent' || data === 'pass_temporary') {
      const userState = await this.stateManager.getState(userId);

      if (userState && userState.state === 'add_vehicle_pass_type') {
        const passType = data === 'pass_permanent' ? 'permanent' : 'temporary';
        await this.stateManager.updateStateData(userId, 'pass_type', passType);

        if (passType === 'permanent') {
          // Для постоянного пропуска сразу переходим к заметкам
          await this.stateManager.setState(userId, 'add_vehicle_notes', userState.data);
          const KeyboardBuilder = require('../ui/keyboardBuilder');
          const keyboard = KeyboardBuilder.buildNavigationButtons(true);
          await this.telegram.send(chatId, '📝 Введите заметки (или отправьте "-" чтобы пропустить):', keyboard);
        } else {
          // Для временного пропуска запрашиваем дату
          await this.stateManager.setState(userId, 'add_vehicle_expiry', userState.data);
          const KeyboardBuilder = require('../ui/keyboardBuilder');
          const keyboard = KeyboardBuilder.buildNavigationButtons(true);
          await this.telegram.send(chatId, '📅 Введите дату окончания пропуска в формате ДД.ММ.ГГГГ (например: 31.12.2026):', keyboard);
        }

        await this.telegram.answerCallback(callbackQuery.id);
        return;
      }
    }

    // Обработка редактирования автомобиля - показать меню настроек
    if (data.startsWith('edit_vehicle:')) {
      const plateNumber = data.split(':')[1];
      const vehicle = await this.vehicleService.findVehicle(plateNumber);

      if (vehicle) {
        const CardFormatter = require('../formatters/vehicle/cardFormatter');
        const editMenuData = CardFormatter.formatEditMenu(vehicle);
        await this.telegram.edit(chatId, messageId, editMenuData.text, editMenuData.keyboard);
      }

      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    // Обработка выбора поля для редактирования
    if (data.startsWith('edit_field:')) {
      const parts = data.split(':');
      const field = parts[1];
      const plateNumber = parts[2];

      const vehicle = await this.vehicleService.findVehicle(plateNumber);
      if (!vehicle) {
        await this.telegram.answerCallback(callbackQuery.id, '❌ Автомобиль не найден', true);
        return;
      }

      const KeyboardBuilder = require('../ui/keyboardBuilder');
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
          await this.telegram.answerCallback(callbackQuery.id);
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

      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    // Обработка выбора типа пропуска при редактировании
    if (data.startsWith('set_pass_type:')) {
      const parts = data.split(':');
      const newType = parts[1];
      const plateNumber = parts[2];

      const vehicle = await this.vehicleService.findVehicle(plateNumber);
      if (!vehicle) {
        await this.telegram.answerCallback(callbackQuery.id, '❌ Автомобиль не найден', true);
        return;
      }

      if (newType === 'permanent') {
        // Для постоянного пропуска сразу обновляем
        let updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'pass_type', 'permanent');
        updatedVehicle = await this.vehicleService.updateVehicle(plateNumber, 'expiry_date', null);

        const CardFormatter = require('../formatters/vehicle/cardFormatter');
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
        const KeyboardBuilder = require('../ui/keyboardBuilder');
        const keyboard = KeyboardBuilder.buildEditNavigationButtons(plateNumber);
        await this.telegram.send(chatId, '📅 Введите дату окончания пропуска в формате ГГГГ-ММ-ДД (например: 2026-12-31):', keyboard);
      }

      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    // Обработка кнопок навигации
    if (data === 'nav_cancel') {
      const userState = await this.stateManager.getState(userId);

      // Если пользователь в процессе поиска, возвращаем к списку
      if (userState && userState.state === 'list_search') {
        await this.stateManager.clearState(userId);
        const VehicleFormatter = require('../formatters/vehicleFormatter');
        const paginationData = await this.vehicleService.getVehiclesList(1, 5);
        const listData = VehicleFormatter.formatInteractiveList(paginationData);
        // Добавляем кнопку "Назад" в главное меню
        if (listData.keyboard) {
          listData.keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'menu_back' }]);
        }
        await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
        await this.telegram.answerCallback(callbackQuery.id);
        return;
      }

      // Если пользователь в процессе редактирования, возвращаем к меню настроек
      if (userState && userState.state) {
        const editStates = ['edit_vehicle_plate', 'edit_vehicle_brand', 'edit_vehicle_pass_type', 'edit_vehicle_notes'];

        if (editStates.includes(userState.state)) {
          const plateNumber = userState.data.plate_number || userState.data.old_plate;

          if (plateNumber) {
            await this.stateManager.clearState(userId);
            const vehicle = await this.vehicleService.findVehicle(plateNumber);

            if (vehicle) {
              const CardFormatter = require('../formatters/vehicle/cardFormatter');
              const editData = CardFormatter.formatEditMenu(vehicle);
              await this.telegram.edit(chatId, messageId, editData.text, editData.keyboard);
              await this.telegram.answerCallback(callbackQuery.id);
              return;
            }
          }
        }
      }

      // В остальных случаях возвращаем в главное меню
      await this.stateManager.clearState(userId);
      const PlateValidator = require('../validators/plateValidator');
      const KeyboardBuilder = require('../ui/keyboardBuilder');
      const isAdmin = PlateValidator.isAdmin(userId);
      const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
      await this.telegram.edit(chatId, messageId, 'Главное меню', keyboard);
      await this.telegram.answerCallback(callbackQuery.id);
      return;
    }

    // Если callback не обработан
    await this.telegram.answerCallback(callbackQuery.id);
  }
}

module.exports = CallbackHandler;
