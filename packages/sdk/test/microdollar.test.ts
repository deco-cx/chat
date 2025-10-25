import { describe, expect, test } from "vitest";
import { MicroDollar } from "../src/mcp/wallet/microdollar.ts";

describe("MicroDollar - fromMicrodollarString and toMicrodollarString", () => {
  test("should handle zero values", () => {
    const zero = MicroDollar.fromMicrodollarString("0");
    expect(zero.toMicrodollarString()).toBe("000000");
    expect(zero.toDollars()).toBe(0);
  });

  test("should handle positive integer dollars", () => {
    const oneDollar = MicroDollar.fromMicrodollarString("1000000");
    expect(oneDollar.toMicrodollarString()).toBe("1_000000");
    expect(oneDollar.toDollars()).toBe(1);

    const tenDollars = MicroDollar.fromMicrodollarString("10000000");
    expect(tenDollars.toMicrodollarString()).toBe("10_000000");
    expect(tenDollars.toDollars()).toBe(10);
  });

  test("should handle fractional dollars", () => {
    const fiftyCents = MicroDollar.fromMicrodollarString("500000");
    expect(fiftyCents.toMicrodollarString()).toBe("500000");
    expect(fiftyCents.toDollars()).toBe(0.5);

    const oneCent = MicroDollar.fromMicrodollarString("10000");
    expect(oneCent.toMicrodollarString()).toBe("010000");
    expect(oneCent.toDollars()).toBe(0.01);
  });

  test("should handle values with underscores", () => {
    const value = MicroDollar.fromMicrodollarString("1_000000");
    expect(value.toMicrodollarString()).toBe("1_000000");
    expect(value.toDollars()).toBe(1);
  });

  test("should handle large values", () => {
    const largeValue = MicroDollar.fromMicrodollarString("123456789_123456");
    expect(largeValue.toMicrodollarString()).toBe("123456789_123456");
    expect(largeValue.toDollars()).toBe(123456789.123456);
  });

  test("should handle multiple underscores in input", () => {
    const value =
      MicroDollar.fromMicrodollarString("1_234_567_890_123456");
    expect(value.toMicrodollarString()).toBe("1234567890_123456");
    expect(value.toDollars()).toBe(1234567890.123456);
  });
});

describe("MicroDollar - negative values", () => {
  test("should handle negative zero", () => {
    const negativeZero = MicroDollar.fromMicrodollarString("-0");
    expect(negativeZero.toMicrodollarString()).toBe("000000");
    expect(negativeZero.toDollars()).toBe(0);
    expect(negativeZero.isZero()).toBe(true);
    expect(negativeZero.isNegative()).toBe(false);
  });

  test("should handle negative integer dollars", () => {
    const negativeOneDollar = MicroDollar.fromMicrodollarString("-1000000");
    expect(negativeOneDollar.toMicrodollarString()).toBe("-1_000000");
    expect(negativeOneDollar.toDollars()).toBe(-1);
    expect(negativeOneDollar.isNegative()).toBe(true);

    const negativeTenDollars = MicroDollar.fromMicrodollarString("-10000000");
    expect(negativeTenDollars.toMicrodollarString()).toBe("-10_000000");
    expect(negativeTenDollars.toDollars()).toBe(-10);
    expect(negativeTenDollars.isNegative()).toBe(true);
  });

  test("should handle negative fractional dollars", () => {
    const negativeFiftyCents = MicroDollar.fromMicrodollarString("-500000");
    expect(negativeFiftyCents.toMicrodollarString()).toBe("-500000");
    expect(negativeFiftyCents.toDollars()).toBe(-0.5);
    expect(negativeFiftyCents.isNegative()).toBe(true);

    const negativeOneCent = MicroDollar.fromMicrodollarString("-10000");
    expect(negativeOneCent.toMicrodollarString()).toBe("-010000");
    expect(negativeOneCent.toDollars()).toBe(-0.01);
    expect(negativeOneCent.isNegative()).toBe(true);
  });

  test("should handle large negative values", () => {
    const largeNegativeValue =
      MicroDollar.fromMicrodollarString("-123456789_123456");
    expect(largeNegativeValue.toMicrodollarString()).toBe("-123456789_123456");
    expect(largeNegativeValue.toDollars()).toBe(-123456789.123456);
    expect(largeNegativeValue.isNegative()).toBe(true);
  });

  test("should handle negative values with underscores", () => {
    const negativeValue = MicroDollar.fromMicrodollarString("-1_000000");
    expect(negativeValue.toMicrodollarString()).toBe("-1_000000");
    expect(negativeValue.toDollars()).toBe(-1);
    expect(negativeValue.isNegative()).toBe(true);
  });
});

