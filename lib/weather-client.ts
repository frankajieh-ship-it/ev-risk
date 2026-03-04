/**
 * Weather API Client — OpenWeatherMap
 *
 * Lazy singleton pattern (matches existing lib/supabase.ts, lib/resend.ts).
 * Falls back to seasonal heuristic when API unavailable.
 */

import { logApi, startTimer } from "./api-logger";
import type { WeatherData, TemperatureBand } from "@/types/routine-v2";

// ============================================
// OPENWEATHERMAP TYPES
// ============================================

interface OWMCurrentResponse {
  coord: { lat: number; lon: number };
  main: { temp: number; feels_like: number };
  weather: Array<{ main: string; description: string }>;
  name: string;
}

interface OWMForecastResponse {
  list: Array<{ main: { temp: number }; dt: number }>;
}

// ============================================
// CLIENT
// ============================================

let _client: WeatherClient | null = null;

class WeatherClient {
  private apiKey: string;
  private baseUrl = "https://api.openweathermap.org/data/2.5";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getWeatherByZip(
    zipCode: string,
    region: "US" | "UK"
  ): Promise<
    { success: true; data: WeatherData; coord: { lat: number; lon: number } } | { success: false; error: string }
  > {
    const timer = startTimer();

    try {
      const countryCode = region === "US" ? "us" : "gb";

      // Current weather
      const currentRes = await fetch(
        `${this.baseUrl}/weather?zip=${zipCode},${countryCode}&appid=${this.apiKey}&units=imperial`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!currentRes.ok) {
        throw new Error(`Weather API ${currentRes.status}`);
      }

      const current: OWMCurrentResponse = await currentRes.json();

      // 5-day forecast (free tier: 3-hour intervals)
      const forecastRes = await fetch(
        `${this.baseUrl}/forecast?zip=${zipCode},${countryCode}&appid=${this.apiKey}&units=imperial`,
        { signal: AbortSignal.timeout(5000) }
      );

      let forecastLow = current.main.temp - 10;
      let forecastHigh = current.main.temp + 10;

      if (forecastRes.ok) {
        const forecast: OWMForecastResponse = await forecastRes.json();
        const temps = forecast.list.map((f) => f.main.temp);
        if (temps.length > 0) {
          forecastLow = Math.min(...temps);
          forecastHigh = Math.max(...temps);
        }
      }

      const tempF = current.main.temp;
      const temperatureBand = classifyTemperature(tempF);

      const data: WeatherData = {
        source: "openweathermap",
        current_temp_f: tempF,
        current_conditions: current.weather[0]?.main || "Unknown",
        feels_like_f: current.main.feels_like,
        temperature_band: temperatureBand,
        forecast_low_f: forecastLow,
        forecast_high_f: forecastHigh,
        weather_confidence_band: "high",
        location_used: current.name,
        fetched_at: new Date().toISOString(),
      };

      logApi("info", "Weather fetch success", {
        endpoint: "weather-client",
        elapsed_ms: timer(),
        zip: zipCode,
        temp_band: temperatureBand,
      });

      return { success: true, data, coord: current.coord };
    } catch (error) {
      logApi("error", "Weather fetch failed", {
        endpoint: "weather-client",
        elapsed_ms: timer(),
        error_code: "WEATHER_API_ERROR",
        zip: zipCode,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================
// TEMPERATURE CLASSIFICATION
// ============================================

function classifyTemperature(tempF: number): TemperatureBand {
  if (tempF < 25) return "freezing";
  if (tempF < 45) return "cold";
  if (tempF < 70) return "mild";
  if (tempF < 85) return "warm";
  return "hot";
}

// ============================================
// SINGLETON ACCESS
// ============================================

export function getWeatherClient(): WeatherClient | null {
  if (_client) return _client;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  _client = new WeatherClient(apiKey);
  return _client;
}

export function isWeatherConfigured(): boolean {
  return !!process.env.OPENWEATHER_API_KEY;
}

// ============================================
// FALLBACK: Seasonal heuristic
// ============================================

export function inferWeatherFallback(
  climateBand: "winter" | "mild" | "hot",
  zipCode?: string
): WeatherData {
  const month = new Date().getMonth(); // 0-11
  const isWinter = month < 3 || month > 10;
  const isSummer = month >= 5 && month <= 8;

  let temperatureBand: TemperatureBand;
  let currentTemp: number;

  if (climateBand === "winter") {
    temperatureBand = isWinter ? "freezing" : "cold";
    currentTemp = isWinter ? 20 : 40;
  } else if (climateBand === "hot") {
    temperatureBand = isSummer ? "hot" : "warm";
    currentTemp = isSummer ? 95 : 75;
  } else {
    temperatureBand = "mild";
    currentTemp = 60;
  }

  return {
    source: "manual_override",
    current_temp_f: currentTemp,
    current_conditions: "Estimated",
    feels_like_f: currentTemp,
    temperature_band: temperatureBand,
    forecast_low_f: currentTemp - 10,
    forecast_high_f: currentTemp + 10,
    weather_confidence_band: "low",
    location_used: zipCode || "Unknown",
    fetched_at: new Date().toISOString(),
  };
}
