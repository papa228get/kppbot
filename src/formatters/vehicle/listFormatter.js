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

      text += ` ${passIcon}\n`;
    });

    return text;
  }

  /**
   * Форматировать интерактивный список с пагинацией
   */
  static formatInteractiveList(paginationData) {
    const { vehicles, total, page, total_pages } = paginationData;

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
      return [{
        text: `${icon} ${vehicle.plate_number}`,
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

    // Кнопка поиска
    const searchButton = [{ text: '🔍 Поиск', callback_data: 'list_search' }];

    const keyboard = {
      inline_keyboard: [
        ...vehicleButtons,
        ...(navRow.length > 1 ? [navRow] : []), // Показываем только если есть навигация
        searchButton
      ]
    };

    return {
      text,
      keyboard
    };
  }
}

module.exports = ListFormatter;
