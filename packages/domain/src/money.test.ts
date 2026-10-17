import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Money } from './money.js';

describe('Money precision math', () => {
  it('parses and formats amounts accurately without float error', () => {
    const q = Money.parse('1234.56', 2);
    assert.strictEqual(q.amount, 123456n);
    assert.strictEqual(q.precision, 2);
    assert.strictEqual(Money.format(q), '1234.56');
  });

  it('rejects precision overflow', () => {
    assert.throws(() => {
      Money.parse('100.123', 2);
    }, /exceeds permitted precision/);
  });

  it('adds and subtracts exact amounts', () => {
    const a = Money.parse('100.50', 2);
    const b = Money.parse('200.75', 2);
    const sum = Money.add(a, b);
    assert.strictEqual(Money.format(sum), '301.25');

    const diff = Money.subtract(b, a);
    assert.strictEqual(Money.format(diff), '100.25');
  });

  it('correctly compares quantities', () => {
    const a = Money.parse('50.00', 2);
    const b = Money.parse('100.00', 2);
    assert.strictEqual(Money.compare(a, b), -1);
    assert.strictEqual(Money.compare(b, a), 1);
    assert.strictEqual(Money.compare(a, a), 0);
  });
});
