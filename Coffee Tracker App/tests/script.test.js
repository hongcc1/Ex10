const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CoffeeTracker,
    DEFAULT_EMPTY_MESSAGE,
    calculateStatistics,
    loadCoffeeData,
    sanitizeCoffeeCollection,
    sortCoffeeByTimeDesc
} = require('../script.js');

function createMockElement(tagName = 'div', ownerDocument = null) {
    return {
        tagName: tagName.toUpperCase(),
        ownerDocument,
        children: [],
        parentNode: null,
        style: {},
        dataset: {},
        listeners: {},
        className: '',
        id: '',
        title: '',
        type: '',
        value: '',
        _textContent: '',
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);

            if (this.ownerDocument && child.id) {
                this.ownerDocument._elementsById[child.id] = child;
            }

            return child;
        },
        removeChild(child) {
            this.children = this.children.filter((currentChild) => currentChild !== child);
            child.parentNode = null;
            return child;
        },
        replaceChildren(...nodes) {
            this.children = nodes;
            this._textContent = '';

            nodes.forEach((node) => {
                node.parentNode = this;
            });
        },
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
        reset() {
            this.wasReset = true;
        },
        scrollIntoView() {
            this.wasScrolledIntoView = true;
        },
        set textContent(value) {
            this._textContent = String(value);
            this.children = [];
        },
        get textContent() {
            if (this.children.length > 0) {
                return this.children.map((child) => child.textContent).join('');
            }

            return this._textContent;
        },
        get classList() {
            return {
                contains: (className) => this.className.split(/\s+/).includes(className)
            };
        }
    };
}

function createMockDocument() {
    const document = {
        _elementsById: {},
        createElement(tagName) {
            return createMockElement(tagName, document);
        },
        getElementById(id) {
            return this._elementsById[id] || null;
        },
        addEventListener() {},
        head: null,
        body: null
    };

    document.head = createMockElement('head', document);
    document.body = createMockElement('body', document);

    const registerElement = (id, tagName = 'div') => {
        const element = createMockElement(tagName, document);
        element.id = id;
        document._elementsById[id] = element;
        return element;
    };

    registerElement('addCoffeeBtn', 'button');
    registerElement('resetBtn', 'button');
    registerElement('cancelBtn', 'button');
    const form = registerElement('coffeeForm', 'form');
    const coffeeType = registerElement('coffeeType', 'select');
    const coffeeSize = registerElement('coffeeSize', 'select');
    const coffeeTime = registerElement('coffeeTime', 'input');
    const coffeeNotes = registerElement('coffeeNotes', 'input');
    const addCoffeeForm = registerElement('addCoffeeForm', 'section');
    registerElement('todayCount', 'span');
    registerElement('coffeeList', 'div');
    registerElement('totalCups', 'span');
    registerElement('avgPerDay', 'span');
    registerElement('favoriteType', 'span');

    addCoffeeForm.style.display = 'none';

    form.reset = () => {
        form.wasReset = true;
        coffeeType.value = '';
        coffeeSize.value = '';
        coffeeTime.value = '';
        coffeeNotes.value = '';
    };

    return document;
}

function createMemoryStorage(initialValue = null) {
    const store = new Map();

    if (initialValue !== null) {
        store.set('coffeeData', initialValue);
    }

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, value);
        }
    };
}

test('loadCoffeeData falls back safely when local storage data is invalid', () => {
    const storage = createMemoryStorage('{not-valid-json');

    assert.deepEqual(loadCoffeeData(storage), []);
});

test('sanitizeCoffeeCollection keeps only valid normalized entries', () => {
    const sanitized = sanitizeCoffeeCollection([
        { id: '5', type: ' Latte ', size: 'Medium', time: '08:15', notes: '  oat milk  ', date: 'Thu Sep 18 2026' },
        { id: 'bad', type: 'Tea', size: 'Small', time: '08:15', date: 'Thu Sep 18 2026' },
        { id: '6', type: 'Mocha', size: 'Large', time: '25:00', date: 'Thu Sep 18 2026' }
    ], () => 1000, 'Thu Sep 18 2026');

    assert.deepEqual(sanitized, [
        {
            id: 5,
            type: 'Latte',
            size: 'Medium',
            time: '08:15',
            notes: 'oat milk',
            date: 'Thu Sep 18 2026'
        }
    ]);
});

