// Enhanced Sticky Notes Application
let notes = [];
let currentNoteId = null;
let currentTheme = 'glass';
let searchQuery = '';
const BG_ROTATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
// Proxy URL: deploy the api/ folder to Vercel, set UNSPLASH_ACCESS_KEY and OPENROUTER_API_KEY in Vercel env, then set your deployment URL here. Keys never ship in the extension.
const PROXY_BASE_URL = 'https://aesthetic-sticky-notes-3p9kek4vm-sid-jains-projects-07bd1b4f.vercel.app';
let bgRotateTimer = null;
let preferredSearchEngine = 'google';
let userLocation = '';
let temperatureUnit = 'c';

// Speech recognition for dictation
let speechRecognition = null;
let dictatingNoteId = null;
let dictationPaused = false;

// Initialize the application
function init() {
    loadSettings();
    loadNotes();
    checkUserName();
    startBgRotation();
    attachGlobalEventListeners();
    
    // Ensure modals are hidden on initialization
    const colorModal = document.getElementById('colorModal');
    const tagModal = document.getElementById('tagModal');
    const nameModal = document.getElementById('nameModal');
    const settingsModal = document.getElementById('settingsModal');
    const deleteModal = document.getElementById('deleteModal');
    if (colorModal) colorModal.classList.add('hidden');
    if (tagModal) tagModal.classList.add('hidden');
    if (settingsModal) settingsModal.classList.add('hidden');
    if (deleteModal) deleteModal.classList.add('hidden');

    // Name modal will be shown by checkUserName() if needed
}

// Load settings from Chrome storage
function loadSettings() {
    chrome.storage.sync.get(['theme', 'userName', 'searchEngine', 'location', 'temperatureUnit'], (result) => {
        const hasSyncData = result.theme || result.userName || result.searchEngine || result.location || result.temperatureUnit;
        if (hasSyncData) {
            applyLoadedSettings(result);
        } else {
            // Migrate from local for existing users
            chrome.storage.local.get(['theme', 'userName', 'searchEngine', 'location', 'temperatureUnit'], (localResult) => {
                if (localResult.theme || localResult.userName || localResult.searchEngine || localResult.location || localResult.temperatureUnit) {
                    chrome.storage.sync.set(localResult);
                }
                applyLoadedSettings({ ...result, ...localResult });
            });
        }
    });
}

function applyLoadedSettings(result) {
    currentTheme = result.theme || 'glass';
    preferredSearchEngine = result.searchEngine || 'google';
    userLocation = result.location || '';
    temperatureUnit = result.temperatureUnit || 'c';
    applyTheme(currentTheme);
    updateSearchPlaceholder();
    initTimeAndWeather();
}

// Search engine URLs
const SEARCH_ENGINE_URLS = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    yahoo: 'https://search.yahoo.com/search?p=',
    ecosia: 'https://www.ecosia.org/search?q='
};

const SEARCH_ENGINE_NAMES = {
    google: 'Google',
    bing: 'Bing',
    duckduckgo: 'DuckDuckGo',
    yahoo: 'Yahoo',
    ecosia: 'Ecosia'
};

function updateSearchPlaceholder() {
    const input = document.getElementById('googleSearchInput');
    if (input) {
        input.placeholder = `Search ${SEARCH_ENGINE_NAMES[preferredSearchEngine]} or type a URL`;
    }
}

// Time and Weather
let weatherCache = { data: null, timestamp: 0 };
const WEATHER_CACHE_MS = 30 * 60 * 1000; // 30 min

function initTimeAndWeather() {
    updateTime();
    setInterval(updateTime, 60000); // Update every minute

    if (userLocation) {
        fetchWeather();
    } else {
        document.getElementById('weatherDisplay').textContent = '';
    }
}

function updateTime() {
    const el = document.getElementById('timeDisplay');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

async function fetchWeather() {
    if (!userLocation) return;

    if (weatherCache.data && Date.now() - weatherCache.timestamp < WEATHER_CACHE_MS) {
        renderWeather(weatherCache.data);
        return;
    }

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(userLocation)}&count=1`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
            document.getElementById('weatherDisplay').textContent = '';
            return;
        }

        const { latitude, longitude } = geoData.results[0];
        const tempUnit = temperatureUnit === 'f' ? 'fahrenheit' : 'celsius';
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=${tempUnit}`);
        const weatherData = await weatherRes.json();

        weatherCache = { data: weatherData, timestamp: Date.now() };
        renderWeather(weatherData);
    } catch (err) {
        document.getElementById('weatherDisplay').textContent = '';
    }
}

function renderWeather(data) {
    const el = document.getElementById('weatherDisplay');
    if (!el || !data?.current) return;

    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const icon = getWeatherIcon(code);
    const unit = temperatureUnit === 'f' ? '°F' : '°C';
    el.textContent = `${icon} ${temp}${unit}`;
    el.title = getWeatherDescription(code);
}

function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 49) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '❄️';
    if (code <= 99) return '⛈️';
    return '🌤️';
}

function getWeatherDescription(code) {
    const map = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Foggy', 48: 'Foggy', 51: 'Drizzle', 61: 'Rain', 71: 'Snow', 80: 'Rain showers', 95: 'Thunderstorm' };
    return map[code] || 'Weather';
}

// Check if user has provided their name
function checkUserName() {
    chrome.storage.sync.get(['userName'], (result) => {
        if (!result.userName) {
            // Show name modal if name doesn't exist
            showNameModal();
        } else {
            // Update title with user's name
            updateTitle(result.userName);
        }
    });
}

// Show name input modal
function showNameModal() {
    const nameModal = document.getElementById('nameModal');
    const nameInput = document.getElementById('nameInput');
    
    if (nameModal) {
        nameModal.classList.remove('hidden');
        
        // Focus on input after a short delay
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
                nameInput.value = ''; // Clear any previous input
            }
        }, 100);
    }
}

// Save user name and update title
function saveUserName() {
    const nameInput = document.getElementById('nameInput');
    const nameModal = document.getElementById('nameModal');
    
    if (nameInput) {
        const name = nameInput.value.trim();
        if (name) {
            // Save to Chrome storage
            chrome.storage.sync.set({ userName: name }, () => {
                // Update title
                updateTitle(name);
                // Hide modal
                if (nameModal) {
                    nameModal.classList.add('hidden');
                }
            });
        }
    }
}

// Update the title with user's name
function updateTitle(name) {
    const googleLogo = document.querySelector('.google-logo');
    if (googleLogo) {
        googleLogo.textContent = name ? `Hi ${name}` : 'aesthetic';
    }
}

// Open settings modal and populate with current values
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const nameInput = document.getElementById('settingsName');
    const searchEngineSelect = document.getElementById('settingsSearchEngine');
    const locationInput = document.getElementById('settingsLocation');
    const tempUnitSelect = document.getElementById('settingsTempUnit');
    if (!modal) return;
    
    chrome.storage.sync.get(['userName', 'searchEngine', 'location', 'temperatureUnit'], (result) => {
        if (nameInput) nameInput.value = result.userName || '';
        if (searchEngineSelect) searchEngineSelect.value = result.searchEngine || 'google';
        if (locationInput) locationInput.value = result.location || '';
        if (tempUnitSelect) tempUnitSelect.value = result.temperatureUnit || 'c';
    });
    
    modal.classList.remove('hidden');
    setTimeout(() => nameInput?.focus(), 100);
}

// Save settings from modal
function saveSettingsFromModal() {
    const nameInput = document.getElementById('settingsName');
    const searchEngineSelect = document.getElementById('settingsSearchEngine');
    const locationInput = document.getElementById('settingsLocation');
    const tempUnitSelect = document.getElementById('settingsTempUnit');
    const modal = document.getElementById('settingsModal');
    
    const userName = nameInput?.value.trim() || '';
    const searchEngine = searchEngineSelect?.value || 'google';
    const location = locationInput?.value.trim() || '';
    const tempUnit = tempUnitSelect?.value || 'c';
    
    chrome.storage.sync.set({
        userName,
        searchEngine,
        location,
        temperatureUnit: tempUnit
    }, () => {
        preferredSearchEngine = searchEngine;
        userLocation = location;
        temperatureUnit = tempUnit;
        updateTitle(userName);
        updateSearchPlaceholder();
        weatherCache = { data: null, timestamp: 0 };
        if (userLocation) fetchWeather();
        else document.getElementById('weatherDisplay').textContent = '';
        if (modal) modal.classList.add('hidden');
    });
}

// Save settings to Chrome storage
function saveSettings() {
    chrome.storage.sync.set({ theme: currentTheme });
}

// Load notes from Chrome storage
function loadNotes() {
    chrome.storage.local.get(['notes'], (result) => {
        notes = result.notes || [];
        
        // Migrate old notes to new format
        notes = notes.map(note => ({
            ...note,
            tags: note.tags || [],
            pinned: note.pinned || false,
            pinnedAt: note.pinnedAt || (note.pinned ? note.timestamp : null),
            createdAt: note.createdAt || note.timestamp,
            archived: note.archived || false,
            priority: note.priority || null,
            formatting: note.formatting || {
                bold: false,
                italic: false,
                code: false
            },
            width: note.width || null,
            height: note.height || null
        }));
        
        // Sort notes using the new sorting function
        sortNotes();
        
        renderNotes();
    });
}

// Save notes to Chrome storage
function saveNotes() {
    chrome.storage.local.set({ notes: notes });
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create a new note
function createNote() {
    const note = {
        id: generateId(),
        title: '',
        content: '',
        color: '#fef3c7',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        pinned: false,
        pinnedAt: null,
        archived: false,
        tags: [],
        priority: null,
        formatting: {
            bold: false,
            italic: false,
            code: false
        },
        width: null,  // Custom width (null = default)
        height: null  // Custom height (null = default)
    };
    
    // Find the index after all pinned notes
    const firstUnpinnedIndex = notes.findIndex(n => !n.pinned);
    if (firstUnpinnedIndex === -1) {
        // All notes are pinned or no notes exist, add to end
        notes.push(note);
    } else {
        // Insert after pinned notes
        notes.splice(firstUnpinnedIndex, 0, note);
    }
    
    saveNotes();
    renderNotes();
    
    // Focus on the new note's title
    setTimeout(() => {
        const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
        if (noteElement) {
            noteElement.querySelector('.note-title').focus();
        }
    }, 100);
}

// Delete a note (called after confirmation)
function deleteNote(id) {
    notes = notes.filter(note => note.id !== id);
    saveNotes();
    renderNotes();
}

// Pending note to delete (for modal confirmation)
let pendingDeleteNoteId = null;

// Show delete confirmation modal
function showDeleteModal(noteId) {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;
    pendingDeleteNoteId = noteId;
    modal.classList.remove('hidden');
}

// Toggle pin note
function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        note.pinnedAt = note.pinned ? new Date().toISOString() : null;
        note.timestamp = new Date().toISOString();
        
        // Re-sort notes to maintain order
        sortNotes();
        saveNotes();
        renderNotes();
    }
}

