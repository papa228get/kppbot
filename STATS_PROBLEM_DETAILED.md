# Проблема с обновлением статистики - Детальный анализ

## Дата: 2026-05-03

## Описание проблемы

**Симптомы:**
- После удаления автомобиля статистика показывает старые данные
- Статистика обновляется **только при повторном заходе** (со второго раза)
- Список автомобилей обновляется мгновенно после удаления

**Важное наблюдение:**
1. Удаляешь автомобиль → открываешь статистику → показывает старое значение
2. Закрываешь статистику → снова открываешь → показывает новое значение
3. Если подождать 5-10 секунд и открыть статистику первый раз → всё равно старое значение
4. Список автомобилей после удаления показывает актуальные данные сразу

## Архитектура

### Почему список работает:
```javascript
// VehicleActionCallbackHandler.js:95-104
async handleConfirmDelete(data, chatId, messageId, callbackId) {
  const plateNumber = data.split(':')[1];
  await this.vehicleService.removeVehicle(plateNumber); // Удаление
  
  // Сразу в ТОМ ЖЕ Lambda запросе показываем список
  const paginationData = await this.vehicleService.getVehiclesList(1, 5);
  const listData = VehicleFormatter.formatInteractiveList(paginationData);
  await this.telegram.edit(chatId, messageId, listData.text, listData.keyboard);
}
```
- Удаление и показ списка в **одном Lambda запросе**
- Используется **один экземпляр Database** с локальным кэшем индекса
- `getVehiclesList()` читает из `indexCache`, который был обновлён при удалении

### Почему статистика НЕ работает:
```javascript
// Запрос 1: Удаление автомобиля
await this.vehicleService.removeVehicle(plateNumber);
// → обновляет индекс в Blobs
// → пересчитывает статистику и сохраняет в Blobs

// Запрос 2: Клик "Статистика" (НОВЫЙ Lambda запрос)
// → НОВЫЙ экземпляр Database
// → локальный кэш пустой
// → читает данные из Blobs
// → ??? показывает старые данные ???
```

## Что уже пробовали (НЕ ПОМОГЛО)

### 1. Локальный кэш статистики (НЕ работает)
- Добавили `statsCache` и `statsCacheTime` в CacheManager
- **Проблема:** локальный кэш пустой в новом Lambda запросе

### 2. Уменьшение TTL кэша статистики в Blobs
- Уменьшили с 5 минут до 15 секунд
- **Проблема:** не решает проблему, статистика всё равно обновляется только со второго раза

### 3. Метод `getStatsRealtime()` с пересчётом на лету
```javascript
// StatsCalculator.js
async calculateStatsOnTheFly(getIndexFn, getVehicleFn) {
  const allPlates = await getIndexFn();
  const vehicles = [];
  for (const plate of allPlates) {
    const vehicle = await getVehicleFn(plate);
    if (vehicle) vehicles.push(vehicle);
  }
  return this.calculateStats(vehicles);
}

// Database index.js
async getStatsRealtime() {
  return await this.statsCalculator.calculateStatsOnTheFly(
    async () => await this.indexManager.getIndex(),
    async (plate) => await this.vehicleRepository.findVehicle(plate)
  );
}
```
- **Проблема:** `getIndex()` читает индекс из Blobs с eventual consistency → старые данные

### 4. Метод `getIndexStrong()` с strong consistency
```javascript
// IndexManager.js
async getIndexStrong() {
  const store = this.getStore({ name: this.storeName, consistency: 'strong' });
  const indexData = await store.get('vehicles:index');
  return indexData ? JSON.parse(indexData) : [];
}
```
- **Проблема:** бот перестал реагировать на все колбеки из главного меню
- **Откатили**

### 5. Метод `getAllVehiclesDirect()` с `store.list()`
```javascript
// VehicleRepository.js
async getAllVehiclesDirect() {
  const store = this._getStore();
  const { blobs } = await store.list({ prefix: 'vehicle:' });
  
  const vehicles = [];
  for (const blob of blobs) {
    const data = await store.get(blob.key);
    if (data) vehicles.push(JSON.parse(data));
  }
  return vehicles;
}

// Database index.js
async getStatsRealtime() {
  const vehicles = await this.vehicleRepository.getAllVehiclesDirect();
  return this.statsCalculator.calculateStats(vehicles);
}
```
- **Проблема:** статистика всё равно обновляется только со второго раза
- `store.list()` тоже использует eventual consistency

### 6. Strong consistency в `getAllVehiclesDirect()`
```javascript
async getAllVehiclesDirect() {
  const store = this.getStore({ name: this.storeName, consistency: 'strong' });
  // ...
}
```
- **Проблема:** бот снова перестал реагировать на колбеки
- **Откатили**

