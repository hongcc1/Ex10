class CoffeeTracker {
    constructor() {
        this.coffeeData = JSON.parse(localStorage.getItem('coffeeData')) || [];
        this.editingCoffeeId = null;
        this.lastActionCoffeeId = null;
        this.highlightTimeoutId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.setCurrentTime();
    }

    setupEventListeners() {
        // Add coffee button
        document.getElementById('addCoffeeBtn').addEventListener('click', () => {
            this.showAddForm();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToday();
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddForm();
        });

        // Coffee form submission
        document.getElementById('coffeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCoffee();
        });

        document.getElementById('coffeeList').addEventListener('click', (e) => {
            const actionButton = e.target.closest('button[data-action]');
            if (!actionButton) {
                return;
            }

            const coffeeId = Number(actionButton.dataset.id);
            if (actionButton.dataset.action === 'edit') {
                this.editCoffee(coffeeId);
                return;
            }

            if (actionButton.dataset.action === 'delete') {
                this.deleteCoffee(coffeeId);
            }
        });
    }

    showAddForm() {
        const formSection = document.getElementById('addCoffeeForm');
        const addButton = document.getElementById('addCoffeeBtn');
        const isEditing = this.editingCoffeeId !== null;

        formSection.hidden = false;
        addButton.setAttribute('aria-expanded', 'true');
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!isEditing) {
            this.setCurrentTime();
            document.getElementById('coffeeType').focus();
            return;
        }

        document.getElementById('formTitle').focus();
    }

    hideAddForm() {
        const formSection = document.getElementById('addCoffeeForm');
        formSection.hidden = true;
        document.getElementById('addCoffeeBtn').setAttribute('aria-expanded', 'false');
        this.editingCoffeeId = null;
        document.getElementById('formTitle').textContent = 'Add a Coffee';
        document.querySelector('.submit-btn').textContent = 'Add Coffee';
        this.clearForm();
        document.getElementById('addCoffeeBtn').focus();
    }

    setCurrentTime() {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        document.getElementById('coffeeTime').value = timeString;
    }

    addCoffee() {
        const type = document.getElementById('coffeeType').value;
        const size = document.getElementById('coffeeSize').value;
        const time = document.getElementById('coffeeTime').value;
        const notes = document.getElementById('coffeeNotes').value;
        const originalCoffee = this.editingCoffeeId !== null
            ? this.coffeeData.find((entry) => entry.id === this.editingCoffeeId)
            : null;

        if (!type || !size || !time) {
            alert('Please fill in all required fields');
            return;
        }

        const coffee = {
            id: this.editingCoffeeId !== null ? this.editingCoffeeId : Date.now(),
            type,
            size,
            time,
            notes,
            date: originalCoffee ? originalCoffee.date : new Date().toDateString()
        };

        const isEditing = this.editingCoffeeId !== null;

        if (isEditing) {
            this.coffeeData = this.coffeeData.map((entry) =>
                entry.id === this.editingCoffeeId ? coffee : entry
            );
        } else {
            this.coffeeData.push(coffee);
        }

        this.lastActionCoffeeId = coffee.id;
        this.saveData();
        this.updateDisplay();
        this.hideAddForm();

        this.showNotification(
            isEditing ? 'Coffee entry updated successfully!' : 'Coffee added successfully! ☕',
            isEditing ? 'info' : 'success'
        );
    }

    editCoffee(id) {
        const coffee = this.coffeeData.find((entry) => entry.id === id);
        if (!coffee) {
            return;
        }

        this.editingCoffeeId = id;
        document.getElementById('formTitle').textContent = 'Edit Coffee Entry';
        document.querySelector('.submit-btn').textContent = 'Save Changes';
        document.getElementById('coffeeType').value = coffee.type;
        document.getElementById('coffeeSize').value = coffee.size;
        document.getElementById('coffeeTime').value = coffee.time;
        document.getElementById('coffeeNotes').value = coffee.notes || '';
        this.showAddForm();
        this.announceStatus(`Editing ${coffee.type} entry from ${this.formatTime(coffee.time)}.`);
    }

    deleteCoffee(id) {
        if (confirm('Are you sure you want to delete this coffee entry?')) {
            this.lastActionCoffeeId = null;
            this.coffeeData = this.coffeeData.filter(coffee => coffee.id !== id);
            this.saveData();
            this.updateDisplay();
            this.showNotification('Coffee entry deleted', 'info');
        }
    }

    resetToday() {
        if (confirm('Are you sure you want to reset today\'s coffee count?')) {
            const today = new Date().toDateString();
            this.coffeeData = this.coffeeData.filter(coffee => coffee.date !== today);
            this.saveData();
            this.updateDisplay();
            this.showNotification('Today\'s coffee count has been reset', 'info');
        }
    }

    getTodaysCoffee() {
        const today = new Date().toDateString();
        return this.coffeeData.filter(coffee => coffee.date === today);
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        document.getElementById('todayCount').textContent = todaysCoffee.length;
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        const todaysCoffee = this.getTodaysCoffee();

        if (todaysCoffee.length === 0) {
            coffeeList.innerHTML = `
                <div class="empty-message">
                    <strong>No coffee recorded today.</strong>
                    <p>Add your first cup to start building today's history and statistics.</p>
                </div>
            `;
            return;
        }

        // Sort by time (latest first)
        todaysCoffee.sort((a, b) => {
            const timeA = new Date(`2000/01/01 ${a.time}`);
            const timeB = new Date(`2000/01/01 ${b.time}`);
            return timeB - timeA;
        });

        coffeeList.innerHTML = todaysCoffee.map(coffee => `
            <div class="coffee-item${coffee.id === this.lastActionCoffeeId ? ' is-highlighted' : ''}" data-coffee-id="${coffee.id}">
                <div class="coffee-meta">
                    <div class="coffee-details">
                        <div class="coffee-type">${coffee.type}</div>
                        <div class="coffee-size">${coffee.size}</div>
                        ${coffee.notes ? `<div class="coffee-notes">"${coffee.notes}"</div>` : ''}
                    </div>
                    <div class="coffee-actions">
                        <div class="coffee-time">${this.formatTime(coffee.time)}</div>
                        <button class="entry-btn edit-btn" type="button" data-action="edit" data-id="${coffee.id}" aria-label="Edit ${coffee.type} entry at ${this.formatTime(coffee.time)}">Edit</button>
                        <button class="entry-btn delete-btn" type="button" data-action="delete" data-id="${coffee.id}" aria-label="Delete ${coffee.type} entry at ${this.formatTime(coffee.time)}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        if (this.lastActionCoffeeId !== null) {
            if (this.highlightTimeoutId !== null) {
                clearTimeout(this.highlightTimeoutId);
            }
            const highlightedCoffeeId = this.lastActionCoffeeId;
            this.highlightTimeoutId = setTimeout(() => {
                const highlightedItem = document.querySelector(`[data-coffee-id="${highlightedCoffeeId}"]`);
                if (highlightedItem) {
                    highlightedItem.classList.remove('is-highlighted');
                }
                if (this.lastActionCoffeeId === highlightedCoffeeId) {
                    this.lastActionCoffeeId = null;
                }
                this.highlightTimeoutId = null;
            }, 1400);
        }
    }

    updateStatistics() {
        const totalCups = this.coffeeData.length;
        document.getElementById('totalCups').textContent = totalCups;

        // Calculate average per day
        if (totalCups === 0) {
            document.getElementById('avgPerDay').textContent = '0';
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => coffee.date))];
        const avgPerDay = (totalCups / dates.length).toFixed(1);
        document.getElementById('avgPerDay').textContent = avgPerDay;

        // Find favorite coffee type
        const typeCount = {};
        this.coffeeData.forEach(coffee => {
            typeCount[coffee.type] = (typeCount[coffee.type] || 0) + 1;
        });

        const favoriteType = Object.keys(typeCount).reduce((a, b) => 
            typeCount[a] > typeCount[b] ? a : b
        );
        document.getElementById('favoriteType').textContent = favoriteType;
    }

    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    clearForm() {
        document.getElementById('coffeeForm').reset();
    }

    saveData() {
        localStorage.setItem('coffeeData', JSON.stringify(this.coffeeData));
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        notification.textContent = message;
        document.body.appendChild(notification);
        this.announceStatus(message);

        setTimeout(() => {
            notification.classList.add('notification-slideout');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    announceStatus(message) {
        document.getElementById('appStatus').textContent = message;
    }

    // Export data function
    exportData() {
        const dataStr = JSON.stringify(this.coffeeData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'coffee-data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // Import data function
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    this.coffeeData = importedData;
                    this.saveData();
                    this.updateDisplay();
                    this.showNotification('Data imported successfully!');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                alert('Error importing data. Please make sure the file is valid.');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize the coffee tracker when the page loads
let tracker;

document.addEventListener('DOMContentLoaded', () => {
    tracker = new CoffeeTracker();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to add coffee quickly
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            tracker.showAddForm();
        }
        
        // Escape to close form
        if (e.key === 'Escape') {
            const form = document.getElementById('addCoffeeForm');
            if (!form.hidden) {
                tracker.hideAddForm();
            }
        }
    });
});

// Add some utility functions for potential future enhancements
const CoffeeUtils = {
    // Calculate caffeine content based on coffee type and size
    estimateCaffeine(type, size) {
        const caffeineMap = {
            'Espresso': { base: 63, multiplier: 1 },
            'Americano': { base: 150, multiplier: 1 },
            'Latte': { base: 150, multiplier: 1 },
            'Cappuccino': { base: 150, multiplier: 1 },
            'Macchiato': { base: 75, multiplier: 1 },
            'Mocha': { base: 95, multiplier: 1 },
            'French Press': { base: 107, multiplier: 1 },
            'Cold Brew': { base: 200, multiplier: 1 },
            'Drip Coffee': { base: 95, multiplier: 1 }
        };

        const sizeMultiplier = {
            'Small': 0.75,
            'Medium': 1,
            'Large': 1.25,
            'Extra Large': 1.5
        };

        const coffee = caffeineMap[type] || { base: 95, multiplier: 1 };
        const sizeM = sizeMultiplier[size] || 1;
        
        return Math.round(coffee.base * coffee.multiplier * sizeM);
    },

    // Get coffee emoji based on type
    getCoffeeEmoji(type) {
        const emojiMap = {
            'Espresso': '☕',
            'Americano': '☕',
            'Latte': '🥛',
            'Cappuccino': '☕',
            'Macchiato': '☕',
            'Mocha': '🍫',
            'French Press': '☕',
            'Cold Brew': '🧊',
            'Drip Coffee': '☕'
        };
        return emojiMap[type] || '☕';
    }
};