// Sort notes: pinned first (by pinnedAt), then unpinned (by timestamp)
function sortNotes() {
    notes.sort((a, b) => {
        // Both pinned: sort by pinnedAt (most recently pinned first)
        if (a.pinned && b.pinned) {
            return new Date(b.pinnedAt || b.timestamp) - new Date(a.pinnedAt || a.timestamp);
        }
        // Only a is pinned
        if (a.pinned) return -1;
        // Only b is pinned
        if (b.pinned) return 1;
        // Neither pinned: sort by creation time (newest first)
        return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
    });
}

// Update note
function updateNote(id, field, value) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note[field] = value;
        note.timestamp = new Date().toISOString();
        saveNotes();
        
        // Update rendered timestamp
        const noteElement = document.querySelector(`[data-note-id="${id}"]`);
        if (noteElement) {
            const timestampElement = noteElement.querySelector('.note-timestamp');
            if (timestampElement) {
                timestampElement.textContent = formatTimestamp(note.timestamp);
            }
            updateWordCount(id);
        }
    }
}

// Change note color
function changeNoteColor(id, color) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.color = color;
        saveNotes();
        renderNotes();
    }
}

// Toggle note formatting
function toggleFormatting(id, formatType) {
    const note = notes.find(n => n.id === id);
    if (note) {
        // Ensure formatting object exists
        if (!note.formatting) {
            note.formatting = { bold: false, italic: false, code: false };
        }
        note.formatting[formatType] = !note.formatting[formatType];
        saveNotes();
        applyFormatting(id);
    }
}

// Apply formatting to note
function applyFormatting(id) {
    const note = notes.find(n => n.id === id);
    const noteElement = document.querySelector(`[data-note-id="${id}"]`);
    
    if (note && noteElement) {
        // Ensure formatting object exists
        if (!note.formatting) {
            note.formatting = { bold: false, italic: false, code: false };
        }
        
        const textarea = noteElement.querySelector('.note-content');
        const boldBtn = noteElement.querySelector('.bold-btn');
        const italicBtn = noteElement.querySelector('.italic-btn');
        const codeBtn = noteElement.querySelector('.code-btn');
        
        // Apply formatting classes
        textarea?.classList.toggle('bold', note.formatting.bold);
        textarea?.classList.toggle('italic', note.formatting.italic);
        textarea?.classList.toggle('code', note.formatting.code);
        
        // Update button states
        boldBtn?.classList.toggle('active', note.formatting.bold);
        italicBtn?.classList.toggle('active', note.formatting.italic);
        codeBtn?.classList.toggle('active', note.formatting.code);
    }
}

// Dictation - speech to text
function isSpeechRecognitionSupported() {
    return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

function toggleDictation(noteId) {
    if (!isSpeechRecognitionSupported()) {
        alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
        return;
    }

    const note = notes.find(n => n.id === noteId);
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    const textarea = noteElement?.querySelector('.note-content');

    if (!note || !textarea) return;

    // Same note: toggle pause/resume or stop
    if (dictatingNoteId === noteId) {
        if (dictationPaused) {
            resumeDictation(noteId, textarea);
        } else {
            pauseDictation(noteId);
        }
        return;
    }

    // Different note: stop any existing, then start fresh
    if (dictatingNoteId) {
        stopDictation();
    }

    startDictation(noteId, textarea);
}

function startDictation(noteId, textarea) {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognitionClass();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = navigator.language || 'en-US';

    speechRecognition.onresult = (e) => {
        let finalTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
                finalTranscript += transcript;
            }
        }
        if (finalTranscript) {
            const cursorPos = textarea.selectionStart;
            const text = textarea.value;
            const before = text.substring(0, cursorPos);
            const after = text.substring(cursorPos);
            const prefix = (before.length > 0 && !/[\s\n]$/.test(before)) ? ' ' : '';
            const newText = before + prefix + finalTranscript + after;
            const newCursorPos = cursorPos + prefix.length + finalTranscript.length;
            textarea.value = newText;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            updateNote(noteId, 'content', newText);
        }
    };

    speechRecognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
            stopDictation();
            alert('Microphone access was denied. Please allow microphone access to use dictation.');
        } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
            // Speech recognition error (not logged to avoid noise)
        }
    };

    speechRecognition.onend = () => {
        if (dictatingNoteId === noteId && !dictationPaused) {
            setDictationUIState(noteId, 'off');
            dictatingNoteId = null;
            speechRecognition = null;
        }
    };

    try {
        speechRecognition.start();
        dictatingNoteId = noteId;
        dictationPaused = false;
        setDictationUIState(noteId, 'listening');
    } catch (err) {
        // Failed to start speech recognition
        alert('Could not start dictation. Please check your microphone.');
    }
}

function pauseDictation(noteId) {
    if (speechRecognition) {
        try {
            speechRecognition.stop();
        } catch (e) { /* ignore */ }
        speechRecognition = null;
    }
    dictationPaused = true;
    setDictationUIState(noteId, 'paused');
}

function resumeDictation(noteId, textarea) {
    dictationPaused = false;
    startDictation(noteId, textarea);
}

function stopDictation() {
    if (speechRecognition) {
        try {
            speechRecognition.stop();
        } catch (e) { /* ignore */ }
        speechRecognition = null;
    }
    dictationPaused = false;
    if (dictatingNoteId) {
        setDictationUIState(dictatingNoteId, 'off');
        dictatingNoteId = null;
    }
}

function setDictationUIState(noteId, state) {
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!noteElement) return;

    const isListening = state === 'listening';
    const isPaused = state === 'paused';
    const isActive = isListening || isPaused;

    noteElement.querySelectorAll('.dictation-btn').forEach(btn => {
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('dictating', isListening);
        btn.classList.toggle('paused', isPaused);
        if (isListening) {
            btn.title = 'Pause dictation';
        } else if (isPaused) {
            btn.title = 'Resume dictation';
        } else {
            btn.title = 'Dictate (speak to type)';
        }
    });

    const indicator = noteElement.querySelector('.dictation-indicator');
    if (indicator) {
        indicator.classList.toggle('show', isActive);
        indicator.classList.toggle('paused', isPaused);
        const label = indicator.querySelector('.dictation-indicator-label');
        if (label) {
            label.textContent = isPaused ? 'Paused' : 'Listening…';
        }
    }
}

// AI Write - OpenRouter API (free tier)
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'stepfun/step-3.5-flash:free';
let aiWriteCursorPos = 0;
let aiWriteSelection = '';
let aiWriteAbortController = null;

function normalizeCheckboxes(text) {
    return text
        .replace(/\[\s*\]/g, '☐')
        .replace(/\[x\]/gi, '☑');
}

function openAiWriteInline(noteId) {
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    const textarea = noteElement?.querySelector('.note-content');
    const pill = noteElement?.querySelector('.ai-write-pill');
    const pillInput = pill?.querySelector('.ai-write-pill-input');
    if (!pill || !pillInput || !textarea) return;

    currentNoteId = noteId;
    aiWriteCursorPos = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;
    aiWriteSelection = selEnd > aiWriteCursorPos ? textarea.value.substring(aiWriteCursorPos, selEnd) : '';
    pillInput.value = '';
    pillInput.placeholder = aiWriteSelection
        ? 'Expand, shorten, fix …'
        : 'What to write? (Enter)';
    pill.querySelector('.ai-write-pill-loading')?.classList.add('hidden');
    pill.querySelector('.ai-write-pill-input')?.classList.remove('hidden');
    pill.classList.remove('hidden');
    pill.classList.remove('ai-write-pill-loading-state');
    noteElement?.querySelector('.selection-toolbar')?.classList.add('hidden');
    const overlay = noteElement?.querySelector('.selection-overlay');
    if (aiWriteSelection && overlay) {
        updateSelectionOverlay(textarea, overlay);
        overlay.classList.remove('hidden');
        textarea.addEventListener('scroll', _syncOverlayScroll);
        textarea.focus();
    } else {
        overlay?.classList.add('hidden');
        setTimeout(() => pillInput.focus(), 50);
    }
}

function updateSelectionOverlay(textarea, overlay) {
    const text = textarea.value;
    const start = aiWriteCursorPos;
    const end = start + aiWriteSelection.length;
    const before = escapeHtml(text.substring(0, start));
    const sel = escapeHtml(aiWriteSelection);
    const after = escapeHtml(text.substring(end));
    overlay.className = 'selection-overlay ' + (textarea.className.match(/\b(bold|italic|code)\b/g) || []).join(' ');
    overlay.innerHTML = before + '<span class="selection-highlight">' + sel + '</span>' + after;
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
}

function _syncOverlayScroll(e) {
    const textarea = e.target;
    const overlay = textarea.nextElementSibling;
    if (overlay?.classList?.contains('selection-overlay') && !overlay.classList.contains('hidden')) {
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
    }
}

function updateSelectionToolbar(textarea) {
    const noteElement = textarea?.closest('.note');
    if (!noteElement) return;
    const toolbar = noteElement.querySelector('.selection-toolbar');
    const pill = noteElement.querySelector('.ai-write-pill');
    if (!toolbar) return;
    if (pill && !pill.classList.contains('hidden')) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = end > start && textarea.value.substring(start, end).trim().length > 0;

    toolbar.classList.toggle('hidden', !hasSelection);
}

function closeAiWriteInline(noteId) {
    if (!noteId) return;
    if (aiWriteAbortController) {
        aiWriteAbortController.abort();
        aiWriteAbortController = null;
    }
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    const pill = noteElement?.querySelector('.ai-write-pill');
    const textarea = noteElement?.querySelector('.note-content');
    const overlay = noteElement?.querySelector('.selection-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        textarea?.removeEventListener('scroll', _syncOverlayScroll);
    }
    if (pill) {
        pill.classList.remove('ai-write-pill-loading-state');
        const input = pill.querySelector('.ai-write-pill-input');
        if (input) input.value = '';
        pill.classList.add('closing');
        setTimeout(() => {
            pill.classList.remove('closing');
            pill.classList.add('hidden');
        }, 160);
    }
}

function showAiWriteLoading(pill, show) {
    if (!pill) return;
    const hint = pill.querySelector('.ai-write-pill-hint');
    const input = pill.querySelector('.ai-write-pill-input');
    const loading = pill.querySelector('.ai-write-pill-loading');
    if (show) {
        hint?.classList.add('hidden');
        input?.classList.add('hidden');
        loading?.classList.remove('hidden');
        pill.classList.add('ai-write-pill-loading-state');
    } else {
        loading?.classList.add('hidden');
        hint?.classList.remove('hidden');
        input?.classList.remove('hidden');
        pill.classList.remove('ai-write-pill-loading-state');
    }
}

