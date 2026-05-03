/**
 * KeyboardBuilder - построение inline клавиатур для Telegram
 */
class KeyboardBuilder {
  /**
   * Главное меню
   */
  static buildMainMenu(isAdmin) {
    if (isAdmin) {
      return {
        inline_keyboard: [
          [
            { text: '➕ Добавить авто', callback_data: 'menu_add' },
            { text: '📋 Список', callback_data: 'menu_list' }
          ],
          [
            { text: '📥 Импорт', callback_data: 'menu_import' },
            { text: 'ℹ️ Справка', callback_data: 'menu_help' }
          ]
        ]
      };
    }

    return {
      inline_keyboard: [
        [
          { text: 'ℹ️ Справка', callback_data: 'menu_help' }
        ]
      ]
    };
  }

  /**
   * Кнопки навигации
   */
  static buildNavigationButtons(showBack = false) {
    const buttons = [];

    if (showBack) {
      buttons.push({ text: '⬅️ Назад', callback_data: 'nav_back' });
    }

    buttons.push({ text: '❌ Отмена', callback_data: 'nav_cancel' });

    return {
      inline_keyboard: [buttons]
    };
  }

  /**
   * Кнопки выбора статуса
   */
  static buildStatusButtons() {
    return {
      inline_keyboard: [
        [
          { text: '✅ Разрешен', callback_data: 'status_allowed' },
          { text: '⛔ Запрещен', callback_data: 'status_denied' }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'nav_back' },
          { text: '❌ Отмена', callback_data: 'nav_cancel' }
        ]
      ]
    };
  }

  /**
   * Кнопки выбора типа пропуска
   * Передаем данные через callback_data для избежания проблем с eventual consistency
   */
  static buildPassTypeButtons(plateNumber, brand) {
    // Кодируем данные в base64 для передачи через callback
    const data = Buffer.from(JSON.stringify({ plate_number: plateNumber, brand: brand })).toString('base64');

    return {
      inline_keyboard: [
        [
          { text: '🔄 Постоянный', callback_data: `pass_permanent:${data}` },
          { text: '⏳ Временный', callback_data: `pass_temporary:${data}` }
        ],
        [
          { text: '❌ Отмена', callback_data: 'nav_cancel' }
        ]
      ]
    };
  }

  /**
   * Кнопки для редактирования (возврат к меню настроек)
   */
  static buildEditNavigationButtons(plateNumber) {
    return {
      inline_keyboard: [
        [
          { text: '❌ Отмена', callback_data: `edit_vehicle:${plateNumber}` }
        ]
      ]
    };
  }
}

module.exports = KeyboardBuilder;
