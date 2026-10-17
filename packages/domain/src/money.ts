import { Quantity } from './types.js';

/**
 * Exact monetary math using integer sub-units.
 * Strictly avoids IEEE 754 binary floating-point precision loss.
 */
export class Money {
  /**
   * Parse a decimal string (e.g., "1250.50") into a Quantity with sub-units.
   */
  static parse(decimalString: string, precision: number): Quantity {
    if (precision < 0 || precision > 18) {
      throw new Error(`Unsupported precision: ${precision}. Must be 0..18.`);
    }

    const trimmed = decimalString.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error(`Invalid decimal amount format: "${decimalString}"`);
    }

    const isNegative = trimmed.startsWith('-');
    const absStr = isNegative ? trimmed.slice(1) : trimmed;
    const [wholePart, fracPart = ''] = absStr.split('.');

    if (fracPart.length > precision) {
      throw new Error(
        `Amount "${decimalString}" exceeds permitted precision of ${precision} decimal places.`
      );
    }

    const paddedFrac = fracPart.padEnd(precision, '0');
    const combinedStr = wholePart + paddedFrac;
    let amount = BigInt(combinedStr);

    if (isNegative) {
      amount = -amount;
    }

    return { amount, precision };
  }

  /**
   * Format a Quantity into a human-readable decimal string.
   */
  static format(q: Quantity): string {
    const isNegative = q.amount < 0n;
    const absAmount = isNegative ? -q.amount : q.amount;
    const str = absAmount.toString().padStart(q.precision + 1, '0');

    if (q.precision === 0) {
      return (isNegative ? '-' : '') + str;
    }

    const splitIdx = str.length - q.precision;
    const whole = str.slice(0, splitIdx);
    const frac = str.slice(splitIdx);
    return (isNegative ? '-' : '') + `${whole}.${frac}`;
  }

  /**
   * Add two quantities. Requires matching precision.
   */
  static add(a: Quantity, b: Quantity): Quantity {
    if (a.precision !== b.precision) {
      throw new Error(
        `Precision mismatch: cannot add precision ${a.precision} and ${b.precision}`
      );
    }
    return {
      amount: a.amount + b.amount,
      precision: a.precision,
    };
  }

  /**
   * Subtract b from a. Requires matching precision.
   */
  static subtract(a: Quantity, b: Quantity): Quantity {
    if (a.precision !== b.precision) {
      throw new Error(
        `Precision mismatch: cannot subtract precision ${b.precision} from ${a.precision}`
      );
    }
    return {
      amount: a.amount - b.amount,
      precision: a.precision,
    };
  }

  /**
   * Compare two quantities. Returns:
   * -1 if a < b
   *  0 if a === b
   *  1 if a > b
   */
  static compare(a: Quantity, b: Quantity): number {
    if (a.precision !== b.precision) {
      throw new Error(
        `Precision mismatch: cannot compare precision ${a.precision} and ${b.precision}`
      );
    }
    if (a.amount < b.amount) return -1;
    if (a.amount > b.amount) return 1;
    return 0;
  }

  static zero(precision: number): Quantity {
    return { amount: 0n, precision };
  }

  static isPositive(q: Quantity): boolean {
    return q.amount > 0n;
  }

  static isNonNegative(q: Quantity): boolean {
    return q.amount >= 0n;
  }
}
