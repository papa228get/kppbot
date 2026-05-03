/**
 * StatsFormatter - форматирование статистики
 */
class StatsFormatter {
  /**
   * Форматировать статистику
   */
  static format(stats) {
    let text = '📊 <b>Статистика базы данных</b>\n\n';

    text += `📋 Всего автомобилей: <b>${stats.total}</b>\n\n`;

    text += '<b>По статусу доступа:</b>\n';
    text += `✅ Разрешено: ${stats.allowed}\n`;
    text += `⛔ Запрещено: ${stats.denied}\n\n`;

    text += '<b>По типу пропуска:</b>\n';
    text += `🔄 Постоянный: ${stats.permanent}\n`;
    text += `⏳ Временный: ${stats.temporary}\n`;

    return text;
  }
}

module.exports = StatsFormatter;
