# ✅ Чеклист перед деплоем на Netlify

## Подготовка

- [x] Удалены все PHP файлы и директории
- [x] Удалены устаревшие документы
- [x] Обновлен .gitignore
- [x] Проект очищен от legacy кода

## Перед деплоем

- [ ] Получен токен бота от [@BotFather](https://t.me/BotFather)
- [ ] Получен Telegram ID от [@userinfobot](https://t.me/userinfobot)
- [ ] Создан аккаунт на [Netlify](https://netlify.com)

## Деплой

### Вариант 1: Через CLI

```bash
# 1. Установить Netlify CLI
npm install -g netlify-cli

# 2. Войти в аккаунт
netlify login

# 3. Инициализировать проект
netlify init

# 4. Настроить переменные окружения
netlify env:set BOT_TOKEN "ваш_токен"
netlify env:set ADMIN_IDS "ваш_id"

# 5. Задеплоить
netlify deploy --prod
```

### Вариант 2: Через GitHub

```bash
# 1. Создать репозиторий на GitHub
# 2. Загрузить код
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/kppbot.git
git push -u origin main

# 3. Подключить к Netlify через веб-интерфейс
# 4. Настроить переменные окружения в Netlify Dashboard
```

## После деплоя

- [ ] Получен URL сайта (например: `https://your-site.netlify.app`)
- [ ] Установлен webhook:
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://your-site.netlify.app/webhook"}'
  ```
- [ ] Проверен webhook:
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```
- [ ] Протестирован бот: отправлена команда `/start`

## Проверка работы

- [ ] Бот отвечает на `/start`
- [ ] Админ-меню отображается корректно
- [ ] Проверка номера работает
- [ ] Добавление автомобиля работает
- [ ] Список автомобилей отображается
- [ ] Импорт файлов работает

## Мониторинг

- [ ] Настроены уведомления в Netlify Dashboard
- [ ] Проверены логи функций
- [ ] Проверено хранилище Netlify Blobs

---

**Дата:** 2026-05-03  
**Статус:** Готов к деплою ✅
