const CACHE = new Map();

const DEFAULT_TIMEOUT_MS = Number(process.env.CONNECTOR_TIMEOUT_MS || 4500);
const DEFAULT_TTL_MS = Number(process.env.CONNECTOR_TTL_MS || 1000 * 60 * 15);

const ISO2_TO_ISO3 = {
  SN: "SEN",
  CI: "CIV",
  BJ: "BEN",
  BF: "BFA",
  GN: "GIN",
  ML: "MLI",
  NE: "NER",
  TG: "TGO",
  GH: "GHA",
  NG: "NGA",
  CM: "CMR",
  MR: "MRT",
  GM: "GMB",
  LR: "LBR",
  SL: "SLE",
};

const DEFAULT_CITY_BY_COUNTRY = {
  SN: "Dakar",
  CI: "Abidjan",
  BJ: "Cotonou",
  BF: "Ouagadougou",
  GN: "Conakry",
  ML: "Bamako",
  NE: "Niamey",
  TG: "Lome",
  GH: "Accra",
  NG: "Lagos",
};

const SAFE_SYMBOLS = ["XOF", "EUR", "USD", "NGN", "GHS", "GBP"];

function normalizeCountryCode(countryCode = "SN") {
  return String(countryCode || "SN").trim().toUpperCase().slice(0, 2) || "SN";
}

function toIso3(countryCode = "SN") {
  const cc = normalizeCountryCode(countryCode);
  return ISO2_TO_ISO3[cc] || "SEN";
}

function defaultCity(countryCode = "SN") {
  const cc = normalizeCountryCode(countryCode);
  return DEFAULT_CITY_BY_COUNTRY[cc] || "Dakar";
}

function monthKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getCacheEntry(key) {
  const found = CACHE.get(key);
  if (!found) return null;
  return found;
}

function setCacheEntry(key, value, ttlMs = DEFAULT_TTL_MS) {
  CACHE.set(key, {
    value,
    expiresAt: Date.now() + Math.max(30_000, Number(ttlMs) || DEFAULT_TTL_MS),
    updatedAt: Date.now(),
  });
}

function stableDemoSeries({ start = 10, variance = 2, points = 6, step = 0.7 } = {}) {
  const rows = [];
  let current = Number(start);
  for (let i = 0; i < points; i += 1) {
    const jitter = ((i % 2 === 0 ? 1 : -1) * variance) / 3;
    current = Math.max(0, current + step + jitter);
    rows.push(Number(current.toFixed(2)));
  }
  return rows;
}

