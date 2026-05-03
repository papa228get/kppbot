/**
 * DocumentHandler - обработка загруженных файлов
 */
class DocumentHandler {
  constructor(telegram, importService, vehicleService, stateManager) {
    this.telegram = telegram;
    this.importService = importService;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
  }

  /**
   * Обработать загруженный документ
   */
  async handleDocument(message, isAdmin) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const document = message.document;

    // Проверяем тип файла
    if (!document.file_name.endsWith('.txt')) {
      await this.telegram.send(chatId, '❌ Пожалуйста, отправьте текстовый файл (.txt)');
      return;
    }

    // Проверяем размер файла (максимум 5 МБ)
    if (document.file_size > 5 * 1024 * 1024) {
      await this.telegram.send(chatId, '❌ Файл слишком большой. Максимальный размер: 5 МБ');
      return;
    }

    await this.telegram.send(chatId, '⏳ Обработка файла...');

    try {
      // Получаем информацию о файле
      const fileInfo = await this.telegram.getFile(document.file_id);

      if (!fileInfo || !fileInfo.ok) {
        await this.telegram.send(chatId, '❌ Ошибка при получении файла');
        return;
      }

      // Скачиваем файл
      const fileContent = await this.telegram.downloadFile(fileInfo.result.file_path);

      if (!fileContent) {
        await this.telegram.send(chatId, '❌ Ошибка при скачивании файла');
        return;
      }

      // Парсим файл
      const parseResult = this.importService.parseImportFile(fileContent);

      if (parseResult.vehicles.length === 0) {
        await this.telegram.send(chatId, '❌ Не удалось распарсить ни одной записи. Проверьте формат файла.');
        return;
      }

      // Импортируем автомобили
      const importStats = await this.importService.importVehicles(parseResult.vehicles, this.vehicleService);

      // Формируем отчет
      const report = this.importService.formatImportReport(parseResult, importStats);

      await this.telegram.send(chatId, report);

      // Очищаем состояние после успешного импорта
      await this.stateManager.clearState(userId);

      // Отправляем главное меню
      const KeyboardBuilder = require('../ui/keyboardBuilder');
      const keyboard = KeyboardBuilder.buildMainMenu(isAdmin);
      await this.telegram.send(chatId, 'Главное меню', keyboard);
    } catch (error) {
      console.error('Error handling document:', error);
      await this.telegram.send(chatId, '❌ Ошибка при обработке файла: ' + error.message);

      // Очищаем состояние даже при ошибке
      await this.stateManager.clearState(userId);
    }
  }
}

module.exports = DocumentHandler;
