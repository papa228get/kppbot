# Инструкция по развёртыванию

## 📋 Новая структура проекта

После реорганизации проект имеет следующую структуру:

```
kppbot/
├── bin/              # Утилиты и скрипты
├── config/           # Конфигурация
├── public/           # Публичная директория (веб-корень)
├── storage/          # Данные (БД, логи, состояния)
├── docs/             # Документация
├── src/              # Исходный код
├── bootstrap.php     # Autoloader
└── requirements.txt  # Зависимости
```

## 🚀 Развёртывание на хостинге

### Вариант 1: С настройкой веб-корня (Рекомендуется)

Если ваш хостинг позволяет настроить веб-корень (document root):

1. **Загрузите все файлы** на хостинг
2. **Настройте веб-корень** на директорию `public/`
3. **Настройте webhook URL**: `https://your-domain.com/webhook.php`
4. **Запустите**: `php bin/setWebhook.php`

**Преимущества:**
- ✅ Максимальная безопасность
- ✅ Конфигурация и данные недоступны через веб
- ✅ Соответствует best practices

### Вариант 2: Без настройки веб-корня (InfinityFree и подобные)

Если хостинг не позволяет изменить веб-корень:

1. **Загрузите все файлы** в `htdocs/` или `public_html/`
2. **Корневой .htaccess** автоматически перенаправит запросы в `public/`
3. **Настройте webhook URL**: `https://your-domain.com/webhook.php`
4. **Запустите**: `php bin/setWebhook.php`

**Как это работает:**
- Корневой `.htaccess` перенаправляет все запросы в `public/`
- `public/.htaccess` разрешает доступ только к `webhook.php`
- Все остальные директории защищены

## ⚙️ Настройка

### 1. Конфигурация

Отредактируйте `config/config.php`:

```php
// Токен бота от @BotFather
define('BOT_TOKEN', 'YOUR_BOT_TOKEN');

// ID администраторов
define('ADMIN_IDS', [123456789]);
```

### 2. Установка webhook

```bash
# Через браузер
https://your-domain.com/bin/setWebhook.php

# Или через CLI
php bin/setWebhook.php
```

### 3. Установка команд бота

```bash
# Через браузер
https://your-domain.com/bin/setCommands.php

# Или через CLI
php bin/setCommands.php
```

## 🔒 Безопасность

### Что защищено:

1. **Конфигурация** (`config/`) - недоступна через веб
2. **База данных** (`storage/database/`) - недоступна через веб
3. **Исходный код** (`src/`) - недоступен через веб
4. **Логи** (`storage/logs/`) - недоступны через веб
5. **Состояния** (`storage/states/`) - недоступны через веб

### Проверка безопасности:

Попробуйте открыть в браузере:
- ❌ `https://your-domain.com/config/config.php` - должен быть 403
- ❌ `https://your-domain.com/src/core/Database.php` - должен быть 403
- ❌ `https://your-domain.com/storage/database/kpp.db` - должен быть 403
- ✅ `https://your-domain.com/webhook.php` - должен работать

## 📁 Структура директорий

### `bin/` - Утилиты
- `setWebhook.php` - установка webhook
- `setCommands.php` - установка команд бота

### `config/` - Конфигурация
- `config.php` - основная конфигурация

### `public/` - Публичная директория
- `webhook.php` - точка входа для Telegram
- `.htaccess` - правила доступа

### `storage/` - Данные
- `database/` - SQLite база данных
- `logs/` - логи приложения
- `states/` - состояния пользователей

### `src/` - Исходный код
- `core/` - ядро (Database, StateManager)
- `handlers/` - обработчики событий
- `services/` - бизнес-логика
- `formatters/` - форматирование данных
- `validators/` - валидация
- `ui/` - UI компоненты

### `docs/` - Документация
- `README.md` - основная документация
- `REFACTORING_REPORT.md` - отчёт о рефакторинге
- `REORGANIZATION_PLAN.md` - план реорганизации

## 🔧 Устранение неполадок

### Бот не отвечает

1. Проверьте webhook:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```

2. Проверьте права на файлы:
   ```bash
   chmod 755 public/
   chmod 644 public/webhook.php
   chmod 755 storage/
   chmod 666 storage/database/kpp.db
   chmod 666 storage/states/user_states.json
   ```

3. Проверьте логи хостинга

### Ошибка "File not found"

Убедитесь, что:
- Все файлы загружены
- Пути в `bootstrap.php` корректны
- `.htaccess` файлы на месте

### Ошибка "Database locked"

Проверьте права на запись:
```bash
chmod 666 storage/database/kpp.db
chmod 777 storage/database/
```

## 📝 Миграция с предыдущей версии

Если у вас уже была установлена старая версия:

1. **Сделайте бэкап** базы данных:
   ```bash
   cp kpp.db kpp.db.backup
   ```

2. **Загрузите новые файлы** на хостинг

3. **Переместите базу данных**:
   ```bash
   mv kpp.db storage/database/
   ```

4. **Обновите webhook**:
   ```bash
   php bin/setWebhook.php
   ```

## ✅ Проверка работоспособности

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Проверьте, что бот отвечает

Если всё работает - развёртывание успешно! 🎉

---

**Дата создания:** 2026-05-03  
**Версия:** 3.0
