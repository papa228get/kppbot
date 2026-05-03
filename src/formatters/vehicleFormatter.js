const CardFormatter = require('./vehicle/cardFormatter');
const ListFormatter = require('./vehicle/listFormatter');
const SearchFormatter = require('./vehicle/searchFormatter');
const AccessCheckFormatter = require('./vehicle/accessCheckFormatter');

/**
 * VehicleFormatter - главный форматтер для автомобилей
 * Делегирует в специализированные форматтеры
 */
class VehicleFormatter {
  /**
   * Форматирование информации об автомобиле
   */
  static formatInfo(vehicle) {
    return CardFormatter.formatInfo(vehicle);
  }

  /**
   * Форматирование списка автомобилей
   */
  static formatList(vehicles) {
    return ListFormatter.formatList(vehicles);
  }

  /**
   * Форматирование карточки автомобиля
   */
  static formatCard(vehicle, backAction = 'list_back', showDelete = true) {
    return CardFormatter.formatCard(vehicle, backAction, showDelete);
  }

  /**
   * Форматирование интерактивного списка с кнопками
   */
  static formatInteractiveList(paginationData) {
    return ListFormatter.formatInteractiveList(paginationData);
  }

  /**
   * Форматирование интерактивного списка со статистикой
   */
  static formatInteractiveListWithStats(paginationData, stats) {
    return ListFormatter.formatInteractiveListWithStats(paginationData, stats);
  }

  /**
   * Форматирование результатов поиска с множественными совпадениями
   */
  static formatSearchResults(vehicles) {
    return SearchFormatter.formatSearchResults(vehicles);
  }

  /**
   * Форматирование сообщения о проверке доступа
   */
  static formatAccessCheck(result) {
    return AccessCheckFormatter.formatAccessCheck(result);
  }

  /**
   * Форматирование меню настроек автомобиля
   */
  static formatEditMenu(vehicle) {
    return CardFormatter.formatEditMenu(vehicle);
  }
}

module.exports = VehicleFormatter;
