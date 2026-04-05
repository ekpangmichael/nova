export const DISPLAY_TIMEZONE_COOKIE = "nova_display_timezone";
export const DISPLAY_RESOLVED_TIMEZONE_COOKIE = "nova_display_timezone_resolved";
export const DISPLAY_DATE_FORMAT_COOKIE = "nova_display_date_format";

export type DisplayTimezonePreference =
  | "auto"
  | "UTC"
  | "America/New_York"
  | "America/Los_Angeles";

export type DisplayDateFormat = "relative" | "absolute" | "both";

export type DisplayPreferences = {
  timezone: DisplayTimezonePreference;
  resolvedTimezone: string | null;
  dateFormat: DisplayDateFormat;
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  timezone: "auto",
  resolvedTimezone: null,
  dateFormat: "relative",
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const isValidTimezonePreference = (
  value: string | null | undefined
): value is DisplayTimezonePreference =>
  value === "auto" ||
  value === "UTC" ||
  value === "America/New_York" ||
  value === "America/Los_Angeles";

const isValidDateFormat = (
  value: string | null | undefined
): value is DisplayDateFormat =>
  value === "relative" || value === "absolute" || value === "both";

export function readDisplayPreferencesFromCookies(
  cookieReader: CookieReader
): DisplayPreferences {
  const timezoneValue = cookieReader.get(DISPLAY_TIMEZONE_COOKIE)?.value;
  const resolvedTimezoneValue =
    cookieReader.get(DISPLAY_RESOLVED_TIMEZONE_COOKIE)?.value ?? null;
  const dateFormatValue = cookieReader.get(DISPLAY_DATE_FORMAT_COOKIE)?.value;

  return {
    timezone: isValidTimezonePreference(timezoneValue)
      ? timezoneValue
      : DEFAULT_DISPLAY_PREFERENCES.timezone,
    resolvedTimezone:
      typeof resolvedTimezoneValue === "string" && resolvedTimezoneValue.trim()
        ? resolvedTimezoneValue
        : DEFAULT_DISPLAY_PREFERENCES.resolvedTimezone,
    dateFormat: isValidDateFormat(dateFormatValue)
      ? dateFormatValue
      : DEFAULT_DISPLAY_PREFERENCES.dateFormat,
  };
}

function readCookieValueFromDocument(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split("; ");

  for (const cookie of cookies) {
    if (cookie.startsWith(encodedName)) {
      return decodeURIComponent(cookie.slice(encodedName.length));
    }
  }

  return null;
}

export function detectBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function readDisplayPreferencesFromBrowser(): DisplayPreferences {
  const timezoneValue = readCookieValueFromDocument(DISPLAY_TIMEZONE_COOKIE);
  const resolvedTimezoneValue =
    readCookieValueFromDocument(DISPLAY_RESOLVED_TIMEZONE_COOKIE) ??
    detectBrowserTimeZone();
  const dateFormatValue = readCookieValueFromDocument(DISPLAY_DATE_FORMAT_COOKIE);

  return {
    timezone: isValidTimezonePreference(timezoneValue)
      ? timezoneValue
      : DEFAULT_DISPLAY_PREFERENCES.timezone,
    resolvedTimezone:
      typeof resolvedTimezoneValue === "string" && resolvedTimezoneValue.trim()
        ? resolvedTimezoneValue
        : DEFAULT_DISPLAY_PREFERENCES.resolvedTimezone,
    dateFormat: isValidDateFormat(dateFormatValue)
      ? dateFormatValue
      : DEFAULT_DISPLAY_PREFERENCES.dateFormat,
  };
}

export function writeDisplayPreferencesToBrowser(input: {
  timezone: DisplayTimezonePreference;
  dateFormat: DisplayDateFormat;
}) {
  if (typeof document === "undefined") {
    return;
  }

  const resolvedTimezone =
    input.timezone === "auto" ? detectBrowserTimeZone() : input.timezone;
  const maxAge = 60 * 60 * 24 * 365;
  const cookieBase = `Path=/; Max-Age=${maxAge}; SameSite=Lax`;

  document.cookie = `${DISPLAY_TIMEZONE_COOKIE}=${encodeURIComponent(
    input.timezone
  )}; ${cookieBase}`;
  document.cookie = `${DISPLAY_DATE_FORMAT_COOKIE}=${encodeURIComponent(
    input.dateFormat
  )}; ${cookieBase}`;

  if (resolvedTimezone) {
    document.cookie = `${DISPLAY_RESOLVED_TIMEZONE_COOKIE}=${encodeURIComponent(
      resolvedTimezone
    )}; ${cookieBase}`;
  }
}

export function getEffectiveTimeZone(preferences: DisplayPreferences) {
  if (preferences.timezone === "auto") {
    return preferences.resolvedTimezone ?? undefined;
  }

  return preferences.timezone;
}

export function getTimezoneOptions(
  preferences: DisplayPreferences
): { value: DisplayTimezonePreference; label: string }[] {
  const detectedLabel = preferences.resolvedTimezone
    ? `Auto-detect (${preferences.resolvedTimezone})`
    : "Auto-detect";

  return [
    { value: "auto", label: detectedLabel },
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "US Eastern" },
    { value: "America/Los_Angeles", label: "US Pacific" },
  ];
}

export function formatAbsoluteTimestamp(
  value: string | Date,
  preferences: DisplayPreferences,
  options?: Intl.DateTimeFormatOptions
) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: getEffectiveTimeZone(preferences),
    ...options,
  });

  return formatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTimeOnly(
  value: string | Date,
  preferences: DisplayPreferences
) {
  return formatAbsoluteTimestamp(value, preferences, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    month: undefined,
    day: undefined,
    year: undefined,
  });
}

export function formatRelativeTimestamp(value: string | Date, now = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const isFuture = diffSeconds > 0;

  const formatCompact = (amount: number, unit: string) =>
    isFuture ? `in ${amount}${unit}` : `${amount}${unit} ago`;

  if (absSeconds < 5) {
    return isFuture ? "soon" : "just now";
  }

  if (absSeconds < 60) {
    return formatCompact(absSeconds, "s");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return formatCompact(Math.abs(diffMinutes), "m");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatCompact(Math.abs(diffHours), "h");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return formatCompact(Math.abs(diffDays), "d");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return formatCompact(Math.abs(diffWeeks), "w");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatCompact(Math.abs(diffMonths), "mo");
  }

  const diffYears = Math.round(diffDays / 365);
  return formatCompact(Math.abs(diffYears), "y");
}

export function formatTimestampForDisplay(
  value: string | Date,
  preferences: DisplayPreferences,
  options?: Intl.DateTimeFormatOptions
) {
  if (preferences.dateFormat === "relative") {
    return formatRelativeTimestamp(value);
  }

  const absolute = formatAbsoluteTimestamp(value, preferences, options);

  if (preferences.dateFormat === "both") {
    return `${absolute} · ${formatRelativeTimestamp(value)}`;
  }

  return absolute;
}
