/**
 * StateManager класс для управления состояниями пользователей
 * Использует Netlify Blobs вместо JSON файла
 */
class StateManager {
  constructor(getStore) {
    this.getStore = getStore;
    this.storeName = 'kppbot';
    // In-memory кэш для решения проблемы eventual consistency
    this.cache = new Map();
  }

  /**
   * Получить store для работы с Blobs
   */
  _getStore() {
    return this.getStore({ name: this.storeName, consistency: 'eventual' });
  }

  /**
   * Получить состояние пользователя
   */
  async getState(userId) {
    // Сначала проверяем кэш
    if (this.cache.has(userId)) {
      return this.cache.get(userId);
    }

    const store = this._getStore();
    const data = await store.get(`state:${userId}`);

    if (!data) {
      return null;
    }

    const state = JSON.parse(data);

    // Проверяем, не устарело ли состояние (старше 1 часа)
    const stateAge = Date.now() - new Date(state.timestamp).getTime();
    if (stateAge > 3600000) { // 1 час в миллисекундах
      await this.clearState(userId);
      return null;
    }

    // Кэшируем состояние
    this.cache.set(userId, state);

    return state;
  }

  /**
   * Установить состояние пользователя
   */
  async setState(userId, state, data = {}) {
    const store = this._getStore();

    const stateData = {
      state,
      data,
      timestamp: new Date().toISOString()
    };

    await store.set(`state:${userId}`, JSON.stringify(stateData));

    // Обновляем кэш сразу после записи
    this.cache.set(userId, stateData);

    // Увеличенная задержка для eventual consistency
    // Даем Blobs больше времени на репликацию данных
    await new Promise(resolve => setTimeout(resolve, 200));

    // Очищаем старые состояния
    await this._cleanOldStates();
  }

  /**
   * Обновить данные состояния
   */
  async updateStateData(userId, key, value) {
    const currentState = await this.getState(userId);

    if (!currentState) {
      return;
    }

    currentState.data[key] = value;
    await this.setState(userId, currentState.state, currentState.data);
  }

  /**
   * Очистить состояние пользователя
   */
  async clearState(userId) {
    const store = this._getStore();
    await store.delete(`state:${userId}`);

    // Удаляем из кэша
    this.cache.delete(userId);
  }

  /**
   * Очистить старые состояния (приватный метод)
   * Вызывается периодически при установке нового состояния
   */
  async _cleanOldStates() {
    // Эта операция может быть дорогой, поэтому выполняем её не каждый раз
    // В Netlify Blobs нет прямого способа получить все ключи с префиксом,
    // поэтому полагаемся на TTL состояний при чтении (проверка в getState)

    // Альтернативный подход: можно вести индекс состояний,
    // но для простоты используем проверку при чтении
  }

  /**
   * Установить состояние с данными в самом ключе (для избежания eventual consistency)
   * Вместо хранения данных в Blobs, кодируем их в ключ состояния
   */
  async setStateWithData(userId, state, data) {
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64');
    const stateKey = `${state}:${encoded}`;

    console.log(`[StateManager] Setting state with data for user ${userId}:`, state);

    // Сохраняем минимальный флаг в Blobs, данные в ключе
    await this.setState(userId, stateKey, {});
  }

  /**
   * Извлечь данные из ключа состояния
   * Возвращает декодированные данные или null
   */
  extractDataFromState(stateKey) {
    if (!stateKey || !stateKey.includes(':')) {
      return null;
    }

    const parts = stateKey.split(':');
    if (parts.length < 2) return null;

    // Берем все части после первого : (на случай если в данных есть :)
    const encoded = parts.slice(1).join(':');

    try {
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());
      console.log(`[StateManager] Extracted data from state:`, decoded);
      return decoded;
    } catch (e) {
      console.error(`[StateManager] Failed to extract data from state:`, e.message);
      return null;
    }
  }
}

module.exports = StateManager;