async function fetchJsonWithCache(
  url,
  {
    cacheKey = url,
    ttlMs = DEFAULT_TTL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fallback = null,
    headers,
  } = {}
) {
  const cached = getCacheEntry(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      data: cached.value,
      source: "cache",
      fetchedAt: cached.updatedAt,
      stale: false,
      warning: null,
    };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(500, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: headers || {},
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
    const payload = await res.json();
    setCacheEntry(cacheKey, payload, ttlMs);
    return {
      data: payload,
      source: "live",
      fetchedAt: Date.now(),
      stale: false,
      warning: null,
    };
  } catch (error) {
    if (cached) {
      return {
        data: cached.value,
        source: "stale_cache",
        fetchedAt: cached.updatedAt,
        stale: true,
        warning: String(error?.message || "connector_error"),
      };
    }
    if (typeof fallback === "function") {
      const data = fallback();
      return {
        data,
        source: "fallback",
        fetchedAt: Date.now(),
        stale: false,
        warning: String(error?.message || "connector_error"),
      };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackHolidays(year, countryCode) {
  const y = Number(year) || new Date().getUTCFullYear();
  const cc = normalizeCountryCode(countryCode);
  const fixed = [
    { month: 1, day: 1, localName: "Nouvel an", name: "New Year's Day" },
    { month: 5, day: 1, localName: "Fete du Travail", name: "Labour Day" },
    { month: 12, day: 25, localName: "Noel", name: "Christmas Day" },
  ];
  return fixed.map((h, idx) => ({
    date: `${y}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    localName: h.localName,
    name: h.name,
    countryCode: cc,
    fixed: true,
    global: true,
    counties: null,
    launchYear: null,
    types: ["Public"],
    id: `fallback-${cc}-${idx + 1}`,
  }));
}

export function connectorsCatalog() {
  return [
    {
      id: "public_holidays",
      provider: "Nager.Date",
      endpoint: "https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}",
      auth: "none",
      freeTier: "free",
      modules: ["time_absence", "planning", "dashboards"],
    },
    {
      id: "fx_rates",
      provider: "Open ER API",
      endpoint: "https://open.er-api.com/v6/latest/USD",
      auth: "none",
      freeTier: "free",
      modules: ["expenses", "analytics", "reimbursements"],
    },
    {
      id: "weather_forecast",
      provider: "Open-Meteo",
      endpoint: "https://api.open-meteo.com/v1/forecast",
      auth: "none",
      freeTier: "free",
      modules: ["attendance", "planning", "dashboards"],
    },
    {
      id: "country_profile",
      provider: "REST Countries",
      endpoint: "https://restcountries.com/v3.1/alpha/{countryCode}",
      auth: "none",
      freeTier: "free",
      modules: ["global_settings", "compliance", "localization"],
    },
    {
      id: "macro_indicators",
      provider: "World Bank Open Data",
      endpoint: "https://api.worldbank.org/v2/country/{iso3}/indicator/{indicator}",
      auth: "none",
      freeTier: "free",
      modules: ["reports", "budget", "workforce_planning"],
    },
    {
      id: "mobile_money_gateways",
      provider: "Paystack / Flutterwave / MTN MoMo",
      endpoint: "sandbox only (keys required)",
      auth: "api_key",
      freeTier: "sandbox",
      modules: ["expenses", "reimbursement"],
    },
  ];
}

export async function fetchCountryProfile({ countryCode = "SN" } = {}) {
  const cc = normalizeCountryCode(countryCode);
  const url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(
    cc
  )}?fields=name,cca2,cca3,currencies,languages,timezones,capital,population,region,subregion`;
  const result = await fetchJsonWithCache(url, {
    ttlMs: 1000 * 60 * 60 * 24,
    cacheKey: `country:${cc}`,
    fallback: () => [
      {
        name: { common: cc },
        cca2: cc,
        cca3: toIso3(cc),
        currencies: { XOF: { name: "West African CFA franc", symbol: "CFA" } },
        languages: { fra: "French", eng: "English" },
        timezones: ["UTC+00:00"],
        capital: [defaultCity(cc)],
        population: null,
        region: "Africa",
        subregion: "Western Africa",
      },
    ],
  });

  const row = Array.isArray(result.data) ? result.data[0] : null;
  return {
    meta: {
      connector: "country_profile",
      source: result.source,
      fetchedAt: result.fetchedAt,
      warning: result.warning,
      stale: result.stale,
    },
    country: row
      ? {
          code2: row.cca2 || cc,
          code3: row.cca3 || toIso3(cc),
          name: row.name?.common || cc,
          capital: row.capital?.[0] || defaultCity(cc),
          region: row.region || "Africa",
          subregion: row.subregion || "Western Africa",
          currencies: row.currencies || {},
          languages: row.languages || {},
          timezones: row.timezones || [],
          population: row.population || null,
        }
      : {
          code2: cc,
          code3: toIso3(cc),
          name: cc,
          capital: defaultCity(cc),
          region: "Africa",
          subregion: "Western Africa",
          currencies: {},
          languages: {},
          timezones: [],
          population: null,
        },
  };
}

export async function fetchPublicHolidays({ countryCode = "SN", year } = {}) {
  const cc = normalizeCountryCode(countryCode);
  const y = Number(year) || new Date().getUTCFullYear();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${encodeURIComponent(
    y
  )}/${encodeURIComponent(cc)}`;
  const result = await fetchJsonWithCache(url, {
    cacheKey: `holidays:${cc}:${y}`,
    ttlMs: 1000 * 60 * 60 * 24,
    fallback: () => fallbackHolidays(y, cc),
  });
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    meta: {
      connector: "public_holidays",
      source: result.source,
      fetchedAt: result.fetchedAt,
      warning: result.warning,
      stale: result.stale,
    },
    countryCode: cc,
    year: y,
    holidays: rows
      .map((h, idx) => ({
        id: h.id || `${cc}-${y}-${idx + 1}`,
        date: h.date,
        name: h.localName || h.name,
        englishName: h.name || h.localName,
        type: Array.isArray(h.types) ? h.types[0] || "Public" : "Public",
      }))
      .filter((h) => h.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
}

function sanitizeSymbols(symbols = []) {
  const list = Array.isArray(symbols)
    ? symbols
    : String(symbols || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const unique = Array.from(new Set(list.map((s) => s.toUpperCase())));
  const safe = unique.filter((s) => SAFE_SYMBOLS.includes(s));
  return safe.length ? safe : ["EUR", "USD", "NGN", "GHS"];
}

export async function fetchFxRates({ base = "XOF", symbols } = {}) {
  const chosenBase = String(base || "XOF").toUpperCase();
  const chosenSymbols = sanitizeSymbols(symbols);
  const url = "https://open.er-api.com/v6/latest/USD";
  const result = await fetchJsonWithCache(url, {
    cacheKey: "fx:usd",
    ttlMs: 1000 * 60 * 30,
    fallback: () => ({
      result: "success",
      provider: "fallback",
      base_code: "USD",
      rates: {
        USD: 1,
        XOF: 603,
        EUR: 0.92,
        NGN: 1590,
        GHS: 16.1,
        GBP: 0.78,
      },
      time_last_update_unix: Math.floor(Date.now() / 1000),
    }),
  });

  const rates = result?.data?.rates || {};
  const baseRate = rates[chosenBase];
  const normalized = {};

  if (baseRate) {
    for (const symbol of chosenSymbols) {
      if (symbol === chosenBase) {
        normalized[symbol] = 1;
        continue;
      }
      if (!rates[symbol]) continue;
      normalized[symbol] = Number((rates[symbol] / baseRate).toFixed(6));
    }
  }

  if (!Object.keys(normalized).length) {
    for (const symbol of chosenSymbols) {
      if (symbol === chosenBase) {
        normalized[symbol] = 1;
      } else if (rates[symbol]) {
        normalized[symbol] = Number(rates[symbol].toFixed(6));
      }
    }
  }

  return {
    meta: {
      connector: "fx_rates",
      source: result.source,
      fetchedAt: result.fetchedAt,
      warning: result.warning,
      stale: result.stale,
      provider: result?.data?.provider || "open.er-api.com",
    },
    base: chosenBase,
    asOf: result?.data?.time_last_update_unix
      ? new Date(Number(result.data.time_last_update_unix) * 1000).toISOString()
      : new Date().toISOString(),
    rates: Object.entries(normalized).map(([currency, rate]) => ({
      currency,
      rate,
    })),
  };
}

function buildWeatherFallback(city) {
  const today = new Date();
  const maxSeries = stableDemoSeries({ start: 31, variance: 1.3, points: 7, step: -0.05 });
  const minSeries = maxSeries.map((x) => Math.max(20, Number((x - 7.5).toFixed(1))));
  const precipitation = stableDemoSeries({ start: 2, variance: 2.5, points: 7, step: 0 }).map(
    (x) => Number((x % 8).toFixed(1))
  );
  const days = maxSeries.map((max, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      tempMax: Number(max.toFixed(1)),
      tempMin: Number(minSeries[i].toFixed(1)),
      precipitation: precipitation[i],
    };
  });
  return {
    city,
    country: null,
    latitude: null,
    longitude: null,
    timezone: "auto",
    current: {
      temperature: days[0].tempMax,
      windSpeed: 8.5,
      precipitation: days[0].precipitation,
      relativeHumidity: 70,
    },
    daily: days,
  };
}

export async function fetchWeatherForecast({
  city = "Dakar",
  countryCode = "SN",
  lang = "fr",
} = {}) {
  const chosenCity = String(city || defaultCity(countryCode)).trim() || defaultCity(countryCode);
  const cc = normalizeCountryCode(countryCode);

  const geoUrl =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(chosenCity) +
    "&count=1&language=" +
    encodeURIComponent(String(lang || "fr").slice(0, 2)) +
    "&format=json";

  const geo = await fetchJsonWithCache(geoUrl, {
    cacheKey: `weather:geo:${chosenCity}:${cc}`,
    ttlMs: 1000 * 60 * 60 * 24,
    fallback: () => ({ results: [{ name: chosenCity, latitude: 14.7167, longitude: -17.4677, timezone: "Africa/Dakar", country_code: cc }] }),
  });

  const place = Array.isArray(geo?.data?.results) ? geo.data.results[0] : null;
  const lat = Number(place?.latitude);
  const lon = Number(place?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const fallbackData = buildWeatherFallback(chosenCity);
    return {
      meta: {
        connector: "weather_forecast",
        source: "fallback",
        fetchedAt: Date.now(),
        warning: "invalid_coordinates",
        stale: false,
      },
      ...fallbackData,
    };
  }

  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    encodeURIComponent(String(lat)) +
    "&longitude=" +
    encodeURIComponent(String(lon)) +
    "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
    "&forecast_days=7&timezone=auto";

  const forecast = await fetchJsonWithCache(forecastUrl, {
    cacheKey: `weather:forecast:${lat}:${lon}`,
    ttlMs: 1000 * 60 * 30,
    fallback: () => buildWeatherFallback(chosenCity),
  });

  const rows = Array.isArray(forecast?.data?.daily?.time)
    ? forecast.data.daily.time.map((d, i) => ({
        date: d,
        tempMax: Number(forecast.data.daily.temperature_2m_max?.[i] ?? 0),
        tempMin: Number(forecast.data.daily.temperature_2m_min?.[i] ?? 0),
        precipitation: Number(forecast.data.daily.precipitation_sum?.[i] ?? 0),
      }))
    : buildWeatherFallback(chosenCity).daily;

  return {
    meta: {
      connector: "weather_forecast",
      source: forecast.source === "fallback" ? "fallback" : `${geo.source}/${forecast.source}`,
      fetchedAt: forecast.fetchedAt || geo.fetchedAt || Date.now(),
      warning: forecast.warning || geo.warning || null,
      stale: Boolean(geo.stale || forecast.stale),
    },
    city: place?.name || chosenCity,
    country: place?.country_code || cc,
    latitude: lat,
    longitude: lon,
    timezone: forecast?.data?.timezone || place?.timezone || "auto",
    current: {
      temperature: Number(forecast?.data?.current?.temperature_2m ?? rows?.[0]?.tempMax ?? 0),
      windSpeed: Number(forecast?.data?.current?.wind_speed_10m ?? 0),
      precipitation: Number(forecast?.data?.current?.precipitation ?? rows?.[0]?.precipitation ?? 0),
      relativeHumidity: Number(forecast?.data?.current?.relative_humidity_2m ?? 0),
    },
    daily: rows,
  };
}

const WORLD_BANK_INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
};

function fallbackMacroSeries(indicator) {
  const now = new Date().getUTCFullYear();
  const seed =
    indicator === WORLD_BANK_INDICATORS.inflation
      ? stableDemoSeries({ start: 2.6, variance: 0.8, points: 8, step: 0.2 })
      : indicator === WORLD_BANK_INDICATORS.unemployment
      ? stableDemoSeries({ start: 5.2, variance: 0.5, points: 8, step: -0.05 })
      : stableDemoSeries({ start: 4.1, variance: 0.7, points: 8, step: 0.15 });

  return seed.map((value, i) => ({
    year: String(now - (seed.length - 1 - i)),
    value: Number(value.toFixed(2)),
  }));
}

async function fetchWorldBankSeries({ countryCode = "SN", indicator }) {
  const iso3 = toIso3(countryCode);
  const chosenIndicator = String(indicator || WORLD_BANK_INDICATORS.inflation);
  const url =
    "https://api.worldbank.org/v2/country/" +
    encodeURIComponent(iso3) +
    "/indicator/" +
    encodeURIComponent(chosenIndicator) +
    "?format=json&per_page=20";

  const result = await fetchJsonWithCache(url, {
    cacheKey: `macro:${iso3}:${chosenIndicator}`,
    ttlMs: 1000 * 60 * 60 * 24,
    fallback: () => [{}, fallbackMacroSeries(chosenIndicator)],
  });

  const rows = Array.isArray(result.data?.[1]) ? result.data[1] : [];
  const points = rows
    .map((r) => ({
      year: String(r.date || ""),
      value: r.value == null ? null : Number(r.value),
    }))
    .filter((x) => x.year && Number.isFinite(x.value))
    .sort((a, b) => Number(a.year) - Number(b.year))
    .slice(-8);

  return {
    meta: {
      connector: "macro_indicators",
      source: result.source,
      fetchedAt: result.fetchedAt,
      warning: result.warning,
      stale: result.stale,
      indicator: chosenIndicator,
      countryIso3: iso3,
    },
    points: points.length ? points : fallbackMacroSeries(chosenIndicator),
  };
}

export async function fetchMacroPack({ countryCode = "SN" } = {}) {
  const [inflation, unemployment, gdpGrowth] = await Promise.all([
    fetchWorldBankSeries({ countryCode, indicator: WORLD_BANK_INDICATORS.inflation }),
    fetchWorldBankSeries({ countryCode, indicator: WORLD_BANK_INDICATORS.unemployment }),
    fetchWorldBankSeries({ countryCode, indicator: WORLD_BANK_INDICATORS.gdpGrowth }),
  ]);

  return {
    countryIso3: toIso3(countryCode),
    inflation,
    unemployment,
    gdpGrowth,
  };
}

export function paymentConnectorStatus() {
  const hasPaystack = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const hasFlutterwave = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
  const hasMtnMomo = Boolean(process.env.MTN_MOMO_API_KEY && process.env.MTN_MOMO_SUBSCRIPTION_KEY);
  return {
    providers: [
      {
        id: "paystack",
        name: "Paystack",
        mode: hasPaystack ? "sandbox_or_live" : "not_configured",
        configured: hasPaystack,
      },
      {
        id: "flutterwave",
        name: "Flutterwave",
        mode: hasFlutterwave ? "sandbox_or_live" : "not_configured",
        configured: hasFlutterwave,
      },
      {
        id: "mtn_momo",
        name: "MTN MoMo",
        mode: hasMtnMomo ? "sandbox_or_live" : "not_configured",
        configured: hasMtnMomo,
      },
    ],
    recommendation:
      "Pour la demo, gardez des paiements fictifs cote SIRH et activez un seul connecteur sandbox avant mise en production.",
  };
}

export async function buildDashboardInsights({
  countryCode = "SN",
  city,
  year,
  lang = "fr",
} = {}) {
  const cc = normalizeCountryCode(countryCode);
  const chosenYear = Number(year) || new Date().getUTCFullYear();
  const chosenCity = String(city || defaultCity(cc)).trim() || defaultCity(cc);

  const [country, holidays, fx, weather, macro] = await Promise.all([
    fetchCountryProfile({ countryCode: cc }),
    fetchPublicHolidays({ countryCode: cc, year: chosenYear }),
    fetchFxRates({ base: "XOF", symbols: ["EUR", "USD", "NGN", "GHS"] }),
    fetchWeatherForecast({ city: chosenCity, countryCode: cc, lang }),
    fetchMacroPack({ countryCode: cc }),
  ]);

  const holidayByMonthMap = holidays.holidays.reduce((acc, h) => {
    const key = monthKey(h.date);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const holidaysByMonth = Object.entries(holidayByMonthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const weatherSeries = weather.daily.map((row) => ({
    label: row.date,
    tempMax: row.tempMax,
    tempMin: row.tempMin,
    rain: row.precipitation,
  }));

  const fxSeries = fx.rates.map((r) => ({
    label: r.currency,
    value: Number(r.rate),
  }));

  return {
    generatedAt: new Date().toISOString(),
    location: {
      countryCode: cc,
      countryIso3: country.country.code3,
      countryName: country.country.name,
      city: weather.city || chosenCity,
      capital: country.country.capital || defaultCity(cc),
    },
    connectors: [
      country.meta,
      holidays.meta,
      fx.meta,
      weather.meta,
      macro.inflation.meta,
      macro.unemployment.meta,
      macro.gdpGrowth.meta,
    ],
    holidays: {
      upcoming: holidays.holidays
        .filter((h) => new Date(h.date) >= new Date())
        .slice(0, 8),
      byMonth: holidaysByMonth,
    },
    fx: {
      base: fx.base,
      asOf: fx.asOf,
      rates: fxSeries,
    },
    weather: {
      current: weather.current,
      next7Days: weatherSeries,
    },
    macro: {
      inflation: macro.inflation.points,
      unemployment: macro.unemployment.points,
      gdpGrowth: macro.gdpGrowth.points,
    },
    paymentConnectors: paymentConnectorStatus(),
  };
}