describe("MicroDollar - fromDollars and fromCents with negative values", () => {
  test("should handle negative dollars", () => {
    const negativeDollar = MicroDollar.fromDollars(-1);
    expect(negativeDollar.toDollars()).toBe(-1);
    expect(negativeDollar.isNegative()).toBe(true);
    expect(negativeDollar.toMicrodollarString()).toBe("-1_000000");

    const negativeFractional = MicroDollar.fromDollars(-1.5);
    expect(negativeFractional.toDollars()).toBe(-1.5);
    expect(negativeFractional.isNegative()).toBe(true);
    expect(negativeFractional.toMicrodollarString()).toBe("-1_500000");
  });

  test("should handle negative cents", () => {
    const negativeCent = MicroDollar.fromCents(-100);
    expect(negativeCent.toDollars()).toBe(-1);
    expect(negativeCent.isNegative()).toBe(true);
    expect(negativeCent.toMicrodollarString()).toBe("-1_000000");

    const negativeFiftyCents = MicroDollar.fromCents(-50);
    expect(negativeFiftyCents.toDollars()).toBe(-0.5);
    expect(negativeFiftyCents.isNegative()).toBe(true);
    expect(negativeFiftyCents.toMicrodollarString()).toBe("-500000");
  });

  test("should handle zero from dollars", () => {
    const zero = MicroDollar.fromDollars(0);
    expect(zero.toDollars()).toBe(0);
    expect(zero.isNegative()).toBe(false);
    expect(zero.isZero()).toBe(true);
    expect(zero.toMicrodollarString()).toBe("000000");
  });

  test("should handle negative zero from dollars", () => {
    const negativeZero = MicroDollar.fromDollars(-0);
    expect(negativeZero.toDollars()).toBe(0);
    expect(negativeZero.isNegative()).toBe(false);
    expect(negativeZero.isZero()).toBe(true);
    expect(negativeZero.toMicrodollarString()).toBe("000000");
  });
});

describe("MicroDollar - arithmetic operations with negative values", () => {
  test("should add negative values", () => {
    const positive = MicroDollar.fromDollars(10);
    const negative = MicroDollar.fromDollars(-3);
    const result = positive.add(negative);
    expect(result.toDollars()).toBe(7);
    expect(result.isNegative()).toBe(false);
  });

  test("should add two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    const result = negative1.add(negative2);
    expect(result.toDollars()).toBe(-8);
    expect(result.isNegative()).toBe(true);
  });

  test("should subtract negative values", () => {
    const positive = MicroDollar.fromDollars(10);
    const negative = MicroDollar.fromDollars(-3);
    const result = positive.subtract(negative); // 10 - (-3) = 13
    expect(result.toDollars()).toBe(13);
    expect(result.isNegative()).toBe(false);
  });

  test("should subtract from negative values", () => {
    const negative = MicroDollar.fromDollars(-5);
    const positive = MicroDollar.fromDollars(3);
    const result = negative.subtract(positive); // -5 - 3 = -8
    expect(result.toDollars()).toBe(-8);
    expect(result.isNegative()).toBe(true);
  });

  test("should multiply negative values", () => {
    const negative = MicroDollar.fromDollars(-2);
    const result = negative.multiply(3);
    expect(result.toDollars()).toBe(-6);
    expect(result.isNegative()).toBe(true);
  });

  test("should multiply by negative multiplier", () => {
    const positive = MicroDollar.fromDollars(2);
    const result = positive.multiply(-3);
    expect(result.toDollars()).toBe(-6);
    expect(result.isNegative()).toBe(true);
  });

  test("should divide negative values", () => {
    const negative = MicroDollar.fromDollars(-6);
    const result = negative.divide(2);
    expect(result.toDollars()).toBe(-3);
    expect(result.isNegative()).toBe(true);
  });

  test("should divide by negative divisor", () => {
    const positive = MicroDollar.fromDollars(6);
    const result = positive.divide(-2);
    expect(result.toDollars()).toBe(-3);
    expect(result.isNegative()).toBe(true);
  });
});

