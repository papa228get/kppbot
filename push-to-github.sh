#!/bin/bash

# После создания репозитория на GitHub выполни эти команды:

echo "📤 Загрузка проекта на GitHub..."

# Замени USERNAME на свой GitHub username
GITHUB_USERNAME="papa228get"

git remote add origin https://github.com/$GITHUB_USERNAME/kppbot.git
git push -u origin main

echo "✅ Проект загружен на GitHub!"
echo "🌐 Репозиторий: https://github.com/$GITHUB_USERNAME/kppbot"
echo ""
echo "Теперь:"
echo "1. Открой https://app.netlify.com"
echo "2. Add new site → Import an existing project"
echo "3. Выбери GitHub → kppbot"
echo "4. Netlify автоматически определит настройки"
echo "5. Добавь переменные окружения:"
echo "   BOT_TOKEN=8752897970:AAGPAHg7WtZHHGqgyanxraWDaXkGDrnsxCw"
echo "   ADMIN_IDS=5072943711"
echo "6. Deploy!"
