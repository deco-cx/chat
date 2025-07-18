/**
 * Currency API Client
 *
 * HTTP client for the Currency API service that provides real-time currency data.
 * We use the small plan which includes 15,000 API requests per month.
 *
 * @see https://currencyapi.com/docs
 */
import { createHttpClient } from "../../http.ts";

interface CurrencyAPI {
  "GET /latest": {
    searchParams: {
      currencies?: string[];
      base_currency?: string;
    };
    response: {
      data: {
        [key: string]: {
          value: number;
        };
      };
    };
  };
}

export const createCurrencyClient = (apiKey: string) => {
  const client = createHttpClient<CurrencyAPI>({
    base: "https://api.currencyapi.com/v3",
    headers: new Headers({
      apikey: apiKey,
    }),
  });

  return client;
};