describe("MicroDollar - abs() method", () => {
  test("should return absolute value of positive", () => {
    const positive = MicroDollar.fromDollars(5);
    const abs = positive.abs();
    expect(abs.toDollars()).toBe(5);
    expect(abs.isNegative()).toBe(false);
  });

  test("should return absolute value of negative", () => {
    const negative = MicroDollar.fromDollars(-5);
    const abs = negative.abs();
    expect(abs.toDollars()).toBe(5);
    expect(abs.isNegative()).toBe(false);
  });

  test("should return zero for zero", () => {
    const zero = MicroDollar.ZERO;
    const abs = zero.abs();
    expect(abs.toDollars()).toBe(0);
    expect(abs.isNegative()).toBe(false);
    expect(abs.isZero()).toBe(true);
  });
});

describe("MicroDollar - compare() method with negative values", () => {
  test("should compare positive and negative", () => {
    const positive = MicroDollar.fromDollars(5);
    const negative = MicroDollar.fromDollars(-3);
    expect(positive.compare(negative)).toBe(1);
    expect(negative.compare(positive)).toBe(-1);
  });

  test("should compare two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    expect(negative1.compare(negative2)).toBe(-1); // -5 < -3
    expect(negative2.compare(negative1)).toBe(1); // -3 > -5
  });

  test("should compare equal values", () => {
    const value1 = MicroDollar.fromDollars(-3);
    const value2 = MicroDollar.fromDollars(-3);
    expect(value1.compare(value2)).toBe(0);
  });
});

describe("MicroDollar - max() method with negative values", () => {
  test("should return max of positive and negative", () => {
    const positive = MicroDollar.fromDollars(5);
    const negative = MicroDollar.fromDollars(-3);
    const max = MicroDollar.max(positive, negative);
    expect(max.toDollars()).toBe(5);
  });

  test("should return max of two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    const max = MicroDollar.max(negative1, negative2);
    expect(max.toDollars()).toBe(-3); // -3 is greater than -5
  });
});

describe("MicroDollar - display() method with negative values", () => {
  test("should display negative values correctly", () => {
    const negative = MicroDollar.fromDollars(-1.5);
    const display = negative.display();
    expect(display).toBe("-$1.50");
  });

  test("should display negative values with all decimals", () => {
    const negative = MicroDollar.fromDollars(-1.123456);
    const display = negative.display({ showAllDecimals: true });
    expect(display).toBe("-$1.123456");
  });
});

describe("MicroDollar - edge cases and error handling", () => {
  test("should handle division by zero", () => {
    const value = MicroDollar.fromDollars(10);
    expect(() => value.divide(0)).toThrow("Division by zero");
  });

  test("should handle very small negative values", () => {
    const tinyNegative = MicroDollar.fromMicrodollarString("-1");
    expect(tinyNegative.toDollars()).toBe(-0.000001);
    expect(tinyNegative.isNegative()).toBe(true);
    expect(tinyNegative.toMicrodollarString()).toBe("-000001");
  });

  test("should handle reasonably large negative values", () => {
    const largeNegative = MicroDollar.fromMicrodollarString("-123456_789000");
    expect(largeNegative.toDollars()).toBe(-123456.789);
    expect(largeNegative.isNegative()).toBe(true);
    expect(largeNegative.toMicrodollarString()).toBe("-123456_789000");
  });
});
