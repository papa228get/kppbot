const { getStore, connectLambda } = require('@netlify/blobs');
const Database = require('../../src/core/database');
const StateManager = require('../../src/core/stateManager');
const TelegramApi = require('../../src/services/telegramApi');
const VehicleService = require('../../src/services/vehicleService');
const AccessChecker = require('../../src/services/accessChecker');
const ImportService = require('../../src/services/importService');
const CommandHandler = require('../../src/handlers/commandHandler');
const CallbackHandler = require('../../src/handlers/callbackHandler');
const StateHandler = require('../../src/handlers/stateHandler');
const MessageHandler = require('../../src/handlers/messageHandler');
const DocumentHandler = require('../../src/handlers/documentHandler');
const PlateValidator = require('../../src/validators/plateValidator');

/**
 * Netlify Function - Webhook для Telegram бота
 */
exports.handler = async (event, context) => {
  // Проверка метода
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Инициализация Netlify Blobs для Lambda compatibility mode
    connectLambda(event);

    // Парсинг update от Telegram
    const update = JSON.parse(event.body);
    console.log('Received update:', JSON.stringify(update, null, 2));

    // Инициализация зависимостей
    console.log('Initializing database...');
    const db = new Database(getStore);
    console.log('Initializing state manager...');
    const stateManager = new StateManager(getStore);
    const telegram = new TelegramApi(process.env.BOT_TOKEN);
    const vehicleService = new VehicleService(db);
    const accessChecker = new AccessChecker(db);
    const importService = new ImportService();

    // Инициализация обработчиков
    const commandHandler = new CommandHandler(telegram, vehicleService, stateManager);
    const callbackHandler = new CallbackHandler(telegram, vehicleService, stateManager);
    const stateHandler = new StateHandler(telegram, vehicleService, stateManager);
    const messageHandler = new MessageHandler(telegram, accessChecker, stateManager);
    const documentHandler = new DocumentHandler(telegram, importService, vehicleService, stateManager);

    // Связываем DocumentHandler с StateHandler для ImportStateHandler
    stateHandler.setDocumentHandler(documentHandler);

    // Обработка callback_query
    if (update.callback_query) {
      await callbackHandler.handle(update.callback_query);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    // Обработка message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';

      const isAdmin = PlateValidator.isAdmin(userId);
      const userState = await stateManager.getState(userId);

      // Команды /start и /cancel - они должны работать всегда
      if (text === '/start') {
        console.log('Processing /start command for user:', userId);
        if (userState && userState.state) {
          await telegram.send(chatId, '❌ Предыдущая операция отменена');
        }
        await stateManager.clearState(userId);
        console.log('Calling handleStart...');
        await commandHandler.handleStart(chatId, isAdmin);
        console.log('/start command completed');
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true })
        };
      }

      if (text === '/cancel') {
        await commandHandler.handleCancel(chatId, userId);
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true })
        };
      }

      // Если пользователь в процессе диалога
      if (userState && userState.state) {
        await stateHandler.handle(message, userState);
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true })
        };
      }

      // Обработка команд
      if (text.startsWith('/')) {
        const command = text.split(' ')[0];

        switch (command) {
          case '/help':
            await commandHandler.handleHelp(chatId, isAdmin);
            break;

          case '/add':
            await commandHandler.handleAdd(chatId, userId, isAdmin);
            break;

          case '/remove':
            await commandHandler.handleRemove(chatId, userId, text, isAdmin);
            break;

          case '/list':
            await commandHandler.handleList(chatId, isAdmin);
            break;

          case '/import':
            await commandHandler.handleImport(chatId, userId, isAdmin);
            break;

          case '/fulldel':
            await commandHandler.handleFullDelete(chatId, isAdmin);
            break;

          default:
            await telegram.send(chatId, '❓ Неизвестная команда. Используйте /help для справки.');
            break;
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true })
        };
      }

      // Обработка обычного текста как номера автомобиля
      // Перепроверяем состояние на случай eventual consistency
      const finalState = await stateManager.getState(userId);
      if (finalState && finalState.state) {
        // Если состояние появилось, обрабатываем через stateHandler
        await stateHandler.handle(message, finalState);
      } else {
        // Иначе обрабатываем как проверку номера
        await messageHandler.handlePlateNumber(chatId, userId, text);
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    // Если ничего не обработано
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (error) {
    console.error('Error processing update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
