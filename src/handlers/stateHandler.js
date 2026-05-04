const AddVehicleStateHandler = require('./states/AddVehicleStateHandler');
const EditVehicleStateHandler = require('./states/EditVehicleStateHandler');
const ImportStateHandler = require('./states/ImportStateHandler');
const AddOnelineStateHandler = require('./states/AddOnelineStateHandler');
const SearchStateHandler = require('./states/SearchStateHandler');

/**
 * StateHandler - главный диспетчер состояний пользователей
 * Делегирует обработку в специализированные обработчики
 */
class StateHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;
    this.documentHandler = null;

    // Инициализируем специализированные обработчики
    this.handlers = [
      new AddVehicleStateHandler(telegram, vehicleService, stateManager),
      new EditVehicleStateHandler(telegram, vehicleService, stateManager),
      new AddOnelineStateHandler(telegram, vehicleService, stateManager),
      new SearchStateHandler(telegram, vehicleService, stateManager)
      // ImportStateHandler будет добавлен после установки documentHandler
    ];
  }

  /**
   * Установить DocumentHandler (для обработки импорта файлов)
   */
  setDocumentHandler(documentHandler) {
    this.documentHandler = documentHandler;
    // Добавляем ImportStateHandler после установки documentHandler
    this.handlers.push(new ImportStateHandler(this.telegram, this.stateManager, documentHandler));
  }

  /**
   * Обработать сообщение в зависимости от состояния
   */
  async handle(message, userState) {
    const state = userState.state;

    // Находим подходящий обработчик
    for (const handler of this.handlers) {
      if (handler.canHandle(state)) {
        await handler.handle(message, userState);
        return;
      }
    }

    // Если состояние не обработано ни одним обработчиком
    console.warn(`Unhandled state: ${state}`);
  }
}

module.exports = StateHandler;