### 7. Добавление времени обновления в текст статистики
```javascript
// StatsFormatter.js
const now = new Date();
const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
text += `<i>Обновлено: ${timeStr}</i>`;
```
- Цель: обойти кэш Telegram (если он кэширует сообщения с одинаковым текстом)
- **Проблема:** не помогло, статистика всё равно обновляется только со второго раза

## Текущее состояние кода

### Файлы с изменениями:

1. **src/core/database/StatsCalculator.js**
   - Добавлен метод `calculateStatsOnTheFly()`

2. **src/core/database/IndexManager.js**
   - Добавлен метод `getIndexStrong()` (не используется)

3. **src/core/database/VehicleRepository.js**
   - Добавлен метод `getAllVehiclesDirect()` с `store.list()`

4. **src/core/database/index.js**
   - Добавлен метод `getStatsRealtime()` который использует `getAllVehiclesDirect()`

5. **src/services/vehicleService.js**
   - Добавлен метод `getStatsRealtime()`

6. **src/handlers/callbacks/MenuCallbackHandler.js**
   - `handleMenuStats()` использует `getStatsRealtime()` вместо `getStats()`

7. **src/handlers/commandHandler.js**
   - `handleStats()` использует `getStatsRealtime()` вместо `getStats()`

8. **src/formatters/statsFormatter.js**
   - Добавлено время обновления в конец сообщения

### Коммиты:
```
5388a7a Откат strong consistency - ломает колбеки
6b72e1f Использование strong consistency в getAllVehiclesDirect
cb73b35 Добавлено время обновления в статистику для обхода кэша Telegram
a7c8302 Чтение автомобилей напрямую из Blobs для realtime статистики
e494750 Упрощение getStatsRealtime - использование getAllVehicles напрямую
df21569 Использование strong consistency для индекса в realtime статистике
b897ae2 Исправлена проблема с обновлением статистики после удаления
```

## Гипотезы (не проверены)

### Гипотеза 1: Netlify Blobs кэширует на уровне CDN
- Первый запрос после изменения возвращает старые данные из CDN кэша
- Второй запрос "прогревает" кэш и возвращает свежие данные
- **Как проверить:** посмотреть логи Netlify Functions, вывести что возвращает `store.list()` и `store.get()`

### Гипотеза 2: Проблема в Netlify Functions cold start
- При холодном старте Lambda что-то инициализируется неправильно
- **Как проверить:** добавить логирование в начало функции

### Гипотеза 3: Eventual consistency работает странно
- Первое чтение после записи всегда возвращает старые данные
- Второе чтение возвращает новые данные
- **Как проверить:** написать в поддержку Netlify

### Гипотеза 4: Проблема в самом коде
- Где-то используется старый метод `getStats()` вместо `getStatsRealtime()`
- Где-то кэшируется результат
- **Как проверить:** добавить console.log во все методы цепочки вызовов

## Что НЕ пробовали

1. **Добавить логирование** в Netlify Functions для отладки
   - Вывести что возвращает `store.list()`
   - Вывести количество автомобилей на каждом этапе
   - Посмотреть логи в Netlify Dashboard

2. **Использовать другое хранилище** для статистики
   - Redis/Memcached (требует платный план)
   - Хранить статистику в переменных окружения (не подходит)

3. **Отказаться от кэширования статистики** полностью
   - Всегда пересчитывать на лету
   - Принять задержку 2-3 секунды как нормальное поведение

4. **Изменить UX** — показывать статистику сразу после удаления
   - После удаления автомобиля показывать не список, а статистику
   - Тогда статистика будет в том же запросе и будет актуальной

## Важные замечания

1. **Strong consistency ломает колбеки** — при использовании `consistency: 'strong'` бот перестаёт реагировать на кнопки главного меню. Причина неизвестна.

2. **Список работает, статистика нет** — это ключевое наблюдение. Разница только в том, что список показывается в том же запросе где происходит удаление.

3. **Статистика обновляется со второго раза** — это очень странное поведение. Не eventual consistency (там была бы задержка по времени), а именно "со второго раза".

4. **Время ожидания не помогает** — даже если подождать 5-10 секунд после удаления, первое открытие статистики всё равно показывает старые данные.

## Рекомендации для следующего агента

1. **Не пытаться использовать strong consistency** — это ломает колбеки
2. **Добавить детальное логирование** — вывести в console.log что возвращает каждый метод
3. **Проверить логи в Netlify Dashboard** — возможно там есть ошибки или предупреждения
4. **Рассмотреть изменение UX** — показывать статистику сразу после удаления вместо списка
5. **Связаться с поддержкой Netlify** — спросить про поведение eventual consistency

## Текущий статус

- Бот работает
- Все функции работают
- Статистика обновляется, но только со второго раза
- Код задеплоен на Netlify
- Последний коммит: `5388a7a Откат strong consistency - ломает колбеки`