async function submitAiWriteInline(noteId, promptInput) {
    const prompt = promptInput?.value?.trim();
    if (!prompt) return;

    const note = notes.find(n => n.id === noteId);
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    const textarea = noteElement?.querySelector('.note-content');
    const pill = noteElement?.querySelector('.ai-write-pill');
    if (!note || !textarea || !pill) return;

    const proxyUrl = (PROXY_BASE_URL || '').trim();
    if (!proxyUrl) {
        alert('AI write is not configured. Set PROXY_BASE_URL in script.js and deploy the api/ proxy.');
        return;
    }

    showAiWriteLoading(pill, true);
    const overlay = noteElement?.querySelector('.selection-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        textarea.removeEventListener('scroll', _syncOverlayScroll);
    }

    const fullContent = (note.title ? `Title: ${note.title}\n\n` : '') + (note.content || '');
    const noteContext = `This is for sticky notes with very limited space. Keep all responses SHORT and concise.`;
    const checkboxFormat = `\n\nCHECKBOX FORMAT: Use ☐ (U+2610) for unchecked items and ☑ (U+2611) for checked. Each line: "☐ " or "☑ " followed by the task. When converting lists to checkboxes, put ☐ before each item.`;
    const systemPrompt = aiWriteSelection
        ? `You are an invisible writing assistant. ${noteContext}\n\nThe user selected: "${aiWriteSelection}"\n\nRespond ONLY with the improved text. No preamble, no "Here's...", no quotes. Just the text. Keep it short.${checkboxFormat}`
        : `You are an invisible writing assistant. ${noteContext}\n\nThe user's note:\n\n---\n${fullContent || '(empty)'}\n---\n\nRespond ONLY with the requested content. No preamble, no meta-commentary. Just the text. Keep it short.${checkboxFormat}`;
    const userPrompt = aiWriteSelection ? `${prompt}: "${aiWriteSelection}"` : prompt;

    const cursorPos = aiWriteCursorPos;
    const selEnd = cursorPos + aiWriteSelection.length;
    const noteText = textarea.value;
    const before = noteText.substring(0, cursorPos);
    const after = noteText.substring(aiWriteSelection ? selEnd : cursorPos);
    const prefix = (before.length > 0 && !/[\s\n]$/.test(before)) ? '\n\n' : (before.length > 0 ? '\n' : '');
    const insertStart = cursorPos + prefix.length;

    aiWriteAbortController = new AbortController();

    try {
        const openrouterUrl = proxyUrl.replace(/\/$/, '') + '/api/openrouter?t=' + Date.now();
        const res = await fetch(openrouterUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: true,
                reasoning: { enabled: true }
            }),
            signal: aiWriteAbortController.signal,
            cache: 'no-store'
        });

        if (!res.ok) {
            const status = res.status;
            let hint = 'Check OPENROUTER_API_KEY in Vercel → Settings → Environment Variables, then redeploy.';
            if (status === 500) hint = 'Proxy not configured: add OPENROUTER_API_KEY in Vercel Environment Variables and redeploy.';
            if (status === 502) hint = 'Proxy error: check Vercel function logs.';
            if (status === 401) {
                let detail = '';
                try { const j = await res.clone().json(); detail = (j && j.error) ? ': ' + String(j.error).slice(0, 120) : ''; } catch (_) {}
                hint = 'Unauthorized (OpenRouter)' + detail + '. If AI works in another profile: clear this profile\'s cache for this page, or try Incognito with the extension loaded from the same folder.';
            }
            throw new Error(status + ' ' + hint);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.slice(6));
                        const delta = json?.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullText += delta;
                            const converted = normalizeCheckboxes(fullText);
                            const newText = before + prefix + converted + after;
                            textarea.value = newText;
                            textarea.setSelectionRange(insertStart + converted.length, insertStart + converted.length);
                            textarea.scrollTop = textarea.scrollHeight;
                            clearTimeout(window._aiWriteSaveThrottle);
                            window._aiWriteSaveThrottle = setTimeout(() => updateNote(noteId, 'content', newText), 120);
                        }
                    } catch (_) {}
                }
            }
        }

        if (fullText) {
            clearTimeout(window._aiWriteSaveThrottle);
            const converted = normalizeCheckboxes(fullText);
            updateNote(noteId, 'content', before + prefix + converted + after);
            closeAiWriteInline(noteId);
        }
        textarea.focus();
    } catch (err) {
        if (err.name === 'AbortError') return;
        const msg = (err.message && /^\d{3}\s/.test(err.message)) ? err.message : 'Network or stream error. Check proxy URL and Vercel env vars.';
        alert('AI write failed. ' + msg);
    } finally {
        aiWriteAbortController = null;
        showAiWriteLoading(pill, false);
    }
}

// Add tag to note
function addTag(id, tag) {
    const note = notes.find(n => n.id === id);
    if (note && tag) {
        // Ensure tags array exists
        if (!note.tags) {
            note.tags = [];
        }
        if (!note.tags.includes(tag)) {
            note.tags.push(tag);
            saveNotes();
            renderNotes();
        }
    }
}

// Get all unique existing tags from all notes
function getAllExistingTags() {
    const allTags = new Set();
    notes.forEach(note => {
        if (note.tags && Array.isArray(note.tags)) {
            note.tags.forEach(tag => allTags.add(tag));
        }
    });
    return Array.from(allTags).sort();
}

// Populate existing tags in the tag modal
function populateExistingTags(currentNoteId) {
    const container = document.getElementById('existingTags');
    const section = document.getElementById('existingTagsSection');
    
    if (!container) return;
    
    const currentNote = notes.find(n => n.id === currentNoteId);
    const currentNoteTags = currentNote?.tags || [];
    const allTags = getAllExistingTags();
    
    // Filter out tags already on the current note
    const availableTags = allTags.filter(tag => !currentNoteTags.includes(tag));
    
    // Clear container
    container.innerHTML = '';
    
    if (availableTags.length === 0) {
        if (section) {
            section.classList.remove('show');
        }
        return;
    }
    
    if (section) {
        section.classList.add('show');
    }
    
    // Create chip for each tag
    availableTags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'existing-tag-chip';
        chip.textContent = tag;
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            addTag(currentNoteId, tag);
            document.getElementById('tagModal').classList.add('hidden');
            document.getElementById('tagInput').value = '';
        });
        container.appendChild(chip);
    });
}

// Remove tag from note
function removeTag(id, tag) {
    const note = notes.find(n => n.id === id);
    if (note && note.tags) {
        note.tags = note.tags.filter(t => t !== tag);
        saveNotes();
        renderNotes();
    }
}

// Set note priority
function setPriority(id, priority) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.priority = note.priority === priority ? null : priority;
        saveNotes();
        renderNotes();
    }
}

// Format timestamp - show date when note was last edited
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    if (isToday) {
        return `Today, ${timeStr}`;
    }
    if (isThisYear) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + timeStr;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + timeStr;
}

// Count words in text
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Update word count for a note
function updateWordCount(id) {
    const note = notes.find(n => n.id === id);
    const noteElement = document.querySelector(`[data-note-id="${id}"]`);
    
    if (note && noteElement) {
        const wordCountElement = noteElement.querySelector('.word-count');
        if (wordCountElement) {
            const words = countWords(note.content);
            wordCountElement.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
        }
    }
}

// Rotating background – Unsplash API (nature/landscape), fetch once per day
const BG_CACHE_KEY = 'unsplashBgUrl';
const BG_FETCHED_AT_KEY = 'unsplashBgFetchedAt';

function setBgImageUrl(url) {
    const el = document.getElementById('bgLayer');
    if (!el) return;
    el.style.backgroundImage = `url(${url})`;
}

function saveBgCache(url) {
    if (!url) return;
    try {
        chrome.storage.local.set({
            [BG_CACHE_KEY]: url,
            [BG_FETCHED_AT_KEY]: Date.now()
        });
    } catch (e) { /* ignore */ }
}

