import { Markup } from "../src/plan.ts";
import type { PlanWithTeamMetadata } from "../src/plan.ts";
import { expect, test } from "vitest";

const usd = (dollars: number) => dollars * 100;

test("Markup.add", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  expect(result).toBe(usd(110));
});

test("Markup.remove", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(110);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  expect(result).toBe(usd(100));
});

test("Markup.add and Markup.remove are inverses", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(100);
  const resultAdd = Markup.add({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  const resultRemove = Markup.remove({
    usdCents: resultAdd,
    markupPercentage: plan.markup,
  });
  expect(resultRemove).toBe(amount);
});

test("Markup.add with 0% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 0,
  });
  expect(result).toBe(usd(100));
});

test("Markup.remove with 0% markup", () => {
  const amount = usd(100);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 0,
  });
  expect(result).toBe(usd(100));
});

test("Markup.add with 100% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 100,
  });
  expect(result).toBe(usd(200));
});

test("Markup.remove with 100% markup", () => {
  const amount = usd(200);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 100,
  });
  expect(result).toBe(usd(100));
});

test("Markup.add with 25% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 25,
  });
  expect(result).toBe(usd(125));
});

test("Markup.remove with 25% markup", () => {
  const amount = usd(125);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 25,
  });
  expect(result).toBe(usd(100));
});

test("Markup.add with 33.33% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 33.33,
  });
  expect(result).toBe(13333); // $133.33
});

test("Markup.remove with 33.33% markup", () => {
  const amount = 13333; // $133.33
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 33.33,
  });
  expect(result).toBe(usd(100));
});

test("Markup.add with small amount", () => {
  const amount = 1; // $0.01
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(1); // Should round to 1 cent
});

test("Markup.remove with small amount", () => {
  const amount = 1; // $0.01
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(1); // Should round to 1 cent
});

test("Markup.add with large amount", () => {
  const amount = usd(10000); // $10,000
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 15,
  });
  expect(result).toBe(usd(11500)); // $11,500
});

test("Markup.remove with large amount", () => {
  const amount = usd(11500); // $11,500
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 15,
  });
  expect(result).toBe(usd(10000)); // $10,000
});

test("Markup.add with fractional cents", () => {
  const amount = 999; // $9.99
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(1099); // $10.99
});

test("Markup.remove with fractional cents", () => {
  const amount = 1099; // $10.99
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(999); // $9.99
});

test("Markup.add with rounding precision", () => {
  const amount = 333; // $3.33
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(366); // $3.66 (rounded)
});

test("Markup.remove with rounding precision", () => {
  const amount = 366; // $3.66
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  expect(result).toBe(333); // $3.33 (rounded)
});

test("Markup operations are inverses with various percentages", () => {
  const testCases = [
    { amount: usd(50), markup: 5 },
    { amount: usd(75.5), markup: 12.5 },
    { amount: usd(200), markup: 20 },
    { amount: usd(999.99), markup: 33.33 },
    { amount: 1, markup: 50 },
    { amount: usd(10000), markup: 7.5 },
  ];

  testCases.forEach(({ amount, markup }) => {
    const resultAdd = Markup.add({
      usdCents: amount,
      markupPercentage: markup,
    });
    const resultRemove = Markup.remove({
      usdCents: resultAdd,
      markupPercentage: markup,
    });
    expect(resultRemove).toBe(amount);
  });
});

test("Markup.add with negative markup throws", () => {
  const amount = usd(100);
  expect(() => {
    Markup.add({
      usdCents: amount,
      markupPercentage: -10,
    });
  }).toThrow("Markup percentage cannot be negative");
});

test("Markup.remove with negative markup throws", () => {
  const amount = usd(90);
  expect(() => {
    Markup.remove({
      usdCents: amount,
      markupPercentage: -10,
    });
  }).toThrow("Markup percentage cannot be negative");
});
