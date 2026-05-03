/**
 * CardFormatter - форматирование карточки автомобиля
 */
class CardFormatter {
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
   * Форматировать дату из ISO в человекочитаемый формат
   */
  static formatDate(isoDate) {
    if (!isoDate) return '';

    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  /**
   * Форматировать информацию об автомобиле (краткая версия)
   */
  static formatInfo(vehicle) {
    let info = `🚗 Номер: ${vehicle.plate_number}\n`;

    if (vehicle.brand) {
      info += `🏷 Марка: ${vehicle.brand}\n`;
    }

    info += `📋 Тип пропуска: ${vehicle.pass_type === 'permanent' ? 'Постоянный' : 'Временный'}\n`;

    if (vehicle.expiry_date) {
      info += `📅 Действует до: ${vehicle.expiry_date}\n`;
    }

    if (vehicle.notes) {
      info += `📝 Заметки: ${vehicle.notes}\n`;
    }

    return info;
  }

  /**
   * Форматировать полную карточку автомобиля с кнопками
   */
  static formatCard(vehicle, backAction = 'list_back', showDelete = true) {
    const isExpired = this.isExpired(vehicle);
    const icon = vehicle.access_status === 'allowed' ? '✅' : '⛔';
    const status = vehicle.access_status === 'allowed' ? 'Разрешен' : 'Запрещен';

    let text = '🚗 <b>Карточка автомобиля</b>\n\n';
    text += `${icon} <b>${vehicle.plate_number}</b>\n\n`;

    if (vehicle.brand) {
      text += `🏷 Марка: ${vehicle.brand}\n`;
    }

    text += `📋 Статус: ${status}\n`;
    text += `📋 Тип пропуска: ${vehicle.pass_type === 'permanent' ? '🔄 Постоянный' : '⏳ Временный'}\n`;

    if (vehicle.expiry_date) {
      text += `📅 Действует до: ${vehicle.expiry_date}\n`;

      // Предупреждение об истекшем пропуске
      if (isExpired) {
        text += `\n⛔ <b>ПРОПУСК ИСТЕК!</b>\n`;
        text += `❗ Срок действия временного пропуска истек.\n`;
      }
    }

    if (vehicle.notes) {
      text += `📝 Заметки: ${vehicle.notes}\n`;
    }

    text += `\n📅 Добавлен: ${this.formatDate(vehicle.created_at)}`;

    // Формируем клавиатуру
    const buttons = [];

    if (showDelete) {
      // Первая строка: Переключение статуса и Удалить
      const statusButton = vehicle.access_status === 'allowed'
        ? { text: '⛔ Черный список', callback_data: `toggle_status:${vehicle.plate_number}` }
        : { text: '✅ Разрешить', callback_data: `toggle_status:${vehicle.plate_number}` };

      buttons.push([
        statusButton,
        { text: '🗑 Удалить', callback_data: `delete_vehicle:${vehicle.plate_number}` }
      ]);

      // Вторая строка: Настройки
      buttons.push([
        { text: '⚙️ Настройки', callback_data: `edit_vehicle:${vehicle.plate_number}` }
      ]);

      // Третья строка: Назад и Главное меню
      buttons.push([
        { text: '⬅️ К списку', callback_data: backAction },
        { text: '🏠 Главное меню', callback_data: 'menu_back' }
      ]);
    } else {
      // Для обычных пользователей: только навигация
      buttons.push([
        { text: '⬅️ К списку', callback_data: backAction },
        { text: '🏠 Главное меню', callback_data: 'menu_back' }
      ]);
    }

    const keyboard = {
      inline_keyboard: buttons
    };

    return {
      text,
      keyboard
    };
  }

  /**
   * Форматировать меню настроек автомобиля
   */
  static formatEditMenu(vehicle) {
    const text = `⚙️ <b>Настройки автомобиля</b>\n\n🚗 Номер: <b>${vehicle.plate_number}</b>\n\nВыберите раздел для изменений:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🚗 Гос-Номер', callback_data: `edit_field:plate:${vehicle.plate_number}` },
          { text: '🏷 Марка', callback_data: `edit_field:brand:${vehicle.plate_number}` }
        ],
        [
          { text: '📋 Тип пропуска', callback_data: `edit_field:pass_type:${vehicle.plate_number}` },
          { text: '📝 Заметка', callback_data: `edit_field:notes:${vehicle.plate_number}` }
        ],
        [
          { text: '⬅️ Назад', callback_data: `view_vehicle:${vehicle.plate_number}` }
        ]
      ]
    };

    return {
      text,
      keyboard
    };
  }
}

module.exports = CardFormatter;
