const PlateValidator = require('../../validators/plateValidator');

/**
 * ImportStateHandler - обработка состояния импорта файла
 * Обрабатывает: awaiting_import_file
 */
class ImportStateHandler {
  constructor(telegram, stateManager, documentHandler) {
    this.telegram = telegram;
    this.stateManager = stateManager;
    this.documentHandler = documentHandler;
  }

  /**
   * Проверить, может ли этот обработчик обработать состояние
   */
  canHandle(state) {
    return state === 'awaiting_import_file';
  }

  /**
   * Обработать сообщение в зависимости от состояния
   */
  async handle(message, userState) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    if (message.document) {
      const PlateValidator = require('../../validators/plateValidator');
      const isAdmin = PlateValidator.isAdmin(userId);
      await this.documentHandler.handleDocument(message, isAdmin);
      await this.stateManager.clearState(userId);
    } else {
      await this.telegram.send(chatId, '❌ Пожалуйста, отправьте файл');
    }
  }
}

module.exports = ImportStateHandler;
