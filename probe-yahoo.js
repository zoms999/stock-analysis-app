
const yfModule = require('yahoo-finance2');
console.log('Module keys:', Object.keys(yfModule));

const defaultExport = yfModule.default;
console.log('Default export type:', typeof defaultExport);

if (defaultExport && typeof defaultExport === 'object') {
    console.log('Default export keys:', Object.keys(defaultExport));
}

try {
    const { YahooFinance } = yfModule;
    if (YahooFinance) {
        console.log('Found named export YahooFinance');
        const yf = new YahooFinance();
        console.log('Successfully instantiated YahooFinance from named export');
    } else {
        console.log('Named export YahooFinance not found');
    }
} catch (e) {
    console.log('Failed to instantiate from named export:', e.message);
}

try {
    if (typeof defaultExport === 'function') {
        const yf = new defaultExport();
        console.log('Successfully instantiated from default export');
    }
} catch (e) {
    console.log('Failed to instantiate from default export:', e.message);
}