test('calculateStatistics and sortCoffeeByTimeDesc return stable core app data', () => {
    const coffeeEntries = [
        { id: 1, type: 'Latte', size: 'Medium', time: '08:15', notes: '', date: 'Thu Sep 18 2026' },
        { id: 2, type: 'Espresso', size: 'Small', time: '09:45', notes: '', date: 'Thu Sep 18 2026' },
        { id: 3, type: 'Latte', size: 'Large', time: '07:30', notes: '', date: 'Fri Sep 19 2026' }
    ];

    assert.deepEqual(sortCoffeeByTimeDesc(coffeeEntries).map((entry) => entry.id), [2, 1, 3]);
    assert.deepEqual(calculateStatistics(coffeeEntries), {
        totalCups: 3,
        avgPerDay: '1.5',
        favoriteType: 'Latte'
    });
});

test('CoffeeTracker adds a coffee, updates statistics, and renders safe text content', () => {
    const document = createMockDocument();
    const storage = createMemoryStorage();
    const alerts = [];
    const now = new Date('2026-09-18T08:30:00');
    const tracker = new CoffeeTracker({
        document,
        storage,
        alert: (message) => alerts.push(message),
        confirm: () => true,
        now: () => now,
        schedule: () => {}
    });

    document.getElementById('coffeeType').value = 'Latte';
    document.getElementById('coffeeSize').value = 'Medium';
    document.getElementById('coffeeTime').value = '08:30';
    document.getElementById('coffeeNotes').value = '<b>extra shot</b>';

    assert.equal(tracker.addCoffee(), true);
    assert.deepEqual(alerts, []);
    assert.equal(document.getElementById('todayCount').textContent, '1');
    assert.equal(document.getElementById('totalCups').textContent, '1');
    assert.equal(document.getElementById('avgPerDay').textContent, '1.0');
    assert.equal(document.getElementById('favoriteType').textContent, 'Latte');
    assert.equal(document.getElementById('coffeeList').children.length, 1);
    assert.match(document.getElementById('coffeeList').children[0].textContent, /<b>extra shot<\/b>/);
    assert.equal(document.getElementById('addCoffeeForm').style.display, 'none');
    assert.equal(document.body.children.at(-1).textContent, 'Coffee added successfully! ☕');

    const savedEntries = JSON.parse(storage.getItem('coffeeData'));
    assert.equal(savedEntries.length, 1);
    assert.equal(savedEntries[0].notes, '<b>extra shot</b>');
});

test('CoffeeTracker resets only todays entries and restores the empty state message', () => {
    const today = new Date('2026-09-18T10:00:00');
    const yesterday = 'Wed Sep 17 2026';
    const storage = createMemoryStorage(JSON.stringify([
        { id: 1, type: 'Latte', size: 'Medium', time: '08:00', notes: '', date: today.toDateString() },
        { id: 2, type: 'Mocha', size: 'Large', time: '09:00', notes: '', date: yesterday }
    ]));
    const document = createMockDocument();
    const tracker = new CoffeeTracker({
        document,
        storage,
        alert: () => {},
        confirm: () => true,
        now: () => today,
        schedule: () => {}
    });

    assert.equal(tracker.resetToday(), true);
    assert.equal(tracker.coffeeData.length, 1);
    assert.equal(tracker.coffeeData[0].id, 2);
    assert.equal(document.getElementById('todayCount').textContent, '0');
    assert.equal(document.getElementById('coffeeList').children[0].textContent, DEFAULT_EMPTY_MESSAGE);
});
