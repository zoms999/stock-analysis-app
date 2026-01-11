// Test script for new achievement rate calculation
const { calculateAchievementRate } = require('./src/lib/utils/accuracy.ts');

console.log('=== Testing Achievement Rate Calculation ===\n');

// Day 1 Example
console.log('Day 1:');
console.log('Entry: 10,000, Target: 11,000, Current: 10,500');
const day1 = calculateAchievementRate(10000, 11000, 10500, 'LONG');
console.log(`Expected: 50%`);
console.log(`Actual: ${day1.toFixed(1)}%`);
console.log(`✓ Match: ${Math.abs(day1 - 50) < 0.1}\n`);

// Day 2 Example
console.log('Day 2:');
console.log('Entry: 10,500, Target: 12,000, Current: 11,500');
const day2 = calculateAchievementRate(10500, 12000, 11500, 'LONG');
console.log(`Expected: 66.6%`);
console.log(`Actual: ${day2.toFixed(1)}%`);
console.log(`✓ Match: ${Math.abs(day2 - 66.67) < 0.1}\n`);

// Additional test: Over-achievement
console.log('Over-achievement test:');
console.log('Entry: 10,000, Target: 11,000, Current: 12,000');
const overAchieve = calculateAchievementRate(10000, 11000, 12000, 'LONG');
console.log(`Expected: 200% (exceeded target)`);
console.log(`Actual: ${overAchieve.toFixed(1)}%\n`);

// Additional test: Opposite direction
console.log('Opposite direction test:');
console.log('Entry: 10,000, Target: 11,000, Current: 9,500');
const opposite = calculateAchievementRate(10000, 11000, 9500, 'LONG');
console.log(`Expected: 0% (moved down instead of up)`);
console.log(`Actual: ${opposite.toFixed(1)}%\n`);

// SHORT position test
console.log('SHORT position test:');
console.log('Entry: 10,000, Target: 9,000, Current: 9,500');
const shortTest = calculateAchievementRate(10000, 9000, 9500, 'SHORT');
console.log(`Expected: 50% (predicted -1000, actual -500)`);
console.log(`Actual: ${shortTest.toFixed(1)}%`);
