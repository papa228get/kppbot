#!/bin/bash

# Скрипт автоматического деплоя на Netlify

echo "🚀 Деплой KPPBot на Netlify..."
echo ""

# Создаем новый сайт
echo "📦 Создание нового сайта..."
SITE_ID=$(npx netlify api createSite --data '{"name":"kppbot-'$(date +%s)'"}' 2>/dev/null | grep -o '"site_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SITE_ID" ]; then
    echo "❌ Ошибка создания сайта"
    echo "Попробуйте создать сайт вручную через https://app.netlify.com"
    exit 1
fi

echo "✅ Сайт создан: $SITE_ID"

# Сохраняем site_id
echo "$SITE_ID" > .netlify/state.json

# Устанавливаем переменные окружения
echo "⚙️  Настройка переменных окружения..."
npx netlify env:set BOT_TOKEN "8752897970:AAGPAHg7WtZHHGqgyanxraWDaXkGDrnsxCw" --site-id "$SITE_ID"
npx netlify env:set ADMIN_IDS "5072943711" --site-id "$SITE_ID"

# Деплоим
echo "📤 Деплой проекта..."
npx netlify deploy --prod --site-id "$SITE_ID" --dir=. --functions=netlify/functions

echo ""
echo "✅ Деплой завершен!"
echo "🌐 URL сайта: https://app.netlify.com/sites/$SITE_ID"
