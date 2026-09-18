class CoffeeTracker {
    constructor() {
        this.storageKeys = {
            data: 'coffeeData',
            preferences: 'coffeePreferences'
        };
        this.defaultPreferences = {
            dailyGoal: 3,
            darkMode: false,
            unit: 'oz'
        };
        this.currentEditingId = null;
        this.lastUndoState = null;
        this.coffeeData = this.loadCoffeeData();
        this.preferences = this.loadPreferences();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.applyPreferences();
        this.setCurrentDateTime();
        this.updateDisplay();
    }

    loadCoffeeData() {
        try {
            const savedData = JSON.parse(localStorage.getItem(this.storageKeys.data)) || [];
            return Array.isArray(savedData)
                ? savedData.map(entry => this.normalizeCoffeeEntry(entry)).filter(Boolean)
                : [];
        } catch (error) {
            return [];
        }
    }

    loadPreferences() {
        try {
            const savedPreferences = JSON.parse(localStorage.getItem(this.storageKeys.preferences)) || {};
            return {
                ...this.defaultPreferences,
                ...savedPreferences
            };
        } catch (error) {
            return { ...this.defaultPreferences };
        }
    }

    setupEventListeners() {
        document.getElementById('addCoffeeBtn').addEventListener('click', () => {
            this.showAddForm();
        });

        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undoLastAction();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToday();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddForm();
        });

        document.getElementById('coffeeForm').addEventListener('submit', (event) => {
            event.preventDefault();
            this.saveCoffee();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (event) => {
            this.importData(event);
        });

        document.getElementById('historyDateFilter').addEventListener('change', () => {
            this.updateDisplay();
        });

        document.getElementById('clearFilterBtn').addEventListener('click', () => {
            document.getElementById('historyDateFilter').value = '';
            this.updateDisplay();
        });

        document.getElementById('dailyGoal').addEventListener('change', () => {
            this.preferences.dailyGoal = this.getDailyGoalInputValue();
            this.savePreferences();
            this.updateDisplay();
        });

        document.getElementById('unitSetting').addEventListener('change', (event) => {
            this.preferences.unit = event.target.value === 'ml' ? 'ml' : 'oz';
            this.savePreferences();
            this.applyPreferences();
            this.updateDisplay();
        });

        document.getElementById('darkModeToggle').addEventListener('change', (event) => {
            this.preferences.darkMode = event.target.checked;
            this.savePreferences();
            this.applyPreferences();
        });
    }

    showAddForm(coffee = null) {
        const form = document.getElementById('addCoffeeForm');
        form.style.display = 'block';

        if (coffee) {
            this.currentEditingId = coffee.id;
            document.getElementById('formTitle').textContent = 'Edit Coffee';
            document.querySelector('#coffeeForm .submit-btn').textContent = 'Save Changes';
            document.getElementById('coffeeType').value = coffee.type;
            document.getElementById('coffeeSize').value = coffee.size;
            document.getElementById('coffeeTime').value = coffee.time;
            document.getElementById('coffeeDate').value = coffee.date;
            document.getElementById('coffeeNotes').value = coffee.notes || '';
        } else {
            this.resetEditingState();
            this.setCurrentDateTime();
        }

        form.scrollIntoView({ behavior: 'smooth' });
    }

    hideAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'none';
        this.clearForm();
        this.resetEditingState();
    }

    resetEditingState() {
        this.currentEditingId = null;
        document.getElementById('formTitle').textContent = 'Add a Coffee';
        document.querySelector('#coffeeForm .submit-btn').textContent = 'Add Coffee';
    }

    setCurrentDateTime() {
        const now = new Date();
        document.getElementById('coffeeTime').value = now.toTimeString().slice(0, 5);
        document.getElementById('coffeeDate').value = this.toDateInputValue(now);
    }

    saveCoffee() {
        const type = document.getElementById('coffeeType').value;
        const size = document.getElementById('coffeeSize').value;
        const time = document.getElementById('coffeeTime').value;
        const date = document.getElementById('coffeeDate').value;
        const notes = document.getElementById('coffeeNotes').value.trim();

        if (!type || !size || !time || !date) {
            alert('Please fill in all required fields');
            return;
        }

        const action = this.currentEditingId ? 'edit' : 'add';
        this.saveUndoState(action);

        if (this.currentEditingId) {
            this.coffeeData = this.coffeeData.map(coffee => coffee.id === this.currentEditingId
                ? { ...coffee, type, size, time, date, notes }
                : coffee
            );
        } else {
            this.coffeeData.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                type,
                size,
                time,
                date,
                notes
            });
        }

        this.saveData();
        this.updateDisplay();
        this.hideAddForm();
        this.showNotification(action === 'edit' ? 'Coffee updated successfully!' : 'Coffee added successfully! ☕');
    }

    startEditCoffee(id) {
        const coffee = this.coffeeData.find(entry => entry.id === id);
        if (coffee) {
            this.showAddForm(coffee);
        }
    }

    deleteCoffee(id) {
        if (!confirm('Are you sure you want to delete this coffee entry?')) {
            return;
        }

        this.saveUndoState('delete');
        this.coffeeData = this.coffeeData.filter(coffee => coffee.id !== id);
        this.saveData();
        this.updateDisplay();
        this.showNotification('Coffee entry deleted');
    }

    resetToday() {
        const today = this.toDateInputValue(new Date());
        const todaysCount = this.coffeeData.filter(coffee => coffee.date === today).length;

        if (todaysCount === 0) {
            this.showNotification('No coffee entries to reset today');
            return;
        }

        if (!confirm('Are you sure you want to reset today\'s coffee count?')) {
            return;
        }

        this.saveUndoState('reset');
        this.coffeeData = this.coffeeData.filter(coffee => coffee.date !== today);
        this.saveData();
        this.updateDisplay();
        this.showNotification('Today\'s coffee count has been reset');
    }

    saveUndoState(action) {
        this.lastUndoState = {
            action,
            coffeeData: JSON.parse(JSON.stringify(this.coffeeData)),
            preferences: { ...this.preferences }
        };
        this.updateUndoButton();
    }

    undoLastAction() {
        if (!this.lastUndoState) {
            return;
        }

        this.coffeeData = this.lastUndoState.coffeeData.map(entry => this.normalizeCoffeeEntry(entry)).filter(Boolean);
        this.preferences = {
            ...this.defaultPreferences,
            ...this.lastUndoState.preferences
        };
        this.saveData();
        this.savePreferences();
        this.applyPreferences();
        this.updateDisplay();
        this.lastUndoState = null;
        this.updateUndoButton();
        this.showNotification('Last change undone');
    }

    updateUndoButton() {
        document.getElementById('undoBtn').disabled = !this.lastUndoState;
    }

    getTodaysCoffee() {
        const today = this.toDateInputValue(new Date());
        return this.coffeeData.filter(coffee => coffee.date === today);
    }

    getFilteredCoffee() {
        const selectedDate = document.getElementById('historyDateFilter').value;
        const filteredCoffee = selectedDate
            ? this.coffeeData.filter(coffee => coffee.date === selectedDate)
            : [...this.coffeeData];

        return filteredCoffee.sort((a, b) => {
            const firstDate = new Date(`${a.date}T${a.time}`);
            const secondDate = new Date(`${b.date}T${b.time}`);
            return secondDate - firstDate;
        });
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateGoalStatus();
        this.updateCoffeeList();
        this.updateStatistics();
        this.updateUndoButton();
    }

    updateTodayCount() {
        document.getElementById('todayCount').textContent = this.getTodaysCoffee().length;
    }

    updateGoalStatus() {
        const todaysCount = this.getTodaysCoffee().length;
        const dailyGoal = this.getValidatedDailyGoal();
        const remaining = Math.max(dailyGoal - todaysCount, 0);
        const message = remaining === 0
            ? `Daily goal met: ${todaysCount} / ${dailyGoal} cups`
            : `Daily goal: ${todaysCount} / ${dailyGoal} cups`;
        document.getElementById('goalStatus').textContent = message;
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        const filteredCoffee = this.getFilteredCoffee();
        const filterDate = document.getElementById('historyDateFilter').value;

        coffeeList.innerHTML = '';

        if (filteredCoffee.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = filterDate
                ? 'No coffee recorded for the selected date.'
                : 'No coffee recorded yet. Add your first cup!';
            coffeeList.appendChild(emptyMessage);
            return;
        }

        filteredCoffee.forEach(coffee => {
            const item = document.createElement('div');
            item.className = 'coffee-item';

            const meta = document.createElement('div');
            meta.className = 'coffee-meta';

            const details = document.createElement('div');
            details.className = 'coffee-details';

            const type = document.createElement('div');
            type.className = 'coffee-type';
            type.textContent = coffee.type;

            const size = document.createElement('div');
            size.className = 'coffee-size';
            size.textContent = this.getSizeLabel(coffee.size);

            const date = document.createElement('div');
            date.className = 'coffee-date';
            date.textContent = this.formatDate(coffee.date);

            details.appendChild(type);
            details.appendChild(size);
            details.appendChild(date);

            if (coffee.notes) {
                const notes = document.createElement('div');
                notes.className = 'coffee-notes';
                notes.textContent = `"${coffee.notes}"`;
                details.appendChild(notes);
            }

            const actions = document.createElement('div');
            actions.className = 'coffee-actions';

            const time = document.createElement('div');
            time.className = 'coffee-time';
            time.textContent = this.formatTime(coffee.time);

            const editButton = document.createElement('button');
            editButton.className = 'edit-btn';
            editButton.type = 'button';
            editButton.textContent = 'Edit';
            editButton.title = 'Edit this entry';
            editButton.addEventListener('click', () => this.startEditCoffee(coffee.id));

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-btn';
            deleteButton.type = 'button';
            deleteButton.textContent = '×';
            deleteButton.title = 'Delete this entry';
            deleteButton.addEventListener('click', () => this.deleteCoffee(coffee.id));

            actions.appendChild(time);
            actions.appendChild(editButton);
            actions.appendChild(deleteButton);

            meta.appendChild(details);
            meta.appendChild(actions);
            item.appendChild(meta);
            coffeeList.appendChild(item);
        });
    }

    updateStatistics() {
        const totalCups = this.coffeeData.length;
        const filteredCoffee = this.getFilteredCoffee();
        const hasActiveFilter = Boolean(document.getElementById('historyDateFilter').value);

        document.getElementById('totalCups').textContent = totalCups;
        document.getElementById('filteredCups').textContent = filteredCoffee.length;
        document.getElementById('filteredCaffeine').textContent = `${filteredCoffee.reduce((total, coffee) => {
            return total + CoffeeUtils.estimateCaffeine(coffee.type, coffee.size);
        }, 0)} mg`;

        if (totalCups === 0) {
            document.getElementById('avgPerDay').textContent = '0';
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => coffee.date))];
        document.getElementById('avgPerDay').textContent = (totalCups / dates.length).toFixed(1);

        if (hasActiveFilter && filteredCoffee.length === 0) {
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const favoritePool = filteredCoffee.length > 0 ? filteredCoffee : this.coffeeData;
        const typeCount = {};
        favoritePool.forEach(coffee => {
            typeCount[coffee.type] = (typeCount[coffee.type] || 0) + 1;
        });

        const favoriteType = Object.keys(typeCount).reduce((a, b) => {
            return typeCount[a] >= typeCount[b] ? a : b;
        });
        document.getElementById('favoriteType').textContent = favoriteType;
    }

    formatTime(time24) {
        const [hours, minutes] = time24.split(':').map(Number);
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }

    formatDate(dateValue) {
        return new Date(`${dateValue}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    clearForm() {
        document.getElementById('coffeeForm').reset();
        this.setCurrentDateTime();
    }

    saveData() {
        localStorage.setItem(this.storageKeys.data, JSON.stringify(this.coffeeData));
    }

    savePreferences() {
        localStorage.setItem(this.storageKeys.preferences, JSON.stringify(this.preferences));
    }

    applyPreferences() {
        document.getElementById('dailyGoal').value = this.getValidatedDailyGoal();
        document.getElementById('unitSetting').value = this.preferences.unit;
        document.getElementById('darkModeToggle').checked = Boolean(this.preferences.darkMode);
        document.body.classList.toggle('dark-mode', Boolean(this.preferences.darkMode));
        this.updateSizeOptionLabels();
    }

    updateSizeOptionLabels() {
        const labels = {
            Small: { oz: 'Small (8 oz)', ml: 'Small (240 ml)' },
            Medium: { oz: 'Medium (12 oz)', ml: 'Medium (355 ml)' },
            Large: { oz: 'Large (16 oz)', ml: 'Large (475 ml)' },
            'Extra Large': { oz: 'Extra Large (20 oz)', ml: 'Extra Large (590 ml)' }
        };

        document.querySelectorAll('#coffeeSize option').forEach(option => {
            if (labels[option.value]) {
                option.textContent = labels[option.value][this.preferences.unit];
            }
        });
    }

    getSizeLabel(size) {
        const sizeMap = {
            Small: { oz: 'Small (8 oz)', ml: 'Small (240 ml)' },
            Medium: { oz: 'Medium (12 oz)', ml: 'Medium (355 ml)' },
            Large: { oz: 'Large (16 oz)', ml: 'Large (475 ml)' },
            'Extra Large': { oz: 'Extra Large (20 oz)', ml: 'Extra Large (590 ml)' }
        };

        return sizeMap[size] ? sizeMap[size][this.preferences.unit] : size;
    }

    getValidatedDailyGoal() {
        const goal = Number(this.preferences.dailyGoal);
        return goal > 0 ? goal : this.defaultPreferences.dailyGoal;
    }

    getDailyGoalInputValue() {
        const goal = Number(document.getElementById('dailyGoal').value);
        return goal > 0 ? goal : this.defaultPreferences.dailyGoal;
    }

    toDateInputValue(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
            .toISOString()
            .slice(0, 10);
    }

    normalizeCoffeeEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        const date = this.normalizeDate(entry.date);
        const time = typeof entry.time === 'string' && /^\d{2}:\d{2}$/.test(entry.time) ? entry.time : null;
        const type = typeof entry.type === 'string' ? entry.type.trim() : '';
        const size = typeof entry.size === 'string' ? entry.size.trim() : '';

        if (!date || !time || !type || !size) {
            return null;
        }

        return {
            id: Number(entry.id) || Date.now() + Math.floor(Math.random() * 1000),
            type,
            size,
            time,
            date,
            notes: typeof entry.notes === 'string' ? entry.notes.trim() : ''
        };
    }

    normalizeDate(dateValue) {
        if (typeof dateValue !== 'string' || !dateValue.trim()) {
            return null;
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }

        const parsedDate = new Date(dateValue);
        return Number.isNaN(parsedDate.getTime()) ? null : this.toDateInputValue(parsedDate);
    }

    exportData() {
        const backup = {
            coffeeData: this.coffeeData,
            preferences: this.preferences
        };
        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'coffee-tracker-backup.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Coffee data exported');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            try {
                const importedContent = JSON.parse(loadEvent.target.result);
                const importedData = Array.isArray(importedContent)
                    ? importedContent
                    : importedContent.coffeeData;
                const importedPreferences = Array.isArray(importedContent)
                    ? this.preferences
                    : { ...this.defaultPreferences, ...importedContent.preferences };

                if (!Array.isArray(importedData)) {
                    throw new Error('Invalid data format');
                }

                const normalizedData = importedData.map(entry => this.normalizeCoffeeEntry(entry)).filter(Boolean);
                if (normalizedData.length !== importedData.length) {
                    throw new Error('Invalid coffee entry detected');
                }

                this.saveUndoState('import');
                this.coffeeData = normalizedData;
                this.preferences = importedPreferences;
                this.saveData();
                this.savePreferences();
                this.applyPreferences();
                this.updateDisplay();
                this.showNotification('Data imported successfully!');
            } catch (error) {
                alert('Error importing data. Please make sure the file is valid.');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    showNotification(message) {
        const notification = document.createElement('div');
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

        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
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
            document.head.appendChild(style);
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

let tracker;

document.addEventListener('DOMContentLoaded', () => {
    tracker = new CoffeeTracker();

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            tracker.showAddForm();
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            tracker.undoLastAction();
        }

        if (event.key === 'Escape') {
            const form = document.getElementById('addCoffeeForm');
            if (form.style.display !== 'none') {
                tracker.hideAddForm();
            }
        }
    });
});

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
