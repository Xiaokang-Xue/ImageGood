export interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  placeholder: string;
  minLength: number;
  maxLength: number;
  pattern?: RegExp;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "CN", name: "中国", dialCode: "+86", placeholder: "138 0013 8000", minLength: 11, maxLength: 11, pattern: /^1[3-9]\d{9}$/ },
  { code: "HK", name: "中国香港", dialCode: "+852", placeholder: "9123 4567", minLength: 8, maxLength: 8 },
  { code: "MO", name: "中国澳门", dialCode: "+853", placeholder: "6612 3456", minLength: 8, maxLength: 8 },
  { code: "TW", name: "中国台湾", dialCode: "+886", placeholder: "912 345 678", minLength: 9, maxLength: 9 },
  { code: "US", name: "美国 / 加拿大", dialCode: "+1", placeholder: "202 555 0123", minLength: 10, maxLength: 10 },
  { code: "GB", name: "英国", dialCode: "+44", placeholder: "7700 900123", minLength: 9, maxLength: 10 },
  { code: "JP", name: "日本", dialCode: "+81", placeholder: "90 1234 5678", minLength: 9, maxLength: 10 },
  { code: "KR", name: "韩国", dialCode: "+82", placeholder: "10 1234 5678", minLength: 9, maxLength: 10 },
  { code: "SG", name: "新加坡", dialCode: "+65", placeholder: "8123 4567", minLength: 8, maxLength: 8 },
  { code: "MY", name: "马来西亚", dialCode: "+60", placeholder: "12 345 6789", minLength: 9, maxLength: 10 },
  { code: "TH", name: "泰国", dialCode: "+66", placeholder: "81 234 5678", minLength: 9, maxLength: 9 },
  { code: "VN", name: "越南", dialCode: "+84", placeholder: "91 234 5678", minLength: 9, maxLength: 10 },
  { code: "PH", name: "菲律宾", dialCode: "+63", placeholder: "917 123 4567", minLength: 10, maxLength: 10 },
  { code: "ID", name: "印度尼西亚", dialCode: "+62", placeholder: "812 3456 7890", minLength: 9, maxLength: 12 },
  { code: "IN", name: "印度", dialCode: "+91", placeholder: "98765 43210", minLength: 10, maxLength: 10 },
  { code: "AU", name: "澳大利亚", dialCode: "+61", placeholder: "412 345 678", minLength: 9, maxLength: 9 },
  { code: "NZ", name: "新西兰", dialCode: "+64", placeholder: "21 123 4567", minLength: 8, maxLength: 10 },
  { code: "FR", name: "法国", dialCode: "+33", placeholder: "6 12 34 56 78", minLength: 9, maxLength: 9 },
  { code: "DE", name: "德国", dialCode: "+49", placeholder: "1512 3456789", minLength: 10, maxLength: 11 },
  { code: "IT", name: "意大利", dialCode: "+39", placeholder: "312 345 6789", minLength: 9, maxLength: 10 },
  { code: "ES", name: "西班牙", dialCode: "+34", placeholder: "612 345 678", minLength: 9, maxLength: 9 },
  { code: "NL", name: "荷兰", dialCode: "+31", placeholder: "6 12345678", minLength: 9, maxLength: 9 },
  { code: "BR", name: "巴西", dialCode: "+55", placeholder: "11 91234 5678", minLength: 10, maxLength: 11 },
  { code: "MX", name: "墨西哥", dialCode: "+52", placeholder: "55 1234 5678", minLength: 10, maxLength: 10 },
  { code: "AE", name: "阿联酋", dialCode: "+971", placeholder: "50 123 4567", minLength: 9, maxLength: 9 },
  { code: "SA", name: "沙特阿拉伯", dialCode: "+966", placeholder: "50 123 4567", minLength: 9, maxLength: 9 }
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidLocalPhone(countryCode: string, value: string) {
  const country = PHONE_COUNTRIES.find((item) => item.code === countryCode) || DEFAULT_PHONE_COUNTRY;
  const digits = phoneDigits(value);
  if (digits.length < country.minLength || digits.length > country.maxLength) return false;
  return country.pattern ? country.pattern.test(digits) : !digits.startsWith("0");
}

export function composePhoneNumber(countryCode: string, value: string) {
  const country = PHONE_COUNTRIES.find((item) => item.code === countryCode) || DEFAULT_PHONE_COUNTRY;
  const digits = phoneDigits(value);
  // Keep existing mainland-China records compatible with the original 11-digit storage format.
  return country.code === "CN" ? digits : `+${phoneDigits(country.dialCode)}${digits}`;
}

export function normalizeStoredPhone(value: string) {
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = phoneDigits(trimmed);
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (hasInternationalPrefix && /^861[3-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (!hasInternationalPrefix && /^1[3-9]\d{9}$/.test(digits)) return digits;

  const country = [...PHONE_COUNTRIES]
    .filter((item) => item.code !== "CN")
    .sort((left, right) => right.dialCode.length - left.dialCode.length)
    .find((item) => {
      const dialCode = phoneDigits(item.dialCode);
      if (!digits.startsWith(dialCode)) return false;
      return isValidLocalPhone(item.code, digits.slice(dialCode.length));
    });

  return country ? `+${digits}` : null;
}

export function maskPhoneNumber(value: string) {
  const normalized = normalizeStoredPhone(value) || phoneDigits(value);
  if (/^1[3-9]\d{9}$/.test(normalized)) {
    return normalized.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
  }
  const digits = phoneDigits(normalized);
  if (digits.length <= 7) return normalized;
  return `+${digits.slice(0, Math.min(3, digits.length - 6))} ${digits.slice(-7, -4)}****${digits.slice(-3)}`;
}
