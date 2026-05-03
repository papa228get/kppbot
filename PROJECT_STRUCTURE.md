# Структура проекта KPPBot

```
kppbot/
├── netlify/
│   └── functions/
│       └── webhook.js              # Точка входа (Netlify Function)
│
├── src/
│   ├── core/
│   │   ├── database.js             # Работа с Netlify Blobs
│   │   ├── mockBlobStore.js        # Mock для локальной разработки
│   │   └── stateManager.js         # Управление состояниями пользователей
│   │
│   ├── services/
│   │   ├── telegramApi.js          # Telegram Bot API
│   │   ├── vehicleService.js       # Бизнес-логика автомобилей
│   │   ├── accessChecker.js        # Проверка доступа
│   │   └── importService.js        # Импорт из файлов
│   │
│   ├── handlers/
│   │   ├── commandHandler.js       # Обработка команд (/start, /add, etc.)
│   │   ├── callbackHandler.js      # Обработка callback кнопок
│   │   ├── stateHandler.js         # Обработка состояний диалога
│   │   ├── messageHandler.js       # Обработка текстовых сообщений
│   │   └── documentHandler.js      # Обработка файлов
│   │
│   ├── formatters/
│   │   ├── menuFormatter.js        # Форматирование меню
│   │   └── vehicle/
│   │       ├── accessCheckFormatter.js  # Форматирование проверки доступа
│   │       ├── cardFormatter.js         # Карточка автомобиля
│   │       ├── listFormatter.js         # Список автомобилей
│   │       └── searchFormatter.js       # Результаты поиска
│   │
│   ├── validators/
│   │   └── plateValidator.js       # Валидация номеров и прав доступа
│   │
│   └── ui/
│       ├── keyboardBuilder.js      # Построение клавиатур
│       └── messageBuilder.js       # Построение сообщений
│
├── docs/
│   ├── README.md                   # Документация по PHP версии (legacy)
│   ├── DEPLOYMENT.md               # Инструкция по деплою PHP версии
│   └── IMPORT_GUIDE.md             # Руководство по импорту
│
├── .env                            # Переменные окружения (не в git)
├── .env.example                    # Пример переменных окружения
├── .gitignore                      # Игнорируемые файлы
├── netlify.toml                    # Конфигурация Netlify
├── package.json                    # Зависимости Node.js
├── README.md                       # Основная документация
├── DEPLOY.md                       # Инструкция по деплою на Netlify
├── CHECKLIST.md                    # Чеклист перед деплоем
└── PROJECT_STRUCTURE.md            # Этот файл
```

## Описание модулей

### Core (Ядро)

**database.js**
- Работа с Netlify Blobs как с базой данных
- CRUD операции для автомобилей
- Управление индексами и статистикой

**mockBlobStore.js**
- Mock-реализация Netlify Blobs для локальной разработки
- Сохраняет данные в `.netlify/blobs-serve/kppbot.json`

**stateManager.js**
- Управление состояниями пользователей в диалогах
- Сохранение контекста между сообщениями

### Services (Сервисы)

**telegramApi.js**
- Обёртка над Telegram Bot API
- Отправка сообщений, клавиатур, редактирование

**vehicleService.js**
- Бизнес-логика работы с автомобилями
- Добавление, удаление, обновление, поиск

**accessChecker.js**
- Проверка доступа автомобиля
- Валидация срока действия пропуска

**importService.js**
- Парсинг файлов импорта
- Валидация и обработка данных

### Handlers (Обработчики)

**commandHandler.js**
- Обработка команд: `/start`, `/add`, `/list`, `/stats`, `/import`, `/remove`

**callbackHandler.js**
- Обработка нажатий на inline-кнопки
- Навигация, редактирование, удаление

**stateHandler.js**
- Обработка диалогов (добавление авто, импорт)
- Управление состояниями пользователя

**messageHandler.js**
- Обработка текстовых сообщений (номера авто)

**documentHandler.js**
- Обработка загруженных файлов
- Импорт данных из файлов

### Formatters (Форматтеры)

Отвечают за форматирование данных для отображения пользователю.

### Validators (Валидаторы)

**plateValidator.js**
- Валидация и нормализация номеров автомобилей
- Проверка прав администратора

### UI (Пользовательский интерфейс)

**keyboardBuilder.js**
- Построение inline и reply клавиатур

**messageBuilder.js**
- Построение текстовых сообщений

## Поток данных

```
Telegram → webhook.js → Handler → Service → Database → Netlify Blobs
                ↓
            Formatter → UI → Telegram API → User
```

## Хранение данных (Netlify Blobs)

```
Ключи:
- vehicle:{plate_number}  → JSON объект автомобиля
- vehicles:index          → массив всех номеров
- vehicles:stats          → кэш статистики
- state:{user_id}         → состояние пользователя
```

## Технологии

- **Node.js** 18+
- **Netlify Functions** (serverless)
- **Netlify Blobs** (key-value хранилище)
- **Telegram Bot API**

---

**Версия:** 3.0.0  
**Дата:** 2026-05-03
