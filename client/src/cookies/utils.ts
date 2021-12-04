import Cookies from 'js-cookie';

export function getCookieAsJson(key: string) {
  const value = Cookies.get(key);
  return value === undefined ? value : JSON.parse(value);
}

export function writeCookieFromJson(key: string, value: any) {
  Cookies.set(key, JSON.stringify(value));
}
