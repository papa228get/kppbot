const fs = require('fs');
const path = require('path');

/**
 * MockBlobStore - эмуляция Netlify Blobs для локальной разработки
 * Сохраняет данные в файл для персистентности
 */
class MockBlobStore {
  constructor() {
    // Используем переменную окружения или находим корень проекта
    const projectRoot = process.env.PROJECT_ROOT || process.cwd().split('/.netlify')[0];
    this.storageDir = path.join(projectRoot, '.netlify/blobs-serve');
    this.storageFile = path.join(this.storageDir, 'kppbot.json');
    this.storage = new Map();
    this._ensureDir();
    this._load();
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        console.log('Created mock blob store directory:', this.storageDir);
      }
    } catch (error) {
      console.error('Error creating mock blob store directory:', error);
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        this.storage = new Map(Object.entries(data));
        console.log(`Loaded ${this.storage.size} items from mock blob store`);
      } else {
        console.log('No existing mock blob store file, starting fresh');
      }
    } catch (error) {
      console.error('Error loading mock blob store:', error);
    }
  }

  _save() {
    try {
      this._ensureDir();
      const data = Object.fromEntries(this.storage);
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
      console.log(`Saved ${this.storage.size} items to mock blob store`);
    } catch (error) {
      console.error('Error saving mock blob store:', error);
    }
  }

  async get(key) {
    return this.storage.get(key) || null;
  }

  async set(key, value) {
    this.storage.set(key, value);
    this._save();
  }

  async delete(key) {
    this.storage.delete(key);
    this._save();
  }

  async list() {
    return Array.from(this.storage.keys());
  }
}

// Глобальный синглтон для всех запросов
let mockStoreInstance = null;

/**
 * Функция для получения store - работает локально и на Netlify
 */
function getStoreWrapper(options) {
  // Проверяем, запущены ли мы локально
  const isLocal = !process.env.NETLIFY || process.env.NETLIFY_DEV === 'true';

  if (isLocal) {
    // Используем синглтон для локальной разработки
    if (!mockStoreInstance) {
      mockStoreInstance = new MockBlobStore();
      console.log('Created new mock blob store instance');
    }
    return mockStoreInstance;
  }

  // На Netlify используем настоящий Blobs
  const { getStore } = require('@netlify/blobs');
  return getStore(options);
}

module.exports = getStoreWrapper;
