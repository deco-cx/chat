const CACHE_VERSION = 2;
const ONE_SEC = 60;
const ONE_MIN = ONE_SEC * 60;
const ONE_HOUR = ONE_MIN * 60;

export class WebCache<TCachedValue> {
  private cache: Promise<Cache>;
  private ttl: number;
  static MAX_SAFE_TTL = ONE_HOUR;

  constructor(cacheName: string, ttlSeconds: number = ONE_MIN) {
    this.cache = caches.open(`${CACHE_VERSION}:${cacheName}`);
    this.ttl = ttlSeconds;
  }

  private createCacheKey(key: string): URL {
    return new URL(
      `/cache?key=${encodeURIComponent(key)}`,
      "http://localhost:8000",
    );
  }

  private serializeValue(
    value: TCachedValue,
    options?: { ttl?: number },
  ): Response {
    const serializedData = {
      value,
      timestamp: Date.now(),
    };
    return new Response(JsonSerializer.serialize(serializedData), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${options?.ttl ?? this.ttl}`,
      },
    });
  }

  private async deserializeValue(
    cacheKey: URL,
    response: Response,
  ): Promise<TCachedValue | null> {
    try {
      const txt = await response.text();
      const parsed = JsonSerializer.deserialize(txt) as {
        value: TCachedValue;
        timestamp: number;
      };
      // Check if the cached item has expired
      if (Date.now() - parsed.timestamp > this.ttl * 1000) {
        // Delete expired item
        const cache = await this.cache;
        await cache.delete(cacheKey);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error("Error deserializing cached value:", error);
      return null;
    }
  }

  async get(key: string): Promise<TCachedValue | null> {
    const cache = await this.cache;
    const cacheKey = this.createCacheKey(key);
    const response = await cache.match(cacheKey);

    if (!response) {
      return null;
    }

    return this.deserializeValue(cacheKey, response);
  }

  async set(
    key: string,
    value: TCachedValue,
    options?: { ttl?: number },
  ): Promise<void> {
    const cache = await this.cache;
    const cacheKey = this.createCacheKey(key);
    const response = this.serializeValue(value, options);
    await cache.put(cacheKey, response);
  }

  async delete(key: string): Promise<boolean> {
    const cache = await this.cache;
    const cacheKey = this.createCacheKey(key);
    return cache.delete(cacheKey);
  }

  async clear(): Promise<void> {
    const cache = await this.cache;
    const keys = await cache.keys();
    await Promise.all(keys.map((key) => cache.delete(key)));
  }

  async has(key: string): Promise<boolean> {
    const cache = await this.cache;
    const cacheKey = this.createCacheKey(key);
    const response = await cache.match(cacheKey);
    if (!response) {
      return false;
    }
    // Check if the item exists and hasn't expired
    const value = await this.deserializeValue(cacheKey, response);
    return value !== null;
  }
}

export class JsonSerializer {
  static serialize(value: unknown): string {
    return JSON.stringify(value, (_, value) => {
      if (value instanceof Uint8Array) {
        // Convert Uint8Array to base64 string
        const base64 = btoa(String.fromCharCode.apply(null, Array.from(value)));
        return {
          __type: "Uint8Array",
          data: base64,
        };
      }
      return value;
    });
  }

  static deserialize(json: string): unknown {
    return JSON.parse(json, (_, value) => {
      if (
        value &&
        typeof value === "object" &&
        value.__type === "Uint8Array" &&
        typeof value.data === "string"
      ) {
        // Convert base64 string back to Uint8Array
        const binaryString = atob(value.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }
      return value;
    });
  }

  static isSerializable(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return true;
    if (value instanceof Uint8Array) return true;

    if (Array.isArray(value)) {
      return value.every((item) => JsonSerializer.isSerializable(item));
    }

    if (typeof value === "object") {
      return Object.values(value).every((item) =>
        JsonSerializer.isSerializable(item),
      );
    }

    return false;
  }
}