async function fetchRandomNatureBg() {
    const base = (PROXY_BASE_URL || '').trim();
    if (!base) return;
    try {
        const res = await fetch(base.replace(/\/$/, '') + '/api/unsplash-random', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        const url = data.url;
        if (!url) return;
        setBgImageUrl(url);
        saveBgCache(url);
    } catch (_) {}
}

function nextBgImage() {
    fetchRandomNatureBg();
}

function startBgRotation() {
    // On tab load/refresh: only show cached image, no network calls
    chrome.storage.local.get([BG_CACHE_KEY], (result) => {
        if (result[BG_CACHE_KEY]) {
            setBgImageUrl(result[BG_CACHE_KEY]);
        }
    });
    if (bgRotateTimer) clearInterval(bgRotateTimer);
    // New image only when user clicks the refresh button (nextBgImage), not on load or timer
}

// Apply theme
function applyTheme(theme) {
    document.body.className = '';
    
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else if (theme === 'glass') {
        document.body.classList.add('glass-theme');
    }
    
    currentTheme = theme;
    saveSettings();
    
    // Update active theme button
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    
    // Debug resize indicators after theme change
    setTimeout(() => {
        debugResizeIndicators();
    }, 100);
}

// Search notes
function searchNotes(query) {
    searchQuery = query.toLowerCase();
    renderNotes();
}

// Filter notes based on search query
function getFilteredNotes() {
    if (!searchQuery) return notes;
    
    return notes.filter(note => {
        const titleMatch = (note.title || '').toLowerCase().includes(searchQuery);
        const contentMatch = (note.content || '').toLowerCase().includes(searchQuery);
        const tagMatch = (note.tags || []).some(tag => tag.toLowerCase().includes(searchQuery));
        
        return titleMatch || contentMatch || tagMatch;
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Safe for inline style/CSS (persisted data could be tampered)
function safeCssColor(value) {
    if (!value || typeof value !== 'string') return '#fef3c7';
    const s = value.trim();
    if (/^#[0-9A-Fa-f]{3}$/.test(s) || /^#[0-9A-Fa-f]{6}$/.test(s)) return s;
    return '#fef3c7';
}

var ALLOWED_PRIORITIES = Object.freeze(['low', 'medium', 'high']);
function safePriority(value) {
    if (!value || typeof value !== 'string') return null;
    const v = value.toLowerCase();
    return ALLOWED_PRIORITIES.includes(v) ? v : null;
}

// Render all notes
function renderNotes() {
    const container = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');
    
    const filteredNotes = getFilteredNotes();
    
    if (filteredNotes.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    container.innerHTML = filteredNotes.map(note => {
        const wordCount = countWords(note.content || '');
        const safePriorityVal = safePriority(note.priority);
        const priorityClass = safePriorityVal ? `priority-${safePriorityVal}` : '';
        const tags = note.tags || [];
        const formatting = note.formatting || { bold: false, italic: false, code: false };
        
        // Calculate grid column and row span based on width and height
        const baseColumnWidth = 158; // Base grid column width
        const rowHeight = 272;
        const gapWidth = 24;
        
        let gridStyles = [];
        
        const safeW = Number(note.width);
        const safeH = Number(note.height);
        if (Number.isFinite(safeW) && safeW > 0) {
            const columns = Math.max(1, Math.ceil(safeW / (baseColumnWidth + gapWidth)));
            gridStyles.push(`grid-column: span ${columns}`);
            gridStyles.push(`width: ${Math.min(safeW, 2000)}px`);
            gridStyles.push(`max-width: 100%`);
        }
        if (Number.isFinite(safeH) && safeH > 0) {
            const rows = Math.max(1, Math.ceil(safeH / (rowHeight + gapWidth)));
            gridStyles.push(`grid-row: span ${rows}`);
            gridStyles.push(`height: ${Math.min(safeH, 2000)}px`);
            gridStyles.push(`max-height: 100%`);
        }
        
        // Add background color with opacity for glassmorphic effect (sanitized for persisted data)
        const noteColor = safeCssColor(note.color);
        gridStyles.push(`background-color: ${noteColor}`);
        
        const styleAttr = gridStyles.length > 0 ? ` style="${gridStyles.join('; ')}"` : '';
        
        return `
            <div class="note ${note.pinned ? 'pinned' : ''}" 
                 data-note-id="${note.id}"${styleAttr}>
                <div class="note-header">
                    <div class="note-title-wrapper">
                        <input 
                            type="text" 
                            class="note-title" 
                            placeholder="Note title" 
                            value="${escapeHtml(note.title)}"
                            data-field="title"
                        >
                        <div class="note-meta" data-tag-count="${tags.length > 0 ? `${tags.length} tag${tags.length > 1 ? 's' : ''}` : ''}">
                            ${tags.map(tag => `
                                <span class="note-tag" data-tag="${escapeHtml(tag)}">
                                    ${safePriorityVal ? `<span class="priority-marker ${priorityClass}"></span>` : ''}
                                    ${escapeHtml(tag)}
                                    <svg class="remove-tag" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    <div class="note-actions">
                        <button class="note-btn pin-btn ${note.pinned ? 'active' : ''}" title="${note.pinned ? 'Unpin note' : 'Pin note'}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 17v5"></path>
                                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
                            </svg>
                        </button>
                        <button class="note-btn delete-btn" title="Delete note">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="note-content-wrapper">
                    <div class="note-content-area">
                        <textarea 
                            class="note-content ${formatting.bold ? 'bold' : ''} ${formatting.italic ? 'italic' : ''} ${formatting.code ? 'code' : ''}" 
                            placeholder="Start typing your note..."
                            data-field="content"
                        >${escapeHtml(note.content || '')}</textarea>
                        <div class="selection-overlay hidden" data-note-id="${note.id}" aria-hidden="true"></div>
                    </div>
                    <div class="selection-toolbar hidden" data-note-id="${note.id}">
                        <button type="button" class="selection-toolbar-btn" title="Ask AI to transform selected text" aria-label="Ask AI to transform selected text (expand, shorten, fix, etc.)" data-tooltip="Ask AI to transform selected text (expand, shorten, fix, etc.)">
                            <span>✨</span>
                            <span>Ask AI</span>
                        </button>
                    </div>
                    <div class="ai-write-pill hidden" data-note-id="${note.id}">
                        <span class="ai-write-pill-hint">✨</span>
                        <input type="text" class="ai-write-pill-input" placeholder="What to write? (Enter)" autocomplete="off">
                        <div class="ai-write-pill-loading hidden">
                            <span class="ai-write-pill-dots"><span></span><span></span><span></span></span>
                        </div>
                    </div>
                </div>
                <div class="dictation-indicator" data-note-id="${note.id}">
                    <span class="dictation-indicator-dot"></span>
                    <span class="dictation-indicator-label">Listening…</span>
                    <button type="button" class="dictation-indicator-stop" title="Stop dictation" aria-label="Stop dictation">×</button>
                </div>
                <div class="note-footer">
                    <div class="note-toolbar">
                        <button class="toolbar-btn bold-btn ${formatting.bold ? 'active' : ''}" title="Bold">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                            </svg>
                        </button>
                        <button class="toolbar-btn italic-btn ${formatting.italic ? 'active' : ''}" title="Italic">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="4" x2="10" y2="4"></line>
                                <line x1="14" y1="20" x2="5" y2="20"></line>
                                <line x1="15" y1="4" x2="9" y2="20"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn bullet-btn" title="Add bullet point">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="5" cy="6" r="2" fill="currentColor" stroke="none"></circle>
                                <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"></circle>
                                <circle cx="5" cy="18" r="2" fill="currentColor" stroke="none"></circle>
                                <line x1="12" y1="6" x2="21" y2="6"></line>
                                <line x1="12" y1="12" x2="21" y2="12"></line>
                                <line x1="12" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn checkbox-btn" title="Add checkbox (Click checkbox to toggle • Ctrl+Enter)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <polyline points="9 12 12 15 20 7" opacity="0.5"></polyline>
                            </svg>
                        </button>
                        <button class="toolbar-btn tag-btn" title="Add tag">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn color-btn" title="Change color">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                            </svg>
                        </button>
                        <button class="toolbar-btn dictation-btn" title="Dictate (speak to type)" data-tooltip="Dictate (speak to type)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn ai-write-btn" title="AI" data-tooltip="AI">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 0 1-9 9"></path>
                                <path d="M20 3v4"></path>
                                <path d="M22 5h-4"></path>
                            </svg>
                        </button>
                        <button class="toolbar-btn toolbar-more-btn" title="More options" data-tooltip="More options">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <circle cx="12" cy="12" r="2"></circle>
                                <circle cx="19" cy="12" r="2"></circle>
                                <circle cx="5" cy="12" r="2"></circle>
                            </svg>
                        </button>
                    </div>
                    <div class="toolbar-drawer">
                        <button class="toolbar-btn bold-btn ${formatting.bold ? 'active' : ''}" title="Bold" data-label="Bold">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                            </svg>
                        </button>
                        <button class="toolbar-btn italic-btn ${formatting.italic ? 'active' : ''}" title="Italic" data-label="Italic">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="4" x2="10" y2="4"></line>
                                <line x1="14" y1="20" x2="5" y2="20"></line>
                                <line x1="15" y1="4" x2="9" y2="20"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn bullet-btn" title="Add bullet point" data-label="Bullet">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="5" cy="6" r="2" fill="currentColor" stroke="none"></circle>
                                <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"></circle>
                                <circle cx="5" cy="18" r="2" fill="currentColor" stroke="none"></circle>
                                <line x1="12" y1="6" x2="21" y2="6"></line>
                                <line x1="12" y1="12" x2="21" y2="12"></line>
                                <line x1="12" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn checkbox-btn" title="Add checkbox" data-label="Checkbox">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <polyline points="9 12 12 15 20 7" opacity="0.5"></polyline>
                            </svg>
                        </button>
                        <button class="toolbar-btn tag-btn" title="Add tag" data-label="Tag">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn color-btn" title="Change color" data-label="Color">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                            </svg>
                        </button>
                        <button class="toolbar-btn dictation-btn" title="Dictate (speak to type)" data-label="Dictate" data-tooltip="Dictate (speak to type)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>
                        <button class="toolbar-btn ai-write-btn" title="AI" data-label="AI" data-tooltip="AI">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 0 1-9 9"></path>
                                <path d="M20 3v4"></path>
                                <path d="M22 5h-4"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="note-footer-right">
                        <span class="note-timestamp">${formatTimestamp(note.timestamp)}</span>
                    </div>
                </div>
                <div class="resize-indicator"></div>
            </div>
        `;
    }).join('');
    
    attachEventListeners();
    
    // Debug resize indicators
    debugResizeIndicators();
}

function debugResizeIndicators() {
    // No-op in production (no console logging of DOM/CSS)
}

// Attach event listeners to note elements
function attachEventListeners() {
    // Initialize custom drag
    initCustomDrag();
    
    // Initialize resize
    initResize();
    
    // Initialize responsive toolbar
    initResponsiveToolbars();
    
    // Title and content inputs
    document.querySelectorAll('.note-title, .note-content').forEach(input => {
        input.addEventListener('input', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            const field = e.target.dataset.field;
            updateNote(noteId, field, e.target.value);
            
            // Auto-scroll for textarea content to keep cursor visible
            if (field === 'content' && e.target.tagName === 'TEXTAREA') {
                autoScrollToCursor(e.target);
            }
        });
    });
    
    // Pill click-to-focus when opened with selection (keeps selection visible until user interacts)
    document.querySelectorAll('.ai-write-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            if (e.target === pill || pill.contains(e.target)) {
                const input = pill.querySelector('.ai-write-pill-input');
                if (input && document.activeElement !== input) {
                    input.focus();
                }
            }
        });
    });

    // Smart list handling for note content
    document.querySelectorAll('.note-content').forEach(textarea => {
        textarea.addEventListener('keydown', (e) => {
            const noteElement = textarea.closest('.note');
            const pill = noteElement?.querySelector('.ai-write-pill');
            if (pill && !pill.classList.contains('hidden') && aiWriteSelection) {
                e.preventDefault();
                const input = pill.querySelector('.ai-write-pill-input');
                if (input) {
                    input.focus();
                    if (e.key === 'Escape') {
                        closeAiWriteInline(noteElement.dataset.noteId);
                    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        input.value += e.key;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                return;
            }
            handleSmartListKeys(e);
            
            // Auto-scroll after Enter key or arrow keys
            if (e.key === 'Enter' || e.key.startsWith('Arrow')) {
                setTimeout(() => {
                    autoScrollToCursor(textarea);
                }, 0);
            }
        });
    });
    
    // Pin buttons
    document.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            togglePin(noteId);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            showDeleteModal(noteId);
        });
    });
    
    // Formatting buttons
    document.querySelectorAll('.bold-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            toggleFormatting(noteId, 'bold');
        });
    });
    
    document.querySelectorAll('.italic-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            toggleFormatting(noteId, 'italic');
        });
    });

    // Dictation buttons (toolbar and drawer - drawer may be in body)
    document.querySelectorAll('.dictation-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = noteElement?.dataset.noteId || drawer?.dataset.noteId;
            if (noteId) {
                toggleDictation(noteId);
            }
        });
    });

    // Dictation indicator stop button
    document.querySelectorAll('.dictation-indicator-stop').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const indicator = e.target.closest('.dictation-indicator');
            const noteId = indicator?.dataset.noteId;
            if (noteId && dictatingNoteId === noteId) {
                stopDictation();
            }
        });
    });

    // AI write buttons
    document.querySelectorAll('.ai-write-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = noteElement?.dataset.noteId || drawer?.dataset.noteId;
            if (noteId) {
                const el = noteId ? document.querySelector(`[data-note-id="${noteId}"]`) : null;
                const textarea = el?.querySelector('.note-content');
                if (textarea) textarea.focus();
                openAiWriteInline(noteId);
            }
        });
    });

    // Selection toolbar - show when text selected, Ask AI opens pill
    document.querySelectorAll('.selection-toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolbar = e.target.closest('.selection-toolbar');
            const noteId = toolbar?.dataset.noteId;
            if (noteId) {
                const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
                const textarea = noteElement?.querySelector('.note-content');
                if (textarea) {
                    textarea.focus();
                    openAiWriteInline(noteId);
                }
            }
        });
    });

    // Fixed-position tooltips for all [data-tooltip] (escapes overflow: hidden)
    const tooltipEl = document.getElementById('selectionTooltip');
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            const target = e.currentTarget;
            const text = target.getAttribute('data-tooltip');
            if (!text || !tooltipEl) return;
            const rect = target.getBoundingClientRect();
            tooltipEl.textContent = text;
            tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
            tooltipEl.style.top = `${rect.top - 4}px`;
            tooltipEl.style.transform = 'translate(-50%, -100%)';
            tooltipEl.classList.remove('hidden');
        });
        el.addEventListener('mouseleave', () => {
            if (tooltipEl) tooltipEl.classList.add('hidden');
        });
    });

    document.querySelectorAll('.note-content').forEach(textarea => {
        const checkSelection = () => updateSelectionToolbar(textarea);
        textarea.addEventListener('mouseup', checkSelection);
        textarea.addEventListener('keyup', checkSelection);
    });
    document.addEventListener('selectionchange', () => {
        const active = document.activeElement;
        if (active?.classList?.contains('note-content')) {
            updateSelectionToolbar(active);
        } else {
            document.querySelectorAll('.selection-toolbar').forEach(t => t.classList.add('hidden'));
        }
    });

    // AI write pill - submit on Enter, close on Escape
    document.querySelectorAll('.ai-write-pill-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            const pill = e.target.closest('.ai-write-pill');
            const noteId = pill?.dataset.noteId;
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitAiWriteInline(noteId, e.target);
            } else if (e.key === 'Escape') {
                closeAiWriteInline(noteId);
            }
        });
    });

    
    // Bullet button - smart insertion based on current line
    document.querySelectorAll('.bullet-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const textarea = noteElement.querySelector('.note-content');
            const cursorPos = textarea.selectionStart;
            const text = textarea.value;
            
            // Get current line to detect indentation
            const lines = text.substring(0, cursorPos).split('\n');
            const currentLine = lines[lines.length - 1];
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            const newText = text.substring(0, cursorPos) + '\n' + indent + '• ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.focus();
            textarea.setSelectionRange(cursorPos + indent.length + 3, cursorPos + indent.length + 3);
            
            const noteId = noteElement.dataset.noteId;
            updateNote(noteId, 'content', newText);
        });
    });
    
    // Checkbox button - smart insertion based on current line
    document.querySelectorAll('.checkbox-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const textarea = noteElement.querySelector('.note-content');
            const cursorPos = textarea.selectionStart;
            const text = textarea.value;
            
            // Get current line to detect indentation
            const lines = text.substring(0, cursorPos).split('\n');
            const currentLine = lines[lines.length - 1];
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            const newText = text.substring(0, cursorPos) + '\n' + indent + '☐ ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.focus();
            textarea.setSelectionRange(cursorPos + indent.length + 3, cursorPos + indent.length + 3);

            const noteId = noteElement.dataset.noteId;
            updateNote(noteId, 'content', newText);
        });
    });
    
    // Toggle checkboxes on click
    document.querySelectorAll('.note-content').forEach(textarea => {
        textarea.addEventListener('click', (e) => {
            toggleCheckboxAtCursor(textarea);
        });
        
        // Also allow keyboard shortcut to toggle checkbox
        textarea.addEventListener('keydown', (e) => {
            // Ctrl+Enter or Cmd+Enter to toggle checkbox on current line
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                toggleCheckboxAtCursor(textarea, true);
            }
        });
    });
    
    // Color buttons (in toolbar, not drawer)
    document.querySelectorAll('.note-toolbar .color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const noteElement = btn.closest('.note');
            if (!noteElement) return;
            
            const noteId = noteElement.dataset.noteId;
            const colorModal = document.getElementById('colorModal');
            
            // Toggle modal: if it's already open, close it
            if (!colorModal.classList.contains('hidden')) {
                colorModal.classList.add('hidden');
                return;
            }
            
            // Otherwise, open it
            currentNoteId = noteId;
            const rect = btn.getBoundingClientRect();
            colorModal.style.top = `${rect.bottom + 10}px`;
            colorModal.style.left = `${rect.left}px`;
            colorModal.classList.remove('hidden');
        });
    });
    
    // Tag button (in toolbar, not drawer)
    document.querySelectorAll('.note-toolbar .tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const noteElement = btn.closest('.note');
            if (!noteElement) return;
            
            const noteId = noteElement.dataset.noteId;
            const tagModal = document.getElementById('tagModal');
            const tagInput = document.getElementById('tagInput');
            
            // Toggle modal: if it's already open, close it
            if (!tagModal.classList.contains('hidden')) {
                tagModal.classList.add('hidden');
                if (tagInput) tagInput.value = '';
                return;
            }
            
            // Otherwise, open it
            currentNoteId = noteId;
            const rect = btn.getBoundingClientRect();
            tagModal.style.top = `${rect.bottom + 10}px`;
            tagModal.style.left = `${rect.left}px`;
            tagModal.classList.remove('hidden');
            
            // Populate existing tags
            populateExistingTags(noteId);
            
            setTimeout(() => tagInput.focus(), 100);
        });
    });
    
    // Event listeners for drawer buttons (same as toolbar buttons)
    // Bold buttons in drawer
    document.querySelectorAll('.toolbar-drawer .bold-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (noteId) {
                toggleFormatting(noteId, 'bold');
            }
        });
    });
    
    // Italic buttons in drawer
    document.querySelectorAll('.toolbar-drawer .italic-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (noteId) {
                toggleFormatting(noteId, 'italic');
            }
        });
    });
    
    // Bullet buttons in drawer
    document.querySelectorAll('.toolbar-drawer .bullet-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (!noteId) return;
            
            const noteElement = document.querySelector(`.note[data-note-id="${noteId}"]`);
            if (!noteElement) return;
            
            const textarea = noteElement.querySelector('.note-content');
            const cursorPos = textarea.selectionStart;
            const text = textarea.value;
            
            const lines = text.substring(0, cursorPos).split('\n');
            const currentLine = lines[lines.length - 1];
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            const newText = text.substring(0, cursorPos) + '\n' + indent + '• ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.focus();
            textarea.setSelectionRange(cursorPos + indent.length + 3, cursorPos + indent.length + 3);
            
            updateNote(noteId, 'content', newText);
        });
    });
    
    // Checkbox buttons in drawer
    document.querySelectorAll('.toolbar-drawer .checkbox-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = e.target.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (!noteId) return;
            
            const noteElement = document.querySelector(`.note[data-note-id="${noteId}"]`);
            if (!noteElement) return;
            
            const textarea = noteElement.querySelector('.note-content');
            const cursorPos = textarea.selectionStart;
            const text = textarea.value;
            
            const lines = text.substring(0, cursorPos).split('\n');
            const currentLine = lines[lines.length - 1];
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            const newText = text.substring(0, cursorPos) + '\n' + indent + '☐ ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.focus();
            textarea.setSelectionRange(cursorPos + indent.length + 3, cursorPos + indent.length + 3);

            updateNote(noteId, 'content', newText);
        });
    });
    
    // Color buttons in drawer
    document.querySelectorAll('.toolbar-drawer .color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = btn.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (!noteId) return;
            
            const colorModal = document.getElementById('colorModal');
            
            // Toggle modal: if it's already open, close it
            if (!colorModal.classList.contains('hidden')) {
                colorModal.classList.add('hidden');
                return;
            }
            
            // Otherwise, open it
            currentNoteId = noteId;
            const rect = btn.getBoundingClientRect();
            colorModal.style.top = `${rect.bottom + 10}px`;
            colorModal.style.left = `${rect.left}px`;
            colorModal.classList.remove('hidden');
        });
    });
    
    // Tag buttons in drawer
    document.querySelectorAll('.toolbar-drawer .tag-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Drawer might be in body, so get note ID from drawer's dataset
            const drawer = btn.closest('.toolbar-drawer');
            const noteId = drawer?.dataset.noteId;
            if (!noteId) return;
            
            const tagModal = document.getElementById('tagModal');
            const tagInput = document.getElementById('tagInput');
            
            // Toggle modal: if it's already open, close it
            if (!tagModal.classList.contains('hidden')) {
                tagModal.classList.add('hidden');
                if (tagInput) tagInput.value = '';
                return;
            }
            
            // Otherwise, open it
            currentNoteId = noteId;
            const rect = btn.getBoundingClientRect();
            tagModal.style.top = `${rect.bottom + 10}px`;
            tagModal.style.left = `${rect.left}px`;
            tagModal.classList.remove('hidden');
            
            // Populate existing tags
            populateExistingTags(noteId);
            
            setTimeout(() => tagInput.focus(), 100);
        });
    });
    
    // Remove tag buttons
    document.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.noteId;
            const tagElement = e.target.closest('.note-tag');
            const tag = tagElement.dataset.tag;
            removeTag(noteId, tag);
        });
    });
}

// Attach global event listeners
function attachGlobalEventListeners() {
    // Add note button
    document.getElementById('addNoteBtn')?.addEventListener('click', createNote);
    
    // Google search form
    const googleSearchForm = document.getElementById('googleSearchForm');
    const googleSearchInput = document.getElementById('googleSearchInput');
    
    if (googleSearchForm && googleSearchInput) {
        googleSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = googleSearchInput.value.trim();
            
            if (query) {
                // Check if it looks like a URL
                if (query.includes('.') && !query.includes(' ')) {
                    // Try to navigate to it as a URL
                    const url = query.startsWith('http') ? query : 'https://' + query;
                    window.location.href = url;
                } else {
                    // Search using preferred engine
                    const searchUrl = SEARCH_ENGINE_URLS[preferredSearchEngine] || SEARCH_ENGINE_URLS.google;
                    window.location.href = searchUrl + encodeURIComponent(query);
                }
            }
        });
    }
    
    // Search notes input
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.getElementById('searchContainer');
    const searchTrigger = document.getElementById('searchTrigger');
    
    searchInput?.addEventListener('input', (e) => {
        searchNotes(e.target.value);
    });
    
    // Expand search on trigger click
    searchTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        searchContainer?.classList.add('expanded');
        setTimeout(() => searchInput?.focus(), 50);
    });
    
    // Expand on input focus (e.g. tab)
    searchInput?.addEventListener('focus', () => {
        searchContainer?.classList.add('expanded');
    });
    
    // Collapse when clicking outside
    document.addEventListener('click', (e) => {
        if (searchContainer && !searchContainer.contains(e.target)) {
            searchContainer.classList.remove('expanded');
        }
    });
    
    // Theme switcher
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
        });
    });

    document.getElementById('bgRefreshBtn')?.addEventListener('click', () => {
        nextBgImage();
    });
    
    // Color palette
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            if (currentNoteId) {
                changeNoteColor(currentNoteId, color);
            }
            document.getElementById('colorModal').classList.add('hidden');
        });
    });
    
    // More button - show drawer with all toolbar options (using event delegation)
    document.addEventListener('click', (e) => {
        const moreBtn = e.target.closest('.toolbar-more-btn');
        const clickedDrawer = e.target.closest('.toolbar-drawer');
        
        if (moreBtn) {
            e.stopPropagation();
            e.preventDefault();
            
            const noteFooter = moreBtn.closest('.note-footer');
            const noteElement = moreBtn.closest('.note');
            
            if (!noteFooter || !noteElement) return;
            
            const noteId = noteElement.dataset.noteId;
            
            // First check if drawer is already in body (from previous open)
            let drawer = document.querySelector(`.toolbar-drawer[data-note-id="${noteId}"]`);
            
            // If not in body, look for it in the note footer
            if (!drawer) {
                drawer = noteFooter.querySelector('.toolbar-drawer');
            }
            
            if (!drawer) return;
            
            // Close all other open drawers
            document.querySelectorAll('.toolbar-drawer.show').forEach(d => {
                if (d !== drawer) {
                    d.classList.remove('show');
                    
                    // Find the note this drawer belongs to (it might be in body now)
                    const otherNoteId = d.dataset.noteId;
                    if (otherNoteId) {
                        const otherNote = document.querySelector(`.note[data-note-id="${otherNoteId}"]`);
                        if (otherNote) {
                            const otherBtn = otherNote.querySelector('.toolbar-more-btn');
                            if (otherBtn) otherBtn.classList.remove('active');
                        }
                    }
                }
            });
            
            // Check if drawer is currently showing
            const isCurrentlyShowing = drawer.classList.contains('show');
            
            if (!isCurrentlyShowing) {
                // Move drawer to body to avoid containing block issues
                if (drawer.parentElement !== document.body) {
                    drawer.dataset.originalParent = noteFooter.dataset.noteId || 'unknown';
                    document.body.appendChild(drawer);
                }
                
                // Position drawer above the more button
                const rect = moreBtn.getBoundingClientRect();
                drawer.style.left = `${rect.left}px`;
                drawer.style.top = `${rect.top - 8}px`;
                drawer.style.transform = 'translateY(-100%)';
                
                // Store reference to which note this drawer belongs to
                drawer.dataset.noteId = noteFooter.closest('.note').dataset.noteId;
                
                drawer.classList.add('show');
                moreBtn.classList.add('active');
            } else {
                drawer.classList.remove('show');
                moreBtn.classList.remove('active');
            }
        } else if (!clickedDrawer) {
            // Clicked outside - close all drawers
            const openDrawers = document.querySelectorAll('.toolbar-drawer.show');
            if (openDrawers.length > 0) {
                openDrawers.forEach(drawer => {
                    drawer.classList.remove('show');
                    
                    // Find the note this drawer belongs to (it might be in body now)
                    const noteId = drawer.dataset.noteId;
                    if (noteId) {
                        const note = document.querySelector(`.note[data-note-id="${noteId}"]`);
                        if (note) {
                            const btn = note.querySelector('.toolbar-more-btn');
                            if (btn) btn.classList.remove('active');
                        }
                    }
                });
            }
        }
    });
    
    // Tag input
    const tagInput = document.getElementById('tagInput');
    tagInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && currentNoteId) {
            const tag = tagInput.value.trim();
            if (tag) {
                addTag(currentNoteId, tag);
                tagInput.value = '';
                document.getElementById('tagModal').classList.add('hidden');
            }
        }
    });
    
    // Name input modal
    const nameInput = document.getElementById('nameInput');
    const nameSubmitBtn = document.getElementById('nameSubmitBtn');
    
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveUserName();
            }
        });
    }
    
    if (nameSubmitBtn) {
        nameSubmitBtn.addEventListener('click', saveUserName);
    }
    
    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsForm = document.getElementById('settingsForm');
    
    settingsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal();
    });
    
    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSettingsFromModal();
    });
    
    // Delete modal buttons
    document.getElementById('deleteModalCancel')?.addEventListener('click', () => {
        document.getElementById('deleteModal')?.classList.add('hidden');
        pendingDeleteNoteId = null;
    });
    document.getElementById('deleteModalConfirm')?.addEventListener('click', () => {
        if (pendingDeleteNoteId) {
            deleteNote(pendingDeleteNoteId);
            pendingDeleteNoteId = null;
        }
        document.getElementById('deleteModal')?.classList.add('hidden');
    });

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const colorModal = document.getElementById('colorModal');
        const tagModal = document.getElementById('tagModal');
        const tagInput = document.getElementById('tagInput');
        const nameModal = document.getElementById('nameModal');
        const settingsModal = document.getElementById('settingsModal');
        
        // Don't allow closing name modal by clicking outside (required on first visit)
        if (nameModal && !nameModal.classList.contains('hidden')) {
            // Prevent closing by clicking on the backdrop
            if (e.target === nameModal) {
                e.stopPropagation();
                return; // Prevent closing
            }
        }
        
        // Check if clicking outside color modal
        if (colorModal && !colorModal.classList.contains('hidden')) {
            if (!colorModal.contains(e.target) && !e.target.closest('.color-btn')) {
                colorModal.classList.add('hidden');
            }
        }
        
        // Check if clicking outside tag modal
        if (tagModal && !tagModal.classList.contains('hidden')) {
            const clickedTagBtn = e.target.closest('.tag-btn');
            const clickedModal = tagModal.contains(e.target);
            
            if (!clickedModal && !clickedTagBtn) {
                tagModal.classList.add('hidden');
                if (tagInput) tagInput.value = '';
            }
        }
        
        // Check if clicking outside settings modal
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            if (!settingsModal.contains(e.target) && !e.target.closest('.settings-btn')) {
                settingsModal.classList.add('hidden');
            }
        }
        
        // Check if clicking outside delete modal (on backdrop)
        const deleteModal = document.getElementById('deleteModal');
        if (deleteModal && !deleteModal.classList.contains('hidden')) {
            if (e.target === deleteModal) {
                deleteModal.classList.add('hidden');
                pendingDeleteNoteId = null;
            }
        }

        // Close AI write pill when clicking outside
        document.querySelectorAll('.ai-write-pill:not(.hidden)').forEach(pill => {
            if (!pill.contains(e.target) && !e.target.closest('.ai-write-btn')) {
                closeAiWriteInline(pill.dataset.noteId);
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N to create new note
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNote();
        }
        
        // Escape to close modals (but not name modal on first visit)
        if (e.key === 'Escape') {
            const nameModal = document.getElementById('nameModal');
            // Don't allow closing name modal with Escape if it's the first visit
            if (nameModal && !nameModal.classList.contains('hidden')) {
                const nameInput = document.getElementById('nameInput');
                if (nameInput && nameInput.value.trim()) {
                    // If there's text, allow closing
                    return;
                }
            }
            
            document.getElementById('colorModal')?.classList.add('hidden');
            const tagModal = document.getElementById('tagModal');
            const tagInput = document.getElementById('tagInput');
            const settingsModal = document.getElementById('settingsModal');
            const deleteModal = document.getElementById('deleteModal');
            if (tagModal) tagModal.classList.add('hidden');
            if (tagInput) tagInput.value = '';
            if (settingsModal) settingsModal.classList.add('hidden');
            if (deleteModal) {
                deleteModal.classList.add('hidden');
                pendingDeleteNoteId = null;
            }
            document.querySelectorAll('.ai-write-pill:not(.hidden)').forEach(pill => {
                closeAiWriteInline(pill.dataset.noteId);
            });
        }
    });
}

// Custom drag and drop like Google Keep
let isDragging = false;
let draggedNoteId = null;
let draggedElement = null;
let dragClone = null;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let dragStartDelay = null;
let originalIndex = -1;
let lastHoveredId = null;
let dragThrottle = null;

function initCustomDrag() {
    document.querySelectorAll('.note').forEach(note => {
        // Remove native drag
        note.draggable = false;
        
        note.addEventListener('mousedown', handleMouseDown);
    });
}

function handleMouseDown(e) {
    // Don't drag if clicking on interactive elements
    const target = e.target;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('.note-actions') ||
        target.closest('.note-toolbar') ||
        target.closest('.note-tag')) {
        return;
    }
    
    const noteElement = e.currentTarget;
    
    // Don't drag if resizing
    if (isResizing) {
        return;
    }
    
    const rect = noteElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const noteHeight = rect.height;
    const noteWidth = rect.width;
    const edgeZone = 20; // pixels from top/bottom
    const cornerSize = 20; // Size of the resize corner area
    
    // Don't drag if clicking in bottom-right corner (resize area)
    const isInResizeCorner = clickX > (noteWidth - cornerSize) && clickY > (noteHeight - cornerSize);
    if (isInResizeCorner) {
        return; // Let resize handler take over
    }
    
    // Only allow dragging from edges (top or bottom 20px, but not the resize corner)
    // Only allow drag if clicking in top or bottom edge zone
    if (clickY > edgeZone && clickY < (noteHeight - edgeZone)) {
        return;
    }
    
    e.preventDefault();
    const initialX = e.clientX;
    const initialY = e.clientY;
    let hasMoved = false;
    
    // Small delay before starting drag (like Google Keep)
    dragStartDelay = setTimeout(() => {
        if (!hasMoved) {
            startDragging(noteElement, e);
        }
    }, 100);
    
    // Cancel if mouse moves too much before delay expires
    const checkMove = (moveEvent) => {
        const deltaX = Math.abs(moveEvent.clientX - initialX);
        const deltaY = Math.abs(moveEvent.clientY - initialY);
        if (deltaX > 5 || deltaY > 5) {
            hasMoved = true;
        }
    };
    
    // Cancel if mouse releases quickly
    const cancelDrag = () => {
        if (dragStartDelay) {
            clearTimeout(dragStartDelay);
            dragStartDelay = null;
        }
        document.removeEventListener('mousemove', checkMove);
        document.removeEventListener('mouseup', cancelDrag);
    };
    
    document.addEventListener('mousemove', checkMove);
    document.addEventListener('mouseup', cancelDrag, { once: true });
}

function startDragging(noteElement, e) {
    isDragging = true;
    draggedElement = noteElement;
    draggedNoteId = noteElement.dataset.noteId;
    originalIndex = notes.findIndex(n => n.id === draggedNoteId);
    
    const rect = noteElement.getBoundingClientRect();
    
    // Create clone for dragging
    dragClone = noteElement.cloneNode(true);
    dragClone.classList.add('drag-clone');
    dragClone.classList.remove('dragging-source');
    dragClone.classList.remove('pinned');
    
    // Set all styles inline to prevent any CSS interference
    dragClone.style.cssText = `
        position: fixed !important;
        pointer-events: none !important;
        z-index: 999999 !important;
        width: ${rect.width}px !important;
        height: ${rect.height}px !important;
        min-height: ${rect.height}px !important;
        max-height: ${rect.height}px !important;
        left: ${rect.left}px !important;
        top: ${rect.top}px !important;
        margin: 0 !important;
        opacity: 1 !important;
        transition: none !important;
        animation: none !important;
        transform: rotate(0deg) scale(1) !important;
        will-change: transform, left, top !important;
    `;
    
    document.body.appendChild(dragClone);
    
    // Make original element invisible but keep space
    noteElement.style.opacity = '0.3';
    noteElement.classList.add('dragging-source');
    
    // Store initial mouse position relative to note
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    // Add mouse move and up listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (!isDragging || !dragClone) return;
    
    e.preventDefault();
    
    // Move clone to follow cursor precisely in 2D space
    const x = e.clientX - startX;
    const y = e.clientY - startY;
    
    // Use requestAnimationFrame for smooth 60fps movement
    requestAnimationFrame(() => {
        if (dragClone) {
            dragClone.style.left = x + 'px';
            dragClone.style.top = y + 'px';
            dragClone.style.transform = 'rotate(3deg) scale(1.05)';
        }
    });
    
    // Throttle reorder checks to reduce re-renders
    if (dragThrottle) return;
    
    dragThrottle = setTimeout(() => {
        dragThrottle = null;
        
        // Check which note we're hovering over for reordering
        const hoveredNote = getHoveredNote(e.clientX, e.clientY);
        if (hoveredNote && hoveredNote !== draggedElement) {
            const hoveredId = hoveredNote.dataset.noteId;
            if (hoveredId !== lastHoveredId) {
                lastHoveredId = hoveredId;
                reorderNotesSmooth(hoveredId);
            }
        }
    }, 50);
}

function handleMouseUp(e) {
    if (!isDragging) return;
    
    isDragging = false;
    lastHoveredId = null;
    
    // Clear any pending throttle
    if (dragThrottle) {
        clearTimeout(dragThrottle);
        dragThrottle = null;
    }
    
    // Animate clone back to final position before removing
    if (dragClone && draggedElement) {
        const finalRect = draggedElement.getBoundingClientRect();
        dragClone.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        dragClone.style.left = finalRect.left + 'px';
        dragClone.style.top = finalRect.top + 'px';
        dragClone.style.transform = 'rotate(0deg) scale(1)';
        
        setTimeout(() => {
            if (dragClone) {
                dragClone.remove();
                dragClone = null;
            }
        }, 200);
    }
    
    // Restore original element
    if (draggedElement) {
        setTimeout(() => {
            if (draggedElement) {
                draggedElement.style.opacity = '';
                draggedElement.classList.remove('dragging-source');
            }
        }, 200);
    }
    
    // Save final order
    saveNotes();
    
    // Cleanup
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    setTimeout(() => {
        draggedElement = null;
        draggedNoteId = null;
        originalIndex = -1;
    }, 200);
}

function getHoveredNote(x, y) {
    // Temporarily hide the clone to get element underneath
    if (dragClone) dragClone.style.display = 'none';
    
    const element = document.elementFromPoint(x, y);
    const note = element?.closest('.note:not(.dragging-source)');
    
    if (dragClone) dragClone.style.display = '';
    
    return note;
}

// Resize functionality
let isResizing = false;
let resizingNoteId = null;
let resizingElement = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

function initResize() {
    // Add mousemove listener to show resize cursor on bottom-right corner
    document.querySelectorAll('.note').forEach(note => {
        note.addEventListener('mousemove', (e) => {
            if (isResizing) return;
            
            const rect = note.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cornerSize = 20; // Size of the corner area
            
            // Check if mouse is in bottom-right corner
            const isInCorner = x > (rect.width - cornerSize) && y > (rect.height - cornerSize);
            
            // Don't show resize cursor if hovering over interactive elements
            const target = e.target;
            if (target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.tagName === 'BUTTON' ||
                target.closest('button') ||
                target.closest('.note-actions') ||
                target.closest('.note-toolbar') ||
                target.closest('.note-tag')) {
                note.style.cursor = '';
                return;
            }
            
            // Don't show resize cursor if in edge grab zones (top/bottom edges for dragging)
            const edgeZone = 20;
            const isInEdgeZone = y <= edgeZone || y >= (rect.height - edgeZone);
            if (isInEdgeZone && !isInCorner) {
                note.style.cursor = '';
                return;
            }
            
            if (isInCorner) {
                note.style.cursor = 'grab';
            } else {
                note.style.cursor = '';
            }
        });
        
        note.addEventListener('mouseleave', () => {
            note.style.cursor = '';
        });
        
        // Add mousedown listener to detect clicks in bottom-right corner
        note.addEventListener('mousedown', (e) => {
            if (isResizing) return;
            
            // Don't resize if clicking on interactive elements
            const target = e.target;
            if (target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.tagName === 'BUTTON' ||
                target.closest('button') ||
                target.closest('.note-actions') ||
                target.closest('.note-toolbar') ||
                target.closest('.note-tag')) {
                return;
            }
            
            const rect = note.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cornerSize = 20; // Size of the corner area
            
            // Check if click is in bottom-right corner
            const isInCorner = x > (rect.width - cornerSize) && y > (rect.height - cornerSize);
            
            if (isInCorner) {
                e.stopPropagation(); // Prevent drag handler from interfering
                e.preventDefault();
                // Pass the note element directly
                handleResizeStart(e, note);
            }
        }, true); // Use capture phase to run before drag handler
    });
}

function handleResizeStart(e, noteElement) {
    e.preventDefault();
    e.stopPropagation();
    
    // Use passed noteElement or try to find it
    if (!noteElement) {
        noteElement = e.currentTarget || e.target.closest('.note');
    }
    if (!noteElement) return;
    
    isResizing = true;
    resizingElement = noteElement;
    resizingNoteId = noteElement.dataset.noteId;
    
    const rect = noteElement.getBoundingClientRect();
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = rect.width;
    resizeStartHeight = rect.height;
    
    // Add resizing class for visual feedback
    noteElement.classList.add('resizing');
    document.body.style.cursor = 'grabbing';
    
    // Prevent the grid from affecting this note during resize
    noteElement.style.position = 'relative';
    noteElement.style.zIndex = '1000';
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e) {
    if (!isResizing || !resizingElement) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;
    
    // Calculate new dimensions with minimum constraints
    const baseColumnWidth = 158; // Base grid column width
    const defaultNoteWidth = 340; // Default note width (spans ~2 columns)
    const rowHeight = 272;
    const gapWidth = 24;
    const minWidth = 158; // Allows 2 shrunk notes to fit in space of 1 default note
    const minHeight = 272;
    const maxWidth = baseColumnWidth * 8; // Max 8 small columns
    const maxHeight = rowHeight * 5; // Max 5 rows
    
    let newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartWidth + deltaX));
    let newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartHeight + deltaY));
    
    // Snap width to grid columns when close (within 30px of a column boundary)
    const targetColumn = Math.round((newWidth + gapWidth) / (baseColumnWidth + gapWidth));
    const snappedWidth = targetColumn * (baseColumnWidth + gapWidth) - gapWidth;
    
    if (Math.abs(newWidth - snappedWidth) < 30) {
        newWidth = snappedWidth;
    }
    
    // Snap height to grid rows when close (within 30px of a row boundary)
    const targetRow = Math.round((newHeight + gapWidth) / (rowHeight + gapWidth));
    const snappedHeight = targetRow * (rowHeight + gapWidth) - gapWidth;
    
    if (Math.abs(newHeight - snappedHeight) < 30) {
        newHeight = snappedHeight;
    }
    
    // Apply new size smoothly
    requestAnimationFrame(() => {
        if (resizingElement) {
            resizingElement.style.width = newWidth + 'px';
            resizingElement.style.height = newHeight + 'px';
            resizingElement.style.maxWidth = '100%';
            resizingElement.style.maxHeight = '100%';
            
            // Update grid span in real-time for visual feedback (round UP to prevent overlap)
            const columns = Math.max(1, Math.ceil(newWidth / (baseColumnWidth + gapWidth)));
            const rows = Math.max(1, Math.ceil(newHeight / (rowHeight + gapWidth)));
            resizingElement.style.gridColumn = `span ${columns}`;
            resizingElement.style.gridRow = `span ${rows}`;
        }
    });
}

function handleResizeEnd(e) {
    if (!isResizing) return;
    
    isResizing = false;
    document.body.style.cursor = '';
    
    if (resizingElement) {
        resizingElement.classList.remove('resizing');
        
        // Clean up inline styles
        resizingElement.style.position = '';
        resizingElement.style.zIndex = '';
        
        // Save the new size to the note
        const note = notes.find(n => n.id === resizingNoteId);
        if (note) {
            const rect = resizingElement.getBoundingClientRect();
            const newWidth = Math.round(rect.width);
            const newHeight = Math.round(rect.height);
            
            note.width = newWidth;
            note.height = newHeight;
            
            // Update grid-column and grid-row span (round UP to prevent overlap)
            const baseColumnWidth = 158;
            const rowHeight = 272;
            const gapWidth = 24;
            const columns = Math.max(1, Math.ceil(newWidth / (baseColumnWidth + gapWidth)));
            const rows = Math.max(1, Math.ceil(newHeight / (rowHeight + gapWidth)));
            resizingElement.style.gridColumn = `span ${columns}`;
            resizingElement.style.gridRow = `span ${rows}`;
            resizingElement.style.maxWidth = '100%';
            resizingElement.style.maxHeight = '100%';
            
            // Update toolbar display based on new width
            updateToolbarDisplay(resizingElement);
            
            saveNotes();
        }
    }
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    
    resizingElement = null;
    resizingNoteId = null;
}

// Responsive toolbar - show "more" button on narrow notes
function initResponsiveToolbars() {
    document.querySelectorAll('.note').forEach(note => {
        updateToolbarDisplay(note);
    });
    
    // Update on window resize - use requestAnimationFrame to avoid ResizeObserver loop warning
    const resizeObserver = new ResizeObserver(entries => {
        requestAnimationFrame(() => {
            entries.forEach(entry => {
                if (entry.target.classList.contains('note')) {
                    updateToolbarDisplay(entry.target);
                }
            });
        });
    });
    
    document.querySelectorAll('.note').forEach(note => {
        resizeObserver.observe(note);
    });
}

function updateToolbarDisplay(noteElement) {
    const drawer = noteElement.querySelector('.toolbar-drawer');
    const moreBtn = noteElement.querySelector('.toolbar-more-btn');
    
    const noteWidth = noteElement.offsetWidth;
    const defaultWidth = 340;
    const compactThreshold = defaultWidth - 10;
    
    if (noteWidth < compactThreshold) {
        noteElement.classList.add('compact-note');
    } else {
        noteElement.classList.remove('compact-note');
        if (drawer) drawer.classList.remove('show');
        if (moreBtn) moreBtn.classList.remove('active');
    }
}

// Auto-scroll textarea to keep cursor visible when typing
function autoScrollToCursor(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;
    
    // Use setTimeout to ensure DOM is updated after input
    setTimeout(() => {
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;
        const textareaHeight = textarea.clientHeight;
        const textareaScrollHeight = textarea.scrollHeight;
        const textareaScrollTop = textarea.scrollTop;
        
        // If content doesn't overflow, no need to scroll
        if (textareaScrollHeight <= textareaHeight) return;
        
        // Create a temporary div to measure text height before cursor
        const tempDiv = document.createElement('div');
        const styles = window.getComputedStyle(textarea);
        
        // Copy all relevant styles exactly
        tempDiv.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            word-break: ${styles.wordBreak || 'normal'};
            font-family: ${styles.fontFamily};
            font-size: ${styles.fontSize};
            line-height: ${styles.lineHeight};
            padding: ${styles.padding};
            margin: ${styles.margin};
            width: ${textarea.offsetWidth}px;
            box-sizing: border-box;
            border: ${styles.border};
            letter-spacing: ${styles.letterSpacing};
        `;
        
        // Get text before cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        tempDiv.textContent = textBeforeCursor;
        
        // Append to body (off-screen) to measure
        document.body.appendChild(tempDiv);
        
        // Calculate cursor position from top of content
        const cursorTop = tempDiv.offsetHeight;
        const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.6;
        
        // Clean up
        document.body.removeChild(tempDiv);
        
        // Calculate if cursor is visible
        const cursorRelativeTop = cursorTop - textareaScrollTop;
        const buffer = lineHeight * 1.5; // Buffer space for better UX
        
        // Scroll if cursor is near bottom of visible area
        if (cursorRelativeTop > textareaHeight - buffer) {
            // Scroll down to show cursor with buffer
            const targetScrollTop = cursorTop - textareaHeight + buffer;
            textarea.scrollTop = Math.min(targetScrollTop, textareaScrollHeight - textareaHeight);
        } else if (cursorRelativeTop < buffer && textareaScrollTop > 0) {
            // Scroll up if cursor is near top (but don't scroll if already at top)
            textarea.scrollTop = Math.max(0, cursorTop - buffer);
        }
    }, 0);
}

// Toggle checkbox at cursor position
function toggleCheckboxAtCursor(textarea, forceToggle = false) {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const lines = text.split('\n');
    
    // Find which line the cursor is on
    let currentPos = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length >= cursorPos) {
            lineIndex = i;
            break;
        }
        currentPos += lines[i].length + 1; // +1 for newline
    }
    
    const currentLine = lines[lineIndex];
    const lineStart = currentPos;
    
    // Check if this line has a checkbox
    const checkboxMatch = currentLine.match(/^(\s*)(☐|☑|□|✓|✔)(\s+)/);
    if (checkboxMatch) {
        const clickPos = cursorPos - lineStart;
        const checkboxPos = checkboxMatch[1].length;
        
        // Toggle if force toggle (keyboard) or clicking near the checkbox
        if (forceToggle || (clickPos >= checkboxPos && clickPos <= checkboxPos + 3)) {
            const indent = checkboxMatch[1];
            const currentCheckbox = checkboxMatch[2];
            const space = checkboxMatch[3];
            const restOfLine = currentLine.substring(checkboxMatch[0].length);
            
            // Toggle between checked and unchecked
            const newCheckbox = (currentCheckbox === '☐' || currentCheckbox === '□') ? '☑' : '☐';
            const newLine = indent + newCheckbox + space + restOfLine;
            
            // Rebuild the text
            lines[lineIndex] = newLine;
            textarea.value = lines.join('\n');
            
            // Maintain cursor position
            textarea.setSelectionRange(cursorPos, cursorPos);
            
            const noteElement = textarea.closest('.note');
            const noteId = noteElement.dataset.noteId;
            updateNote(noteId, 'content', textarea.value);
            
            return true;
        }
    }
    return false;
}

// Smart list handling for auto-continuation and indentation
function handleSmartListKeys(e) {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    
    // Handle Enter key - auto-continue lists
    if (e.key === 'Enter' && !e.shiftKey) {
        const lines = text.substring(0, cursorPos).split('\n');
        const currentLine = lines[lines.length - 1];
        
        // Check for checkbox patterns
        const checkboxMatch = currentLine.match(/^(\s*)(☐|☑|□|✓|✔)\s/);
        if (checkboxMatch) {
            const indent = checkboxMatch[1];
            const checkbox = '☐'; // Always use empty checkbox for new line
            
            // If current line only has checkbox (empty), remove it instead of creating new one
            if (currentLine.trim() === checkboxMatch[0].trim()) {
                e.preventDefault();
                const beforeCursor = text.substring(0, cursorPos - currentLine.length);
                const afterCursor = text.substring(cursorPos);
                textarea.value = beforeCursor + '\n' + afterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeCursor.length + 1;
                textarea.dispatchEvent(new Event('input'));
                return;
            }
            
            e.preventDefault();
            const newText = text.substring(0, cursorPos) + '\n' + indent + checkbox + ' ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.selectionStart = textarea.selectionEnd = cursorPos + indent.length + 3;
            textarea.dispatchEvent(new Event('input'));
            return;
        }
        
        // Check for bullet patterns
        const bulletMatch = currentLine.match(/^(\s*)(•|·|-|\*)\s/);
        if (bulletMatch) {
            const indent = bulletMatch[1];
            const bullet = bulletMatch[2];
            
            // If current line only has bullet (empty), remove it instead of creating new one
            if (currentLine.trim() === bulletMatch[0].trim()) {
                e.preventDefault();
                const beforeCursor = text.substring(0, cursorPos - currentLine.length);
                const afterCursor = text.substring(cursorPos);
                textarea.value = beforeCursor + '\n' + afterCursor;
                textarea.selectionStart = textarea.selectionEnd = beforeCursor.length + 1;
                textarea.dispatchEvent(new Event('input'));
                return;
            }
            
            e.preventDefault();
            const newText = text.substring(0, cursorPos) + '\n' + indent + bullet + ' ' + text.substring(cursorPos);
            textarea.value = newText;
            textarea.selectionStart = textarea.selectionEnd = cursorPos + indent.length + 3;
            textarea.dispatchEvent(new Event('input'));
            return;
        }
    }
    
    // Handle Tab - indent current line
    if (e.key === 'Tab') {
        e.preventDefault();
        
        const lines = text.substring(0, cursorPos).split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLine = lines[currentLineIndex];
        const afterCursor = text.substring(cursorPos);
        
        // Find the start position of current line
        const lineStart = cursorPos - currentLine.length;
        
        if (e.shiftKey) {
            // Shift+Tab: Outdent (remove leading spaces/tabs)
            const outdentMatch = currentLine.match(/^(\s{1,4}|\t)(.*)$/);
            if (outdentMatch) {
                const newLine = outdentMatch[2];
                const removedSpaces = outdentMatch[1].length;
                const beforeLine = text.substring(0, lineStart);
                textarea.value = beforeLine + newLine + afterCursor;
                textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, cursorPos - removedSpaces);
                textarea.dispatchEvent(new Event('input'));
            }
        } else {
            // Tab: Indent (add 4 spaces)
            const indent = '    '; // 4 spaces
            const newLine = indent + currentLine;
            const beforeLine = text.substring(0, lineStart);
            textarea.value = beforeLine + newLine + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = cursorPos + indent.length;
            textarea.dispatchEvent(new Event('input'));
        }
    }
}

function reorderNotesSmooth(hoveredId) {
    if (!draggedNoteId || draggedNoteId === hoveredId || !isDragging) return;
    
    const draggedIndex = notes.findIndex(n => n.id === draggedNoteId);
    const hoveredIndex = notes.findIndex(n => n.id === hoveredId);
    
    if (draggedIndex !== -1 && hoveredIndex !== -1 && draggedIndex !== hoveredIndex) {
        // Just update the array order, don't re-render yet
        const [draggedNote] = notes.splice(draggedIndex, 1);
        notes.splice(hoveredIndex, 0, draggedNote);
        
        // Visually reorder in the DOM without full re-render
        const container = document.getElementById('notesContainer');
        const draggedEl = container.querySelector(`[data-note-id="${draggedNoteId}"]`);
        const hoveredEl = container.querySelector(`[data-note-id="${hoveredId}"]`);
        
        if (draggedEl && hoveredEl) {
            // Store positions before DOM manipulation
            const allNotes = Array.from(container.querySelectorAll('.note'));
            const positions = new Map();
            allNotes.forEach(note => {
                const rect = note.getBoundingClientRect();
                positions.set(note.dataset.noteId, { top: rect.top, left: rect.left });
            });
            
            // Move in DOM
            if (draggedIndex < hoveredIndex) {
                hoveredEl.parentNode.insertBefore(draggedEl, hoveredEl.nextSibling);
            } else {
                hoveredEl.parentNode.insertBefore(draggedEl, hoveredEl);
            }
            
            // Apply FLIP animation to all moved notes
            requestAnimationFrame(() => {
                const movedNotes = Array.from(container.querySelectorAll('.note:not(.dragging-source)'));
                
                movedNotes.forEach(note => {
                    const id = note.dataset.noteId;
                    const oldPos = positions.get(id);
                    
                    if (oldPos) {
                        const newRect = note.getBoundingClientRect();
                        const deltaX = oldPos.left - newRect.left;
                        const deltaY = oldPos.top - newRect.top;
                        
                        if (deltaX !== 0 || deltaY !== 0) {
                            note.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                            note.style.transition = 'none';
                            
                            requestAnimationFrame(() => {
                                note.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)';
                                note.style.transform = '';
                            });
                        }
                    }
                });
            });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
