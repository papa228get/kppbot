const MenuCallbackHandler = require('./callbacks/MenuCallbackHandler');
const ListCallbackHandler = require('./callbacks/ListCallbackHandler');
const VehicleEditCallbackHandler = require('./callbacks/VehicleEditCallbackHandler');
const VehicleActionCallbackHandler = require('./callbacks/VehicleActionCallbackHandler');
const NavigationCallbackHandler = require('./callbacks/NavigationCallbackHandler');

/**
 * CallbackHandler - главный диспетчер callback запросов
 * Делегирует обработку в специализированные обработчики
 */
class CallbackHandler {
  constructor(telegram, vehicleService, stateManager) {
    this.telegram = telegram;
    this.vehicleService = vehicleService;
    this.stateManager = stateManager;

    // Инициализируем специализированные обработчики
    this.handlers = [
      new MenuCallbackHandler(telegram, vehicleService, stateManager),
      new ListCallbackHandler(telegram, vehicleService, stateManager),
      new VehicleEditCallbackHandler(telegram, vehicleService, stateManager),
      new VehicleActionCallbackHandler(telegram, vehicleService, stateManager),
      new NavigationCallbackHandler(telegram, vehicleService, stateManager)
    ];
  }

  /**
   * Обработать callback query
   */
  async handle(callbackQuery) {
    const data = callbackQuery.data;

    // Находим подходящий обработчик
    for (const handler of this.handlers) {
      if (handler.canHandle(data)) {
        await handler.handle(callbackQuery);
        return;
      }
    }

    // Если callback не обработан ни одним обработчиком
    await this.telegram.answerCallback(callbackQuery.id);
  }
}

module.exports = CallbackHandler;
