# Проблема: Статистика не обновляется после удаления автомобилей

## Дата: 2026-05-03

## Описание проблемы

После удаления автомобилей (как розничного, так и массового через /fulldel) статистика не обновляется мгновенно. При переходе в раздел "Статистика" бот показывает старые данные до удаления.

## Что уже сделано

### 1. Локальный кэш индекса (работает ✅)
- Добавлен `indexCache` и `indexCacheTime` в Database
- TTL 30 секунд
- Обновляется после всех операций с индексом
- **Результат:** список автомобилей обновляется мгновенно после удаления

### 2. Локальный кэш статистики (НЕ работает ❌)
- Добавлен `statsCache` и `statsCacheTime` в Database
- TTL 30 секунд
- Обновляется в:
  - `_recalculateStats()` (вызывается после `removeVehicle()`)
  - `clearAllData()`
  - `addVehiclesBatch()`
- **Результат:** статистика всё равно показывает старые данные

### 3. Пересчёт статистики после операций
- `removeVehicle()` вызывает `_recalculateStats()`
- `clearAllData()` устанавливает нулевую статистику и обновляет кэш
- `addVehiclesBatch()` пересчитывает статистику после импорта

## Текущая реализация

### database.js
```javascript
class Database {
  constructor(getStore) {
    this.getStore = getStore;
    this.storeName = 'kppbot';
    // Локальный кэш индекса (работает)
    this.indexCache = null;
    this.indexCacheTime = null;
    // Локальный кэш статистики (не работает)
    this.statsCache = null;
    this.statsCacheTime = null;
  }

  async getStats() {
    // Проверяем локальный кэш (30 секунд)
    const now = Date.now();
    if (this.statsCache && this.statsCacheTime && (now - this.statsCacheTime) < 30000) {
      return this.statsCache;
    }

    // Читаем из Blobs кэша
    const store = this._getStore();
    const cachedStats = await store.get('vehicles:stats');
    if (cachedStats) {
      const stats = JSON.parse(cachedStats);
      const cacheAge = Date.now() - new Date(stats.cached_at).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        this.statsCache = stats.data;
        this.statsCacheTime = now;
        return stats.data;
      }
    }

    // Пересчитываем
    const vehicles = await this.getAllVehicles();
    const stats = {
      total: vehicles.length,
      allowed: vehicles.filter(v => v.access_status === 'allowed').length,
      denied: vehicles.filter(v => v.access_status === 'denied').length,
      permanent: vehicles.filter(v => v.pass_type === 'permanent').length,
      temporary: vehicles.filter(v => v.pass_type === 'temporary').length
    };

    await store.set('vehicles:stats', JSON.stringify({
      data: stats,
      cached_at: new Date().toISOString()
    }));

    this.statsCache = stats;
    this.statsCacheTime = now;

    return stats;
  }

  async removeVehicle(plateNumber) {
    // ... удаление автомобиля ...
    await this._updateIndex(plateNumber, 'remove');
    await this._recalculateStats(); // Пересчитываем статистику
    return true;
  }

  async _recalculateStats() {
    // Пересчитываем статистику из индекса
    // Обновляем Blobs кэш
    // Обновляем локальный кэш
    this.statsCache = stats;
    this.statsCacheTime = Date.now();
  }
}
```

### callbackHandler.js
```javascript
if (data === 'menu_stats') {
  const stats = await this.vehicleService.getStats();
  const text = StatsFormatter.format(stats);
  // ... отправка сообщения ...
}
```

## Возможные причины

1. **Проблема с экземпляром Database**
   - Возможно создаётся новый экземпляр Database при каждом запросе
   - Локальный кэш теряется между запросами

2. **Eventual consistency в Netlify Blobs**
   - `_recalculateStats()` читает индекс из Blobs
   - Индекс может быть устаревшим из-за eventual consistency
   - Нужно использовать локальный `indexCache` вместо чтения из Blobs

3. **Проблема с Lambda холодным стартом**
   - При холодном старте Lambda создаётся новый экземпляр
   - Локальный кэш теряется

## Что нужно проверить

1. Как создаётся экземпляр Database в netlify/functions/webhook.js
2. Сохраняется ли экземпляр между запросами или создаётся новый
3. Использует ли `_recalculateStats()` локальный `indexCache` или читает из Blobs

## Следующие шаги

1. Проверить архитектуру создания экземпляров Database
2. Убедиться что `_recalculateStats()` использует `indexCache` вместо чтения из Blobs
3. Рассмотреть альтернативные подходы:
   - Хранить статистику в отдельном ключе с версионированием
   - Использовать Redis/Memcached для кэша между Lambda вызовами
   - Пересчитывать статистику на клиенте из списка автомобилей

## Файлы для проверки

- `netlify/functions/webhook.js` — точка входа, создание экземпляров
- `src/core/database.js` — реализация кэширования
- `src/services/vehicleService.js` — проброс методов
- `src/handlers/callbackHandler.js` — вызов getStats()

## Тестовый сценарий

1. Добавить несколько автомобилей через /import
2. Проверить статистику — должна показать правильное количество
3. Удалить 1 автомобиль через карточку
4. Сразу перейти в статистику
5. **Ожидается:** статистика уменьшилась на 1
6. **Фактически:** статистика показывает старое значение

## Логи для отладки

Добавить console.log в:
- `getStats()` — какой кэш используется (локальный/Blobs/пересчёт)
- `_recalculateStats()` — какие данные пересчитываются
- `removeVehicle()` — вызывается ли `_recalculateStats()`
