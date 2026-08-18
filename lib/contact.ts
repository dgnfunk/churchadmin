import { getCountries, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type NormalizedContact =
  | { kind: "email"; value: string; email: string; phone: null }
  | { kind: "phone"; value: string; email: null; phone: string };

export function validPhoneRegion(value: string): CountryCode {
  return getCountries().includes(value as CountryCode) ? value as CountryCode : "MX";
}

export function normalizeContact(input: string, defaultRegion = "MX"): NormalizedContact | null {
  const value = input.trim();
  if (!value) return null;
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { kind: "email", value: email, email, phone: null };
  }
  const parsed = parsePhoneNumberFromString(value, validPhoneRegion(defaultRegion));
  const digits = parsed?.isPossible() ? parsed.number.replace(/\D/g, "") : value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  const phone = digits.length === 10 && defaultRegion === "MX" ? `52${digits}` : digits;
  return { kind: "phone", value: phone, email: null, phone };
}
