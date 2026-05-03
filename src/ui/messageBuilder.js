/**
 * MessageBuilder - вспомогательные методы для построения сообщений
 */
class MessageBuilder {
  /**
   * Экранировать HTML символы для Telegram
   */
  static escapeHtml(text) {
    if (!text) return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Обрезать текст до максимальной длины
   */
  static truncate(text, maxLength = 4096) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - 3) + '...';
  }
}

module.exports = MessageBuilder;
