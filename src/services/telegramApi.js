const fetch = require('node-fetch');

/**
 * TelegramApi - работа с Telegram Bot API
 */
class TelegramApi {
  constructor(token) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * Отправить сообщение в Telegram
   */
  async send(chatId, text, replyMarkup = null) {
    const url = `${this.baseUrl}/sendMessage`;

    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      data.reply_markup = JSON.stringify(replyMarkup);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  /**
   * Редактировать сообщение
   */
  async edit(chatId, messageId, text, replyMarkup = null) {
    const url = `${this.baseUrl}/editMessageText`;

    const data = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      data.reply_markup = JSON.stringify(replyMarkup);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('Error editing message:', error);
      return null;
    }
  }

  /**
   * Ответить на callback query
   */
  async answerCallback(callbackId, text = null, showAlert = false) {
    const url = `${this.baseUrl}/answerCallbackQuery`;

    const data = {
      callback_query_id: callbackId
    };

    if (text) {
      data.text = text;
      data.show_alert = showAlert;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('Error answering callback:', error);
      return null;
    }
  }

  /**
   * Получить информацию о файле
   */
  async getFile(fileId) {
    const url = `${this.baseUrl}/getFile`;

    const data = {
      file_id: fileId
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }

  /**
   * Скачать файл
   */
  async downloadFile(filePath) {
    const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;

    try {
      const response = await fetch(url);
      return await response.text();
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }
}

module.exports = TelegramApi;
