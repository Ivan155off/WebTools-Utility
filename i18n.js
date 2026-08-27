
const TRANSLATIONS = {
    en: { language: "Language", deleteAll: "Delete All", settings: "Settings", lightTheme: "Light Theme", noActiveFiles: "No active files", dragFiles: "Drag files here or click to browse", back: "Back", raw: "Raw", edit: "Edit", convert: "Convert", download: "Download", replaceAll: "Replace All", format: "Format", upper: "Upper", lower: "Lower", lines: "Lines", words: "Words", chars: "Chars", privacyPolicy: "Privacy Policy", termsOfUse: "Terms of Use", cancel: "Cancel", rename: "Rename", save: "Save", search: "Search", calculate: "Calculate" },
    uk: { language: "Мова", deleteAll: "Видалити все", settings: "Налаштування", lightTheme: "Світла тема", noActiveFiles: "Немає активних файлів", dragFiles: "Перетягніть файли сюди або натисніть для огляду", back: "Назад", raw: "Сирий", edit: "Редагувати", convert: "Конвертувати", download: "Завантажити", replaceAll: "Замінити все", format: "Формат", upper: "Верхній", lower: "Нижній", lines: "Рядки", words: "Слова", chars: "Символи", privacyPolicy: "Політика конфіденційності", termsOfUse: "Умови використання", cancel: "Скасувати", rename: "Перейменувати", save: "Зберегти", search: "Пошук", calculate: "Обчислити" },
    ru: { language: "Язык", deleteAll: "Удалить всё", settings: "Настройки", lightTheme: "Светлая тема", noActiveFiles: "Нет активных файлов", dragFiles: "Перетащите файлы сюда или нажмите для обзора", back: "Назад", raw: "Исходный", edit: "Изменить", convert: "Конвертировать", download: "Скачать", replaceAll: "Заменить всё", format: "Формат", upper: "Верхний", lower: "Нижний", lines: "Строки", words: "Слова", chars: "Символы", privacyPolicy: "Политика конфиденциальности", termsOfUse: "Условия использования", cancel: "Отмена", rename: "Переименовать", save: "Сохранить", search: "Поиск", calculate: "Вычислить" },
    fr: { language: "Langue", deleteAll: "Tout supprimer", settings: "Paramètres", lightTheme: "Thème clair", noActiveFiles: "Aucun fichier actif", dragFiles: "Glissez les fichiers ici ou cliquez pour parcourir", back: "Retour", raw: "Brut", edit: "Modifier", convert: "Convertir", download: "Télécharger", replaceAll: "Tout remplacer", format: "Format", upper: "Majuscule", lower: "Minuscule", lines: "Lignes", words: "Mots", chars: "Caractères", privacyPolicy: "Politique de confidentialité", termsOfUse: "Conditions d'utilisation", cancel: "Annuler", rename: "Renommer", save: "Enregistrer", search: "Rechercher", calculate: "Calculer" },
    es: { language: "Idioma", deleteAll: "Eliminar todo", settings: "Configuración", lightTheme: "Tema claro", noActiveFiles: "Sin archivos activos", dragFiles: "Arrastre archivos aquí o haga clic para explorar", back: "Atrás", raw: "Crudo", edit: "Editar", convert: "Convertir", download: "Descargar", replaceAll: "Reemplazar todo", format: "Formato", upper: "Mayúscula", lower: "Minúscula", lines: "Líneas", words: "Palabras", chars: "Caracteres", privacyPolicy: "Política de privacidad", termsOfUse: "Términos de uso", cancel: "Cancelar", rename: "Renombrar", save: "Guardar", search: "Buscar", calculate: "Calcular" },
    de: { language: "Sprache", deleteAll: "Alle löschen", settings: "Einstellungen", lightTheme: "Helles Thema", noActiveFiles: "Keine aktiven Dateien", dragFiles: "Dateien hierher ziehen oder klicken zum Durchsuchen", back: "Zurück", raw: "Roh", edit: "Bearbeiten", convert: "Konvertieren", download: "Herunterladen", replaceAll: "Alle ersetzen", format: "Format", upper: "Groß", lower: "Klein", lines: "Zeilen", words: "Wörter", chars: "Zeichen", privacyPolicy: "Datenschutzrichtlinie", termsOfUse: "Nutzungsbedingungen", cancel: "Abbrechen", rename: "Umbenennen", save: "Speichern", search: "Suchen", calculate: "Berechnen" },
    pl: { language: "Język", deleteAll: "Usuń wszystko", settings: "Ustawienia", lightTheme: "Jasny motyw", noActiveFiles: "Brak aktywnych plików", dragFiles: "Przeciągnij pliki tutaj lub kliknij, aby przeglądać", back: "Wstecz", raw: "Surowy", edit: "Edytuj", convert: "Konwertuj", download: "Pobierz", replaceAll: "Zamień wszystko", format: "Format", upper: "Wielkie", lower: "Małe", lines: "Linie", words: "Słowa", chars: "Znaki", privacyPolicy: "Polityka prywatności", termsOfUse: "Warunki korzystania", cancel: "Anuluj", rename: "Zmień nazwę", save: "Zapisz", search: "Szukaj", calculate: "Oblicz" },
    it: { language: "Lingua", deleteAll: "Elimina tutto", settings: "Impostazioni", lightTheme: "Tema chiaro", noActiveFiles: "Nessun file attivo", dragFiles: "Trascina i file qui o clicca per sfogliare", back: "Indietro", raw: "Grezzo", edit: "Modifica", convert: "Converti", download: "Scarica", replaceAll: "Sostituisci tutto", format: "Formato", upper: "Maiuscolo", lower: "Minuscolo", lines: "Righe", words: "Parole", chars: "Caratteri", privacyPolicy: "Informativa sulla privacy", termsOfUse: "Termini di utilizzo", cancel: "Annulla", rename: "Rinomina", save: "Salva", search: "Cerca", calculate: "Calcola" }
};

function applyLanguage(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            if (el.tagName === 'INPUT' && el.type !== 'submit') {
                el.placeholder = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });
    localStorage.setItem('wt_lang', lang);
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('wt_lang') || 'en';
    const selector = document.getElementById('langSelector');
    if (selector) {
        selector.value = savedLang;
        selector.addEventListener('change', (e) => applyLanguage(e.target.value));
    }
    applyLanguage(savedLang);
});
