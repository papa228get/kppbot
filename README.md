# Telegram Бот для КПП (Node.js + Netlify)

Telegram-бот для контроля доступа автомобилей на КПП. Версия на Node.js для развертывания на Netlify.

## Возможности

- ✅ Проверка номера автомобиля по базе данных
- 🔐 Управление доступом (разрешен/запрещен)
- 📅 Поддержка временных и постоянных пропусков
- ⏰ Автоматическая проверка срока действия пропуска
- 👨‍💼 Административные команды для управления базой
- 📥 Массовый импорт автомобилей из файла
- ☁️ Serverless архитектура на Netlify
- 💾 Netlify Blobs для хранения данных

## Технологии

- **Node.js** 18+
- **Netlify Functions** (serverless)
- **Netlify Blobs** (key-value хранилище)
- **Telegram Bot API**

## Требования

- Аккаунт на [Netlify](https://netlify.com)
- Telegram бот токен от [@BotFather](https://t.me/BotFather)
- Node.js 18+ (для локальной разработки)

## Установка

### 1. Создайте Telegram бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям и получите токен бота
4. Сохраните токен - он понадобится позже

### 2. Получите ваш Telegram ID

1. Откройте [@userinfobot](https://t.me/userinfobot)
2. Отправьте любое сообщение
3. Бот вернет ваш ID - сохраните его

### 3. Клонируйте репозиторий

```bash
git clone <your-repo-url>
cd kppbot
```

### 4. Установите зависимости

```bash
npm install
```

### 5. Настройте переменные окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
BOT_TOKEN=your_bot_token_here
ADMIN_IDS=123456789,987654321
```

### 6. Разверните на Netlify

#### Вариант A: Через Netlify CLI (рекомендуется)

```bash
# Установите Netlify CLI глобально
npm install -g netlify-cli

# Войдите в аккаунт
netlify login

# Инициализируйте проект
netlify init

# Разверните
netlify deploy --prod
```

#### Вариант B: Через GitHub

1. Загрузите код в GitHub репозиторий
2. Зайдите на [Netlify](https://app.netlify.com)
3. Нажмите "Add new site" → "Import an existing project"
4. Выберите ваш GitHub репозиторий
5. Netlify автоматически определит настройки из `netlify.toml`
6. Нажмите "Deploy site"

### 7. Настройте переменные окружения в Netlify

1. Откройте ваш сайт в Netlify Dashboard
2. Перейдите в **Site settings** → **Environment variables**
3. Добавьте переменные:
   - `BOT_TOKEN` - токен вашего бота
   - `ADMIN_IDS` - ID администраторов через запятую (например: `123456789,987654321`)

### 8. Установите webhook

После развертывания получите URL вашего сайта (например: `https://your-site.netlify.app`)

Установите webhook через curl:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-site.netlify.app/webhook"}'
```

Или откройте в браузере:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-site.netlify.app/webhook
```

Проверьте webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 9. Готово!

Откройте вашего бота в Telegram и отправьте `/start`

## Использование

### Для охранников (обычные пользователи)

Просто отправьте номер автомобиля боту:
```
А123БВ
```

Бот ответит:
- ✅ **ПРОПУСТИТЬ** - если автомобиль разрешен
- ⛔ **НЕ ПРОПУСКАТЬ** - если запрещен
- ❌ **Автомобиль не найден** - если номера нет в базе

### Для администраторов

Используйте кнопки главного меню:

- **📋 Список** - просмотр всех автомобилей с пагинацией
- **📥 Импорт** - массовый импорт автомобилей из файла
- **📊 Статистика** - статистика по базе данных
- **ℹ️ Справка** - справка по использованию

#### Команды

- `/start` - Главное меню
- `/help` - Справка
- `/import` - Массовый импорт из файла
- `/remove НОМЕР` - Удалить автомобиль
- `/list` - Показать все автомобили
- `/stats` - Показать статистику
- `/cancel` - Отменить текущую операцию

#### Массовый импорт

Для загрузки большого количества автомобилей:

1. Подготовьте текстовый файл (.txt) в формате TAB-разделённых значений
2. Отправьте команду `/import`
3. Отправьте файл боту
4. Получите отчёт о результатах импорта

**Формат файла:**
```
Марка	Номер	Тип_пропуска	Дата
Лада Приора	В 782 РХ 12	Постоянный	31.12.2026
КИА Серато	Н 122 АМ 73	Временный	15.06.2026
```

## Архитектура

```
kppbot/
├── netlify/
│   └── functions/
│       └── webhook.js        # Точка входа (Netlify Function)
├── src/
│   ├── core/
│   │   ├── database.js       # Работа с Netlify Blobs
│   │   └── stateManager.js   # Управление состояниями
│   ├── services/
│   │   ├── telegramApi.js    # Telegram Bot API
│   │   ├── vehicleService.js # Бизнес-логика автомобилей
│   │   ├── accessChecker.js  # Проверка доступа
│   │   └── importService.js  # Импорт из файлов
│   ├── handlers/
│   │   ├── commandHandler.js # Обработка команд
│   │   ├── callbackHandler.js# Обработка callback'ов
│   │   ├── stateHandler.js   # Обработка состояний
│   │   ├── messageHandler.js # Обработка сообщений
│   │   └── documentHandler.js# Обработка файлов
│   ├── formatters/           # Форматирование данных
│   ├── validators/           # Валидация данных
│   └── ui/                   # UI компоненты
├── php-legacy/               # Старая PHP версия (для справки)
├── package.json
├── netlify.toml
└── README.md
```

## Структура данных (Netlify Blobs)

**Ключи:**
- `vehicle:{plate_number}` → JSON объект автомобиля
- `vehicles:index` → массив всех номеров
- `vehicles:stats` → кэш статистики
- `state:{user_id}` → состояние пользователя

**Пример объекта автомобиля:**
```json
{
  "plate_number": "А123БВ",
  "brand": "Лада Приора",
  "access_status": "allowed",
  "pass_type": "permanent",
  "expiry_date": null,
  "notes": "",
  "created_at": "2026-05-03T00:00:00.000Z"
}
```

## Локальная разработка

```bash
# Установите зависимости
npm install

# Запустите локальный сервер Netlify
npm run dev

# Бот будет доступен на http://localhost:8888
```

Для тестирования webhook локально используйте [ngrok](https://ngrok.com/):

```bash
# Запустите ngrok
ngrok http 8888

# Установите webhook на ngrok URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-ngrok-url.ngrok.io/webhook"
```

## Безопасность

- ✅ Только администраторы могут управлять базой данных
- ✅ ID администраторов хранятся в переменных окружения
- ✅ Данные хранятся в защищенном Netlify Blobs
- ✅ Валидация и нормализация всех входных данных
- ✅ Serverless архитектура - нет постоянно работающего сервера

## Ограничения Netlify

- **Netlify Blobs Free tier:** 100 GB хранилища, 1M операций/месяц
- **Netlify Functions Free tier:** 125K запросов/месяц, 100 часов выполнения
- **Размер функции:** до 50 MB
- **Timeout функции:** 10 секунд (может быть увеличен на платных планах)

Для большинства случаев использования бота этих лимитов более чем достаточно.

## Миграция с PHP версии

Если у вас уже есть данные в SQLite из PHP версии:

1. Экспортируйте данные из SQLite в CSV/JSON
2. Конвертируйте в формат импорта (TAB-разделенный)
3. Используйте команду `/import` для загрузки данных

Скрипт для экспорта из SQLite:

```bash
sqlite3 storage/database/kpp.db <<EOF
.mode tabs
.headers off
.output export.txt
SELECT brand, plate_number, 
  CASE WHEN pass_type = 'permanent' THEN 'Постоянный' ELSE 'Временный' END,
  COALESCE(expiry_date, '')
FROM vehicles;
.quit
EOF
```

## Устранение неполадок

### Бот не отвечает

1. Проверьте webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Проверьте переменные окружения в Netlify Dashboard
3. Проверьте логи функций в Netlify Dashboard → Functions

### Ошибки в Netlify Functions

1. Откройте Netlify Dashboard → Functions → webhook
2. Просмотрите логи выполнения
3. Проверьте, что все зависимости установлены

### Проблемы с Netlify Blobs

1. Убедитесь, что Netlify Blobs включен для вашего сайта
2. Проверьте лимиты использования в Dashboard
3. Проверьте права доступа к Blobs

## Лицензия

MIT License - используйте свободно для любых целей.

## История изменений

### v3.0.0 (2026-05-03)
- ✅ Полная миграция на Node.js
- ✅ Serverless архитектура на Netlify Functions
- ✅ Netlify Blobs вместо SQLite
- ✅ Webhook режим работы
- ✅ Сохранена вся функциональность PHP версии

### v2.0.0
- Модульная архитектура PHP версии
- Namespaces и PSR-4 autoloading

### v1.0.0
- Базовая функциональность бота

---

**Разработано для простого и эффективного контроля доступа на КПП** 🚗✅
