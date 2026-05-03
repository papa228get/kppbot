const PlateValidator = require('../validators/plateValidator');

/**
 * ImportService - парсинг и импорт автомобилей из файлов
 */
class ImportService {
  /**
   * Парсинг TAB-разделённого файла импорта
   */
  parseImportFile(content) {
    const lines = content.split('\n');
    const parsed = [];
    const errors = [];
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();

      // Пропускаем пустые строки
      if (!trimmedLine) {
        continue;
      }

      // Разбиваем по TAB
      const parts = trimmedLine.split('\t');

      // Проверяем количество полей
      if (parts.length < 3) {
        errors.push(`Строка ${lineNumber}: Недостаточно полей (ожидается минимум 3)`);
        continue;
      }

      const brand = parts[0].trim();
      const plateNumber = parts[1].trim();
      const passTypeRaw = parts[2].trim();
      const expiryDateRaw = parts[3] ? parts[3].trim() : '';

      // Валидация номера
      const normalizedPlate = PlateValidator.normalize(plateNumber);
      if (!normalizedPlate) {
        errors.push(`Строка ${lineNumber}: Некорректный номер автомобиля`);
        continue;
      }

      // Определяем тип пропуска
      const passTypeLower = passTypeRaw.toLowerCase();
      let passType;
      let expiryDate = null;

      if (passTypeLower.includes('постоянн')) {
        passType = 'permanent';
      } else if (passTypeLower.includes('временн')) {
        passType = 'temporary';

        // Конвертируем дату из DD.MM.YYYY в YYYY-MM-DD
        if (expiryDateRaw) {
          expiryDate = this._convertDate(expiryDateRaw);
          if (!expiryDate) {
            errors.push(`Строка ${lineNumber}: Некорректный формат даты '${expiryDateRaw}' (ожидается ДД.ММ.ГГГГ)`);
            continue;
          }
        } else {
          errors.push(`Строка ${lineNumber}: Для временного пропуска требуется дата окончания`);
          continue;
        }
      } else {
        errors.push(`Строка ${lineNumber}: Неизвестный тип пропуска '${passTypeRaw}' (ожидается 'Постоянный' или 'Временный')`);
        continue;
      }

      parsed.push({
        plate_number: normalizedPlate,
        brand: brand,
        access_status: 'allowed',
        pass_type: passType,
        expiry_date: expiryDate,
        notes: '',
        line_number: lineNumber
      });
    }

    return {
      vehicles: parsed,
      errors: errors
    };
  }

  /**
   * Конвертация даты из DD.MM.YYYY в YYYY-MM-DD
   */
  _convertDate(date) {
    // Убираем "до", "г", "г." и лишние пробелы
    let cleanDate = date
      .replace(/^до\s*/i, '')  // Убираем "до" в начале
      .replace(/г\.?$/i, '')    // Убираем "г" или "г." в конце
      .trim();

    // Поддерживаем форматы: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY
    const normalizedDate = cleanDate.replace(/[/-]/g, '.');

    const match = normalizedDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) {
      return false;
    }

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    // Проверяем корректность даты
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
      return false;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Массовый импорт автомобилей
   */
  async importVehicles(vehicles, vehicleService) {
    const stats = {
      added: 0,
      skipped: 0,
      skipped_in_file: 0,
      errors: []
    };

    // Удаляем дубликаты внутри файла (оставляем только первое вхождение)
    const seenPlates = new Set();
    const uniqueVehicles = [];

    for (const vehicle of vehicles) {
      if (seenPlates.has(vehicle.plate_number)) {
        stats.skipped_in_file++;
        continue;
      }
      seenPlates.add(vehicle.plate_number);
      uniqueVehicles.push(vehicle);
    }

    // Проверяем, была ли база недавно очищена (обход eventual consistency)
    const skipDuplicateCheck = await vehicleService.wasDatabaseRecentlyCleared(2);

    // Импортируем уникальные автомобили
    for (const vehicle of uniqueVehicles) {
      try {
        // Проверяем существование автомобиля в базе только если база не была недавно очищена
        if (!skipDuplicateCheck) {
          const existing = await vehicleService.findVehicle(vehicle.plate_number);

          if (existing) {
            stats.skipped++;
            continue;
          }
        }

        // Добавляем автомобиль
        const result = await vehicleService.addVehicle(
          vehicle.plate_number,
          vehicle.brand,
          vehicle.access_status,
          vehicle.pass_type,
          vehicle.expiry_date,
          vehicle.notes
        );

        if (result) {
          stats.added++;
        } else {
          stats.errors.push(`Строка ${vehicle.line_number}: Ошибка при добавлении в БД`);
        }
      } catch (error) {
        stats.errors.push(`Строка ${vehicle.line_number}: ${error.message}`);
      }
    }

    return stats;
  }

  /**
   * Форматирование отчёта об импорте
   */
  formatImportReport(parseResult, importStats) {
    let report = '📊 <b>Результаты импорта</b>\n\n';

    report += `✅ Добавлено: <b>${importStats.added}</b>\n`;

    if (importStats.skipped_in_file > 0) {
      report += `⚠️ Пропущено (дубликаты в файле): <b>${importStats.skipped_in_file}</b>\n`;
    }

    if (importStats.skipped > 0) {
      report += `⚠️ Пропущено (уже в базе): <b>${importStats.skipped}</b>\n`;
    }

    const totalErrors = parseResult.errors.length + importStats.errors.length;
    report += `❌ Ошибок: <b>${totalErrors}</b>\n`;

    // Детали ошибок парсинга
    if (parseResult.errors.length > 0) {
      report += '\n<b>Ошибки парсинга:</b>\n';
      const errorsToShow = parseResult.errors.slice(0, 10);
      for (const error of errorsToShow) {
        report += `• ${error}\n`;
      }
      if (parseResult.errors.length > 10) {
        const remaining = parseResult.errors.length - 10;
        report += `• ... и ещё ${remaining} ошибок\n`;
      }
    }

    // Детали ошибок импорта
    if (importStats.errors.length > 0) {
      report += '\n<b>Ошибки импорта:</b>\n';
      const errorsToShow = importStats.errors.slice(0, 10);
      for (const error of errorsToShow) {
        report += `• ${error}\n`;
      }
      if (importStats.errors.length > 10) {
        const remaining = importStats.errors.length - 10;
        report += `• ... и ещё ${remaining} ошибок\n`;
      }
    }

    return report;
  }
}

module.exports = ImportService;
