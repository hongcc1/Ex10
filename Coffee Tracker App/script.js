const STORAGE_KEY = 'coffeeData';
const DEFAULT_EMPTY_MESSAGE = 'No coffee recorded today. Add your first cup!';
const VALID_COFFEE_TYPES = new Set([
    'Espresso',
    'Americano',
    'Latte',
    'Cappuccino',
    'Macchiato',
    'Mocha',
    'French Press',
    'Cold Brew',
    'Drip Coffee',
    'Other'
]);
const VALID_COFFEE_SIZES = new Set([
    'Small',
    'Medium',
    'Large',
    'Extra Large'
]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function safeJsonParse(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function normalizeText(value, maxLength = 120) {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().slice(0, maxLength);
}

function isValidTime(time) {
    return TIME_PATTERN.test(time);
}

function sanitizeCoffeeEntry(entry, fallbackDate = new Date().toDateString(), fallbackId = Date.now()) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const type = normalizeText(entry.type, 40);
    const size = normalizeText(entry.size, 20);
    const time = normalizeText(entry.time, 5);

    if (!VALID_COFFEE_TYPES.has(type) || !VALID_COFFEE_SIZES.has(size) || !isValidTime(time)) {
        return null;
    }

    const numericId = Number(entry.id);

    return {
        id: Number.isFinite(numericId) && numericId > 0 ? numericId : fallbackId,
        type,
        size,
        time,
        notes: normalizeText(entry.notes, 160),
        date: normalizeText(entry.date, 40) || fallbackDate
    };
}

function sanitizeCoffeeCollection(data, getFallbackId = () => Date.now(), fallbackDate = new Date().toDateString()) {
    if (!Array.isArray(data)) {
        return [];
    }

    const fallbackIdBase = getFallbackId();

    return data
        .map((entry, index) => sanitizeCoffeeEntry(entry, fallbackDate, fallbackIdBase + index))
        .filter(Boolean);
}

function loadCoffeeData(storage) {
    const storedData = storage && typeof storage.getItem === 'function'
        ? storage.getItem(STORAGE_KEY)
        : null;

    return sanitizeCoffeeCollection(safeJsonParse(storedData, []));
}

function sortCoffeeByTimeDesc(coffeeEntries) {
    return [...coffeeEntries].sort((first, second) => {
        if (first.time === second.time) {
            return second.id - first.id;
        }

        return second.time.localeCompare(first.time);
    });
}

function calculateStatistics(coffeeEntries) {
    const totalCups = coffeeEntries.length;

    if (totalCups === 0) {
        return {
            totalCups: 0,
            avgPerDay: '0',
            favoriteType: '-'
        };
    }

    const uniqueDates = new Set(coffeeEntries.map((coffee) => coffee.date));
    const typeCounts = new Map();

    coffeeEntries.forEach((coffee) => {
        typeCounts.set(coffee.type, (typeCounts.get(coffee.type) || 0) + 1);
    });

    let favoriteType = '-';
    let favoriteCount = -1;

    typeCounts.forEach((count, type) => {
        if (count > favoriteCount) {
            favoriteType = type;
            favoriteCount = count;
        }
    });

    return {
        totalCups,
        avgPerDay: (totalCups / uniqueDates.size).toFixed(1),
        favoriteType
    };
}

function formatTime(time24) {
    if (!isValidTime(time24)) {
        return time24;
    }

    const [hours, minutes] = time24.split(':').map(Number);
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';

    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

class CoffeeTracker {
    constructor(options = {}) {
        this.document = options.document || (typeof document !== 'undefined' ? document : null);
        this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.alert = options.alert || (typeof alert !== 'undefined' ? alert : () => {});
        this.confirm = options.confirm || (typeof confirm !== 'undefined' ? confirm : () => true);
        this.schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
        this.now = options.now || (() => new Date());
        this.coffeeData = loadCoffeeData(this.storage);
        this.elements = this.document ? this.cacheElements() : {};

        if (this.document) {
            this.init();
        }
    }

    cacheElements() {
        return {
            addCoffeeBtn: this.document.getElementById('addCoffeeBtn'),
            resetBtn: this.document.getElementById('resetBtn'),
            cancelBtn: this.document.getElementById('cancelBtn'),
            coffeeForm: this.document.getElementById('coffeeForm'),
            coffeeType: this.document.getElementById('coffeeType'),
            coffeeSize: this.document.getElementById('coffeeSize'),
            coffeeTime: this.document.getElementById('coffeeTime'),
            coffeeNotes: this.document.getElementById('coffeeNotes'),
            addCoffeeForm: this.document.getElementById('addCoffeeForm'),
            todayCount: this.document.getElementById('todayCount'),
            coffeeList: this.document.getElementById('coffeeList'),
            totalCups: this.document.getElementById('totalCups'),
            avgPerDay: this.document.getElementById('avgPerDay'),
            favoriteType: this.document.getElementById('favoriteType')
        };
    }

    hasRequiredElements() {
        return Object.values(this.elements).every(Boolean);
    }

    init() {
        if (!this.hasRequiredElements()) {
            return;
        }

        this.setupEventListeners();
        this.updateDisplay();
        this.setCurrentTime();
    }

    setupEventListeners() {
        this.elements.addCoffeeBtn.addEventListener('click', () => {
            this.showAddForm();
        });

        this.elements.resetBtn.addEventListener('click', () => {
            this.resetToday();
        });

        this.elements.cancelBtn.addEventListener('click', () => {
            this.hideAddForm();
        });

        this.elements.coffeeForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.addCoffee();
        });

        this.elements.coffeeList.addEventListener('click', (event) => {
            const target = event.target;
            const button = target && target.classList && target.classList.contains('delete-btn')
                ? target
                : null;

            if (!button) {
                return;
            }

            const coffeeId = Number(button.dataset.coffeeId);

            if (Number.isFinite(coffeeId)) {
                this.deleteCoffee(coffeeId);
            }
        });
    }

    getCurrentDateString() {
        return this.now().toDateString();
    }

    getCurrentTimeString() {
        return this.now().toTimeString().slice(0, 5);
    }

    showAddForm() {
        this.elements.addCoffeeForm.style.display = 'block';

        if (typeof this.elements.addCoffeeForm.scrollIntoView === 'function') {
            this.elements.addCoffeeForm.scrollIntoView({ behavior: 'smooth' });
        }

        this.setCurrentTime();
    }

    hideAddForm() {
        this.elements.addCoffeeForm.style.display = 'none';
        this.clearForm();
    }

    setCurrentTime() {
        this.elements.coffeeTime.value = this.getCurrentTimeString();
    }

    getFormData() {
        return {
            type: this.elements.coffeeType.value,
            size: this.elements.coffeeSize.value,
            time: this.elements.coffeeTime.value,
            notes: this.elements.coffeeNotes.value
        };
    }

    validateCoffeeData(formData) {
        const coffee = sanitizeCoffeeEntry(
            {
                id: this.now().getTime(),
                ...formData,
                date: this.getCurrentDateString()
            },
            this.getCurrentDateString(),
            this.now().getTime()
        );

        if (!coffee) {
            return {
                isValid: false,
                message: 'Please select a valid coffee type, size, and time.'
            };
        }

        return {
            isValid: true,
            coffee
        };
    }

    addCoffee() {
        const validation = this.validateCoffeeData(this.getFormData());

        if (!validation.isValid) {
            this.alert(validation.message);
            return false;
        }

        const previousCoffeeData = this.coffeeData;
        this.coffeeData = [...this.coffeeData, validation.coffee];

        if (!this.saveData()) {
            this.coffeeData = previousCoffeeData;
            return false;
        }

        this.updateDisplay();
        this.hideAddForm();
        this.showNotification('Coffee added successfully! ☕');

        return true;
    }

    deleteCoffee(id) {
        if (!this.confirm('Are you sure you want to delete this coffee entry?')) {
            return false;
        }

        const previousCoffeeData = this.coffeeData;
        const nextCoffeeData = this.coffeeData.filter((coffee) => coffee.id !== id);

        if (nextCoffeeData.length === previousCoffeeData.length) {
            return false;
        }

        this.coffeeData = nextCoffeeData;

        if (!this.saveData()) {
            this.coffeeData = previousCoffeeData;
            return false;
        }

        this.updateDisplay();
        this.showNotification('Coffee entry deleted');

        return true;
    }

    resetToday() {
        if (!this.confirm('Are you sure you want to reset today\'s coffee count?')) {
            return false;
        }

        const today = this.getCurrentDateString();
        const previousCoffeeData = this.coffeeData;
        this.coffeeData = this.coffeeData.filter((coffee) => coffee.date !== today);

        if (!this.saveData()) {
            this.coffeeData = previousCoffeeData;
            return false;
        }

        this.updateDisplay();
        this.showNotification('Today\'s coffee count has been reset');

        return true;
    }

    getTodaysCoffee() {
        const today = this.getCurrentDateString();
        return this.coffeeData.filter((coffee) => coffee.date === today);
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateTodayCount() {
        this.elements.todayCount.textContent = String(this.getTodaysCoffee().length);
    }

    createEmptyMessage() {
        const message = this.document.createElement('p');
        message.className = 'empty-message';
        message.textContent = DEFAULT_EMPTY_MESSAGE;
        return message;
    }

    createCoffeeItem(coffee) {
        const coffeeItem = this.document.createElement('div');
        coffeeItem.className = 'coffee-item';

        const coffeeMeta = this.document.createElement('div');
        coffeeMeta.className = 'coffee-meta';

        const coffeeDetails = this.document.createElement('div');
        coffeeDetails.className = 'coffee-details';

        const coffeeType = this.document.createElement('div');
        coffeeType.className = 'coffee-type';
        coffeeType.textContent = coffee.type;

        const coffeeSize = this.document.createElement('div');
        coffeeSize.className = 'coffee-size';
        coffeeSize.textContent = coffee.size;

        coffeeDetails.appendChild(coffeeType);
        coffeeDetails.appendChild(coffeeSize);

        if (coffee.notes) {
            const coffeeNotes = this.document.createElement('div');
            coffeeNotes.className = 'coffee-notes';
            coffeeNotes.textContent = `"${coffee.notes}"`;
            coffeeDetails.appendChild(coffeeNotes);
        }

        const coffeeActions = this.document.createElement('div');
        coffeeActions.className = 'coffee-item-actions';

        const coffeeTime = this.document.createElement('div');
        coffeeTime.className = 'coffee-time';
        coffeeTime.textContent = formatTime(coffee.time);

        const deleteButton = this.document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.dataset.coffeeId = String(coffee.id);
        deleteButton.title = 'Delete this entry';
        deleteButton.type = 'button';
        deleteButton.textContent = '×';

        coffeeActions.appendChild(coffeeTime);
        coffeeActions.appendChild(deleteButton);
        coffeeMeta.appendChild(coffeeDetails);
        coffeeMeta.appendChild(coffeeActions);
        coffeeItem.appendChild(coffeeMeta);

        return coffeeItem;
    }

    updateCoffeeList() {
        const todaysCoffee = sortCoffeeByTimeDesc(this.getTodaysCoffee());

        if (todaysCoffee.length === 0) {
            this.elements.coffeeList.replaceChildren(this.createEmptyMessage());
            return;
        }

        const coffeeItems = todaysCoffee.map((coffee) => this.createCoffeeItem(coffee));
        this.elements.coffeeList.replaceChildren(...coffeeItems);
    }

    updateStatistics() {
        const statistics = calculateStatistics(this.coffeeData);
        this.elements.totalCups.textContent = String(statistics.totalCups);
        this.elements.avgPerDay.textContent = statistics.avgPerDay;
        this.elements.favoriteType.textContent = statistics.favoriteType;
    }

    clearForm() {
        this.elements.coffeeForm.reset();
        this.setCurrentTime();
    }

    saveData() {
        if (!this.storage || typeof this.storage.setItem !== 'function') {
            return false;
        }

        try {
            this.storage.setItem(STORAGE_KEY, JSON.stringify(this.coffeeData));
            return true;
        } catch (error) {
            this.alert('Unable to save coffee data right now. Please try again.');
            return false;
        }
    }

    showNotification(message) {
        const notification = this.document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;

        if (!this.document.getElementById('notification-styles')) {
            const style = this.document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            this.document.head.appendChild(style);
        }

        notification.textContent = message;
        this.document.body.appendChild(notification);

        this.schedule(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            this.schedule(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    exportData() {
        const dataStr = JSON.stringify(this.coffeeData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = 'coffee-data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event && event.target && event.target.files ? event.target.files[0] : null;

        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            try {
                const importedData = safeJsonParse(loadEvent.target.result, null);

                if (!Array.isArray(importedData)) {
                    throw new Error('Invalid data format');
                }

                this.coffeeData = sanitizeCoffeeCollection(
                    importedData,
                    () => this.now().getTime(),
                    this.getCurrentDateString()
                );

                if (!this.saveData()) {
                    return;
                }

                this.updateDisplay();
                this.showNotification('Data imported successfully!');
            } catch (error) {
                this.alert('Error importing data. Please make sure the file is valid.');
            }
        };

        reader.readAsText(file);
    }
}

const CoffeeUtils = {
    estimateCaffeine(type, size) {
        const caffeineMap = {
            Espresso: { base: 63, multiplier: 1 },
            Americano: { base: 150, multiplier: 1 },
            Latte: { base: 150, multiplier: 1 },
            Cappuccino: { base: 150, multiplier: 1 },
            Macchiato: { base: 75, multiplier: 1 },
            Mocha: { base: 95, multiplier: 1 },
            'French Press': { base: 107, multiplier: 1 },
            'Cold Brew': { base: 200, multiplier: 1 },
            'Drip Coffee': { base: 95, multiplier: 1 }
        };

        const sizeMultiplier = {
            Small: 0.75,
            Medium: 1,
            Large: 1.25,
            'Extra Large': 1.5
        };

        const coffee = caffeineMap[type] || { base: 95, multiplier: 1 };
        const sizeM = sizeMultiplier[size] || 1;

        return Math.round(coffee.base * coffee.multiplier * sizeM);
    },

    getCoffeeEmoji(type) {
        const emojiMap = {
            Espresso: '☕',
            Americano: '☕',
            Latte: '🥛',
            Cappuccino: '☕',
            Macchiato: '☕',
            Mocha: '🍫',
            'French Press': '☕',
            'Cold Brew': '🧊',
            'Drip Coffee': '☕'
        };

        return emojiMap[type] || '☕';
    }
};

const exportedMembers = {
    CoffeeTracker,
    CoffeeUtils,
    DEFAULT_EMPTY_MESSAGE,
    STORAGE_KEY,
    calculateStatistics,
    formatTime,
    isValidTime,
    loadCoffeeData,
    normalizeText,
    safeJsonParse,
    sanitizeCoffeeCollection,
    sanitizeCoffeeEntry,
    sortCoffeeByTimeDesc
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportedMembers;
}

if (typeof window !== 'undefined') {
    window.CoffeeTracker = CoffeeTracker;
    window.CoffeeUtils = CoffeeUtils;
}

let tracker;

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        tracker = new CoffeeTracker();

        if (typeof window !== 'undefined') {
            window.tracker = tracker;
        }

        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                tracker.showAddForm();
            }

            if (event.key === 'Escape' && tracker.elements.addCoffeeForm.style.display !== 'none') {
                tracker.hideAddForm();
            }
        });
    });
}
