/**
 * PlateValidator - валидация и нормализация номеров автомобилей
 */
class PlateValidator {
  /**
   * Нормализовать номер автомобиля
   * Убирает пробелы и приводит к верхнему регистру
   */
  static normalize(plate) {
    if (!plate) return '';

    // Убираем все пробелы и приводим к верхнему регистру
    return plate.replace(/\s+/g, '').toUpperCase();
  }

  /**
   * Валидировать номер автомобиля
   */
  static validate(plate) {
    const normalized = this.normalize(plate);
    return normalized.length > 0;
  }

  /**
   * Проверить, является ли пользователь администратором
   */
  static isAdmin(userId) {
    const adminIds = process.env.ADMIN_IDS || '';
    const adminList = adminIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    return adminList.includes(userId);
  }
}

module.exports = PlateValidator;
