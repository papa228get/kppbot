/**
 * ListFormatter - форматирование списков автомобилей
 */
class ListFormatter {
  /**
   * Проверить, истек ли срок действия пропуска
   */
  static isExpired(vehicle) {
    if (vehicle.pass_type !== 'temporary' || !vehicle.expiry_date) {
      return false;
    }

    const expiryDate = new Date(vehicle.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expiryDate < today;
  }

  /**
   * Получить иконку статуса автомобиля
   */
  static getStatusIcon(vehicle) {
    // Если пропуск просрочен - всегда ⚠️
    if (this.isExpired(vehicle)) {
      return '⚠️';
    }
    // Иначе по статусу доступа
    return vehicle.access_status === 'allowed' ? '✅' : '⛔';
  }

  /**
   * Форматировать простой список автомобилей
   */
  static formatList(vehicles) {
    if (vehicles.length === 0) {
      return '📋 База данных пуста';
    }

    let text = '📋 <b>Список автомобилей:</b>\n\n';

    vehicles.forEach((vehicle, index) => {
      const icon = this.getStatusIcon(vehicle);
      const passIcon = vehicle.pass_type === 'permanent' ? '🔄' : '⏳';

      text += `${index + 1}. ${icon} <b>${vehicle.plate_number}</b>`;

      if (vehicle.brand) {
        text += ` - ${vehicle.brand}`;
      }

      text += ` ${passIcon}`;

      // Добавляем краткий комментарий если есть
      if (vehicle.notes) {
        const shortNotes = vehicle.notes.length > 20
          ? vehicle.notes.substring(0, 20) + '...'
          : vehicle.notes;
        text += ` 📝 ${shortNotes}`;
      }

      text += `\n`;
    });

    return text;
  }

  /**
   * Форматировать интерактивный список с пагинацией
   */
  static formatInteractiveList(paginationData) {
    const { vehicles, total, page, total_pages } = paginationData;

    // Если база пуста - показываем только кнопку "Назад"
    if (total === 0) {
      return {
        text: '📋 Список автомобилей\n\nБаза данных пуста',
        keyboard: {
          inline_keyboard: [
            [{ text: '⬅️ Назад', callback_data: 'menu_back' }]
          ]
        }
      };
    }

    const text = '📋 Список автомобилей';

    // Создаем кнопки для каждого авто (по одной в ряд)
    const vehicleButtons = vehicles.map(vehicle => {
      const icon = this.getStatusIcon(vehicle);
      const passIcon = vehicle.pass_type === 'permanent' ? '🔄' : '⏳';

      let buttonText = `${icon} ${vehicle.plate_number}`;
      if (vehicle.brand) {
        buttonText += ` ${vehicle.brand}`;
      }
      buttonText += ` ${passIcon}`;

      // Добавляем краткий комментарий в текст кнопки
      if (vehicle.notes) {
        const shortNotes = vehicle.notes.length > 15
          ? vehicle.notes.substring(0, 15) + '...'
          : vehicle.notes;
        buttonText += ` 📝 ${shortNotes}`;
      }

      return [{
        text: buttonText,
        callback_data: `view_vehicle:${vehicle.plate_number}`
      }];
    });

    // Кнопки навигации по страницам
    const navRow = [];
    if (page > 1) {
      navRow.push({ text: '⬅️', callback_data: `list_page:${page - 1}` });
    }

    // Центральная кнопка с номером страницы (пустышка)
    navRow.push({ text: `${page}/${total_pages}`, callback_data: 'list_page_info' });

    if (page < total_pages) {
      navRow.push({ text: '➡️', callback_data: `list_page:${page + 1}` });
    }

    // Кнопки поиска и возврата
    const actionButtons = [
      { text: '🔍 Поиск', callback_data: 'list_search' },
      { text: '⬅️ Назад', callback_data: 'menu_back' }
    ];

    const keyboard = {
      inline_keyboard: [
        ...vehicleButtons,
        ...(navRow.length > 1 ? [navRow] : []), // Показываем только если есть навигация
        actionButtons
      ]
    };

    return {
      text,
      keyboard
    };
  }

  /**
   * Форматировать интерактивный список со статистикой
   */
  static formatInteractiveListWithStats(paginationData, stats) {
    const { vehicles, total, page, total_pages } = paginationData;

    // Формируем текст со статистикой
    let text = '📊 <b>Статистика базы данных</b>\n\n';
    text += `📋 Всего автомобилей: <b>${stats.total}</b>\n\n`;
    text += '<b>По статусу доступа:</b>\n';
    text += `✅ Разрешено: ${stats.allowed}\n`;
    text += `⛔ Запрещено: ${stats.denied}\n\n`;
    text += '<b>По типу пропуска:</b>\n';
    text += `🔄 Постоянный: ${stats.permanent}\n`;
    text += `⏳ Временный: ${stats.temporary}\n\n`;
    text += '📋 <b>Список автомобилей:</b>';

    // Если база пуста - показываем только кнопку "Назад"
    if (total === 0) {
      return {
        text: text + '\n\nБаза данных пуста',
        keyboard: {
          inline_keyboard: [
            [{ text: '⬅️ Назад', callback_data: 'menu_back' }]
          ]
        }
      };
    }

    // Создаем кнопки для каждого авто (по одной в ряд)
    const vehicleButtons = vehicles.map(vehicle => {
      const icon = this.getStatusIcon(vehicle);
      const passIcon = vehicle.pass_type === 'permanent' ? '🔄' : '⏳';

      let buttonText = `${icon} ${vehicle.plate_number}`;
      if (vehicle.brand) {
        buttonText += ` ${vehicle.brand}`;
      }
      buttonText += ` ${passIcon}`;

      // Добавляем краткий комментарий в текст кнопки
      if (vehicle.notes) {
        const shortNotes = vehicle.notes.length > 15
          ? vehicle.notes.substring(0, 15) + '...'
          : vehicle.notes;
        buttonText += ` 📝 ${shortNotes}`;
      }

      return [{
        text: buttonText,
        callback_data: `view_vehicle:${vehicle.plate_number}`
      }];
    });

    // Кнопки навигации по страницам
    const navRow = [];
    if (page > 1) {
      navRow.push({ text: '⬅️', callback_data: `list_page:${page - 1}` });
    }

    // Центральная кнопка с номером страницы (пустышка)
    navRow.push({ text: `${page}/${total_pages}`, callback_data: 'list_page_info' });

    if (page < total_pages) {
      navRow.push({ text: '➡️', callback_data: `list_page:${page + 1}` });
    }

    // Кнопки поиска и возврата
    const actionButtons = [
      { text: '🔍 Поиск', callback_data: 'list_search' },
      { text: '⬅️ Назад', callback_data: 'menu_back' }
    ];

    const keyboard = {
      inline_keyboard: [
        ...vehicleButtons,
        ...(navRow.length > 1 ? [navRow] : []), // Показываем только если есть навигация
        actionButtons
      ]
    };

    return {
      text,
      keyboard
    };
  }
}

module.exports = ListFormatter;
