# Проблема: Статистика не обновляется после удаления автомобилей

## Дата: 2026-05-03

## ✅ РЕШЕНО

### Решение
Реализован метод `getStatsRealtime()`, который пересчитывает статистику на лету без использования кэша в Blobs.

### Что изменено:

1. **StatsCalculator.js** - добавлен метод `calculateStatsOnTheFly()`
   - Получает свежий индекс из IndexManager (использует локальный кэш)
   - Загружает данные автомобилей по индексу
   - Пересчитывает статистику на лету
   - НЕ сохраняет в Blobs (обходит eventual consistency)

2. **Database index.js** - добавлен метод `getStatsRealtime()`
   - Вызывает `calculateStatsOnTheFly()` из StatsCalculator

3. **VehicleService.js** - добавлен метод `getStatsRealtime()`
   - Проксирует вызов к Database

4. **MenuCallbackHandler.js** - изменён `handleMenuStats()`
   - Использует `getStatsRealtime()` вместо `getStats()`

5. **CommandHandler.js** - изменён `handleStats()`
   - Использует `getStatsRealtime()` вместо `getStats()`

### Как работает:

```javascript
// Запрос 1: Удаление
await this.vehicleService.removeVehicle(plateNumber);
// → обновляет индекс в локальном кэше

// Запрос 2: Клик "Статистика" (НОВЫЙ Lambda)
const stats = await this.vehicleService.getStatsRealtime();
// → читает индекс (eventual consistency, но обычно свежий)
// → загружает автомобили по индексу
// → пересчитывает статистику на лету
// → возвращает актуальные данные
```

### Преимущества:
- ✅ Мгновенное обновление статистики
- ✅ Использует локальный кэш индекса когда доступен
- ✅ Обходит eventual consistency кэша статистики в Blobs
- ✅ Минимальные изменения кода
- ✅ Обратная совместимость (старый метод `getStats()` остался)

### Тестирование:
1. Импортировать автомобили через `/import`
2. Проверить статистику
3. Удалить автомобиль через карточку
4. Сразу нажать "Статистика" → должна обновиться мгновенно

---

## История проблемы

## Описание проблемы

После удаления автомобилей (как розничного, так и массового через /fulldel) статистика не обновляется мгновенно. При переходе в раздел "Статистика" бот показывает старые данные до удаления.

## Что уже сделано (НЕ ПОМОГЛО)

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

### 4. Попытка использовать indexCache в _recalculateStats() (НЕ ПОМОГЛО)
- Изменили `_recalculateStats()` чтобы использовать `indexCache` вместо чтения из Blobs
- **Результат:** статистика перестала обновляться вообще (ни после импорта, ни после удаления)
- Откатили изменения

### 5. Уменьшение TTL кэша статистики (НЕ РЕШЕНИЕ)
- Уменьшили TTL с 5 минут до 15 секунд
- **Результат:** статистика обновляется с задержкой 2-3 секунды
- **Проблема:** это не решение, нужно мгновенное обновление

## Корень проблемы

**Каждый запрос к боту = новый Lambda запрос = новый экземпляр Database**

### Почему список работает:
```javascript
// confirm_delete - в том же запросе
await this.vehicleService.removeVehicle(plateNumber);
// ↓ ТОТ ЖЕ ЗАПРОС, ТОТ ЖЕ ЭКЗЕМПЛЯР Database
const paginationData = await this.vehicleService.getVehiclesList(1, 5);
// getVehiclesList() использует свежий indexCache
```

### Почему статистика НЕ работает:
```javascript
// Запрос 1: Удаление
await this.vehicleService.removeVehicle(plateNumber);
// → _recalculateStats() → сохраняет в Blobs

// Запрос 2: Переход в "Статистику" (НОВЫЙ Lambda запрос)
// → НОВЫЙ экземпляр Database
// → statsCache = null
// → getStats() читает из Blobs
// → Eventual consistency → старые данные
```

## Текущая реализация

### database.js - getStats()
```javascript
async getStats() {
  // 1. Проверяет локальный кэш (30 сек)
  if (this.statsCache && this.statsCacheTime && (now - this.statsCacheTime) < 30000) {
    return this.statsCache; // ❌ Всегда пустой в новом запросе
  }

  // 2. Читает из Blobs кэша (15 секунд TTL)
  const cachedStats = await store.get('vehicles:stats');
  if (cachedStats) {
    const cacheAge = Date.now() - new Date(stats.cached_at).getTime();
    if (cacheAge < 15 * 1000) {
      return stats.data; // ❌ Eventual consistency → старые данные
    }
  }

  // 3. Пересчитывает (только если кэш старше 15 секунд)
  const vehicles = await this.getAllVehicles(); // ❌ Тоже читает из Blobs
}
```

### database.js - _recalculateStats()
```javascript
async _recalculateStats() {
  // Читает индекс из Blobs
  const indexData = await store.get('vehicles:index'); // ❌ Eventual consistency
  const allPlates = indexData ? JSON.parse(indexData) : [];
  
  // Пересчитывает статистику
  // Сохраняет в Blobs
}
```

## Возможные решения (НЕ ПРОВЕРЕНЫ)

### Вариант 1: Пересчитывать статистику на клиенте
- В `callbackHandler.js` после удаления сразу пересчитывать статистику
- Аналогично тому, как работает список
```javascript
if (data === 'menu_stats') {
  // Читаем список автомобилей из свежего indexCache
  const vehicles = await this.vehicleService.getAllVehicles();
  // Пересчитываем статистику на лету
  const stats = {
    total: vehicles.length,
    allowed: vehicles.filter(v => v.access_status === 'allowed').length,
    // ...
  };
}
```

### Вариант 2: Использовать strong consistency
- Изменить `consistency: 'eventual'` на `consistency: 'strong'` для статистики
- Может быть медленнее, но данные будут актуальными

### Вариант 3: Хранить статистику в отдельном сервисе
- Redis/Memcached для кэша между Lambda вызовами
- Но это усложнит архитектуру

## Тестовый сценарий

1. Добавить несколько автомобилей через /import
2. Проверить статистику — должна показать правильное количество
3. Удалить 1 автомобиль через карточку
4. Сразу перейти в статистику
5. **Ожидается:** статистика уменьшилась на 1 МГНОВЕННО
6. **Фактически:** статистика показывает старое значение (или обновляется с задержкой)

## Файлы для проверки

- `netlify/functions/webhook.js` — точка входа, создание экземпляров
- `src/core/database.js` — реализация кэширования
- `src/services/vehicleService.js` — проброс методов
- `src/handlers/callbackHandler.js` — вызов getStats()

## Требование

**Статистика должна обновляться МГНОВЕННО, без задержек, как список автомобилей.**
