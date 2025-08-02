/**
 * Represents a monetary value in microdollars (1 dollar = 1,000,000 microdollars)
 * Uses integer arithmetic to avoid floating point precision issues
 */
export class MicroDollar {
  private readonly microdollars: bigint;
  private static readonly MICRO_MULTIPLIER = BigInt(1_000_000);

  public static readonly ZERO = new MicroDollar(BigInt(0));

  private constructor(microdollars: bigint) {
    this.microdollars = microdollars;
  }

  public static fromMicrodollarString(microdollars: string): MicroDollar {
    // Remove any underscores and parse as BigInt
    const cleanedStr = microdollars.replace(/_/g, "");
    const parsed = BigInt(cleanedStr);
    return new MicroDollar(parsed);
  }

  public static fromCents(cents: number): MicroDollar {
    return MicroDollar.fromDollars(cents / 100);
  }

  public static fromDollars(dollars: number): MicroDollar {
    return new MicroDollar(BigInt(Math.round(dollars * 1_000_000)));
  }

  public static from(dollars: number | string): MicroDollar {
    if (typeof dollars === "number") {
      return this.fromDollars(dollars);
    }
    return this.fromMicrodollarString(dollars);
  }

  /**
   * Returns the value in dollars as a number
   */
  public toDollars(): number {
    return Number(this.microdollars) / 1_000_000;
  }

  /**
   * Returns the value in dollars as a formatted string
   */
  public display({
    showAllDecimals = false,
  }: {
    showAllDecimals?: boolean;
  } = {}): string {
    const dollars = this.toDollars();
    return dollars.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: showAllDecimals ? 6 : 2,
    });
  }

  /**
   * Returns the raw microdollars value
   */
  public toMicrodollars(): bigint {
    return this.microdollars;
  }

  /**
   * Returns the microdollars value as a string
   */
  public toMicrodollarString(): string {
    const isNegative = this.microdollars < BigInt(0);
    const absValue = isNegative ? -this.microdollars : this.microdollars;
    const str = absValue.toString();

    // Pad with leading zeros if needed to ensure at least 6 digits
    const padded = str.padStart(6, "0");

    if (str.length <= 6) {
      return isNegative ? `-${padded}` : padded;
    }

    // Split into dollars and microdollars
    const dollars = str.slice(0, -6);
    const micros = str.slice(-6);
    const result = `${dollars}_${micros}`;

    return isNegative ? `-${result}` : result;
  }

  /**
   * Adds two MicroDollar values
   */
  public add(other: MicroDollar): MicroDollar {
    return new MicroDollar(this.microdollars + other.microdollars);
  }

  /**
   * Subtracts another MicroDollar value from this one
   */
  public subtract(other: MicroDollar): MicroDollar {
    return new MicroDollar(this.microdollars - other.microdollars);
  }

  /**
   * Multiplies the MicroDollar value by a number
   */
  public multiply(multiplier: number): MicroDollar {
    return new MicroDollar(
      (this.microdollars * BigInt(Math.round(multiplier * 1_000_000))) /
        MicroDollar.MICRO_MULTIPLIER,
    );
  }

  /**
   * Divides the MicroDollar value by a number
   */
  public divide(divisor: number): MicroDollar {
    if (divisor === 0) {
      throw new Error("Division by zero");
    }
    return new MicroDollar(
      (this.microdollars * MicroDollar.MICRO_MULTIPLIER) /
        BigInt(Math.round(divisor * 1_000_000)),
    );
  }

  /**
   * Creates a MicroDollar instance from a microdollar value
   */
  public static fromMicrodollars(microdollars: bigint): MicroDollar {
    return new MicroDollar(microdollars);
  }

  /**
   * Compares two MicroDollar values
   * Returns -1 if this is less than other
   * Returns 0 if they are equal
   * Returns 1 if this is greater than other
   */
  public compare(other: MicroDollar): number {
    if (this.microdollars < other.microdollars) return -1;
    if (this.microdollars > other.microdollars) return 1;
    return 0;
  }

  public abs(): MicroDollar {
    return new MicroDollar(
      this.microdollars < 0n ? -this.microdollars : this.microdollars,
    );
  }

  public isNegative(): boolean {
    return this.microdollars < BigInt(0);
  }

  public isZero(): boolean {
    return this.microdollars === BigInt(0);
  }

  public static max(a: MicroDollar, b: MicroDollar): MicroDollar {
    return a.compare(b) > 0 ? a : b;
  }
}
