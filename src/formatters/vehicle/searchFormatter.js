/**
 * SearchFormatter - форматирование результатов поиска
 */
class SearchFormatter {
  /**
   * Форматировать результаты поиска с множественными совпадениями
   */
  static formatSearchResults(vehicles) {
    if (vehicles.length === 0) {
      return {
        text: '❌ Автомобили не найдены',
        keyboard: {
          inline_keyboard: [
            [{ text: '🏠 Главное меню', callback_data: 'menu_back' }]
          ]
        }
      };
    }

    let text = `🔍 <b>Найдено автомобилей: ${vehicles.length}</b>\n\nВыберите нужный:\n\n`;

    vehicles.forEach((vehicle, index) => {
      const icon = vehicle.access_status === 'allowed' ? '✅' : '⛔';
      const passIcon = vehicle.pass_type === 'permanent' ? '🔄' : '⏳';

      text += `${index + 1}. ${icon} <b>${vehicle.plate_number}</b>`;

      if (vehicle.brand) {
        text += ` - ${vehicle.brand}`;
      }

      text += ` ${passIcon}`;

      // Добавляем краткий комментарий если есть
      if (vehicle.notes) {
        const shortNotes = vehicle.notes.length > 30
          ? vehicle.notes.substring(0, 30) + '...'
          : vehicle.notes;
        text += ` 📝 ${shortNotes}`;
      }

      text += `\n`;
    });

    // Формируем кнопки для каждого автомобиля
    const vehicleButtons = vehicles.map(vehicle => [{
      text: `🚗 ${vehicle.plate_number}`,
      callback_data: `search_select:${vehicle.plate_number}`
    }]);

    const keyboard = {
      inline_keyboard: [
        ...vehicleButtons,
        [{ text: '🏠 Главное меню', callback_data: 'menu_back' }]
      ]
    };

    return {
      text,
      keyboard
    };
  }
}

module.exports = SearchFormatter;
