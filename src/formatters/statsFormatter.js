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
    text += `⏳ Временный: ${stats.temporary}\n\n`;

    // Добавляем время обновления для обхода кэша Telegram
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    text += `<i>Обновлено: ${timeStr}</i>`;

    return text;
  }
}

module.exports = StatsFormatter;
