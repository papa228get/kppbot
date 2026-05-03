const CardFormatter = require('./cardFormatter');

/**
 * AccessCheckFormatter - форматирование сообщений о проверке доступа
 */
class AccessCheckFormatter {
  /**
   * Форматировать результат проверки доступа
   */
  static formatAccessCheck(result) {
    if (!result.found) {
      return result.message;
    }

    if (result.multiple) {
      return null; // Будет обработано через SearchFormatter
    }

    const vehicle = result.vehicle;

    if (result.expired) {
      return '⛔ ПРОПУСК ИСТЕК\n\n' + CardFormatter.formatInfo(vehicle) + '\n\n❗ Срок действия пропуска истек!';
    }

    const allowed = result.allowed;
    const icon = allowed ? '✅' : '⛔';
    const status = allowed ? 'ПРОПУСТИТЬ' : 'НЕ ПРОПУСКАТЬ';

    return `${icon} ${status}\n\n` + CardFormatter.formatInfo(vehicle);
  }
}

module.exports = AccessCheckFormatter;
