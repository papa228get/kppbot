# Деплой на Netlify

Пошаговая инструкция по развертыванию KPPBot на Netlify.

## Предварительные требования

- ✅ Аккаунт на [Netlify](https://netlify.com)
- ✅ Telegram бот токен от [@BotFather](https://t.me/BotFather)
- ✅ Ваш Telegram ID от [@userinfobot](https://t.me/userinfobot)

## Способ 1: Через Netlify CLI (Рекомендуется)

### 1. Установите Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. Войдите в аккаунт

```bash
netlify login
```

### 3. Инициализируйте проект

```bash
netlify init
```

Выберите:
- **Create & configure a new site**
- Выберите команду (или оставьте пустым)
- Netlify автоматически определит настройки из `netlify.toml`

### 4. Настройте переменные окружения

```bash
netlify env:set BOT_TOKEN "ваш_токен_бота"
netlify env:set ADMIN_IDS "ваш_telegram_id"
```

Или через веб-интерфейс:
1. Откройте ваш сайт в [Netlify Dashboard](https://app.netlify.com)
2. **Site settings** → **Environment variables**
3. Добавьте:
   - `BOT_TOKEN` - токен вашего бота
   - `ADMIN_IDS` - ваш Telegram ID (например: `5072943711`)

### 5. Задеплойте

```bash
netlify deploy --prod
```

### 6. Установите webhook

После деплоя получите URL вашего сайта (например: `https://your-site.netlify.app`)

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-site.netlify.app/webhook"}'
```

Проверьте webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

## Способ 2: Через GitHub

### 1. Загрузите код в GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/kppbot.git
git push -u origin main
```

### 2. Подключите к Netlify

1. Зайдите на [Netlify](https://app.netlify.com)
2. Нажмите **Add new site** → **Import an existing project**
3. Выберите **GitHub** и авторизуйтесь
4. Выберите ваш репозиторий `kppbot`
5. Netlify автоматически определит настройки из `netlify.toml`
6. Нажмите **Deploy site**

### 3. Настройте переменные окружения

1. Откройте ваш сайт в Netlify Dashboard
2. **Site settings** → **Environment variables**
3. Добавьте:
   - `BOT_TOKEN` - токен вашего бота
   - `ADMIN_IDS` - ваш Telegram ID

### 4. Установите webhook

После деплоя установите webhook (см. Способ 1, шаг 6)

## Проверка работы

1. Откройте вашего бота в Telegram
2. Отправьте `/start`
3. Вы должны увидеть главное меню

## Обновление бота

### Через CLI:
```bash
netlify deploy --prod
```

### Через GitHub:
```bash
git add .
git commit -m "Update bot"
git push
```

Netlify автоматически задеплоит изменения.

## Мониторинг

### Просмотр логов

1. Откройте Netlify Dashboard
2. **Functions** → **webhook**
3. Просмотрите логи выполнения

### Проверка Netlify Blobs

1. **Storage** → **Blobs**
2. Просмотрите хранилище данных

## Устранение неполадок

### Бот не отвечает

1. Проверьте webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. Проверьте переменные окружения в Netlify Dashboard

3. Проверьте логи функций в Netlify Dashboard → Functions

### Ошибки в функциях

1. Откройте **Functions** → **webhook**
2. Просмотрите логи выполнения
3. Проверьте, что все зависимости установлены

### Проблемы с Netlify Blobs

1. Убедитесь, что Netlify Blobs включен для вашего сайта
2. Проверьте лимиты использования в Dashboard
3. Проверьте права доступа к Blobs

## Лимиты Netlify Free Tier

- **Netlify Blobs:** 100 GB хранилища, 1M операций/месяц
- **Netlify Functions:** 125K запросов/месяц, 100 часов выполнения
- **Размер функции:** до 50 MB
- **Timeout функции:** 10 секунд

Для большинства случаев использования бота этих лимитов достаточно.

## Полезные команды

```bash
# Просмотр статуса сайта
netlify status

# Просмотр логов
netlify functions:log webhook

# Открыть сайт в браузере
netlify open

# Открыть админ-панель
netlify open:admin

# Просмотр переменных окружения
netlify env:list
```

---

**Готово!** Ваш бот работает на Netlify 🚀
