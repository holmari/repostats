import {AnalyzeRequest, AnalyzeResult, AppSettings, RepoConfig, TeamInfo, UserInfo} from 'types/types';
import {SERVER_PORT} from 'shared/config';

export interface SSHKeyInfo {
  readonly id: string;
  readonly name: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export interface SSHKeyListResponse {
  readonly keys: SSHKeyInfo[];
  readonly activeKeyId: string | null;
}

export interface SSHKeySaveRequest {
  readonly name: string;
  readonly privateKey: string;
}

export interface SSHKeyTestResult {
  readonly success: boolean;
  readonly message: string;
}

const baseUrl = `http://localhost:${SERVER_PORT}/api`;

const defaultOptions = {};

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export const cacheOff: HeadersInit = {
  'Cache-Control': 'no-store, max-age=0',
};

// In-flight request deduplication and short-term cache for GET requests
const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, {data: unknown; timestamp: number}>();
const CACHE_TTL_MS = 5000; // 5 second cache

function getCachedResponse<T>(url: string): T | null {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  responseCache.delete(url);
  return null;
}

function setCachedResponse(url: string, data: unknown): void {
  responseCache.set(url, {data, timestamp: Date.now()});
}

export function get<Url extends string>(url: Url): Promise<ResponseBody<'get', Url>> {
  // Check cache first
  const cached = getCachedResponse<ResponseBody<'get', Url>>(url);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  // Check for in-flight request
  const inFlight = inFlightRequests.get(url);
  if (inFlight) {
    return inFlight as Promise<ResponseBody<'get', Url>>;
  }

  // Make new request
  const promise = new Promise<ResponseBody<'get', Url>>((resolve, reject) => {
    fetch(`${baseUrl}/${url}`, {
      ...defaultOptions,
      headers: defaultHeaders,
    })
      .then(async (response) => {
        if (response === null) return null;
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Failed to parse JSON from ${url}: ${text.substring(0, 500)}`);
        }
      })
      .then((response) => {
        if (!!response) {
          setCachedResponse(url, response);
          resolve(response);
        }
      })
      .catch(reject)
      .finally(() => {
        inFlightRequests.delete(url);
      });
  });

  inFlightRequests.set(url, promise);
  return promise;
}

function getFetchInitOptions(
  payload: unknown,
  headers: HeadersInit = {},
  method = 'POST'
): RequestInit {
  return {
    ...defaultOptions,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    method,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };
}

function handleFetchResponse<Method extends RequestMethod, Url extends string>(
  _: Method,
  response: Response,
  resolve: (value: ResponseBody<Method, Url>) => void,
  reject: (reason?: any) => void
) {
  if (response === null) {
    return null;
  }
  if (response.status >= 400) {
    if (response.status === 404) {
      reject(null);
      return null;
    }
    response.json().then(reject).catch(reject);
    return null;
  } else if (response.status === 204) {
    resolve(null as any);
    return null;
  }
  const jsonData = response.json() as any;
  if (!!jsonData) {
    resolve(jsonData);
  }

  return jsonData;
}

export function post<Url extends string>(
  url: Url,
  payload: RequestBody<'post', Url>,
  headers: HeadersInit = {}
): Promise<ResponseBody<'post', Url>> {
  return new Promise((resolve, reject) => {
    return fetch(`${baseUrl}/${url}`, getFetchInitOptions(payload, headers))
      .then((response) => handleFetchResponse<'post', Url>('post', response, resolve, reject))
      .catch(reject);
  });
}

export function put<Url extends string>(
  url: Url,
  payload: RequestBody<'put', Url>,
  headers: HeadersInit = {}
): Promise<ResponseBody<'put', Url>> {
  return new Promise((resolve, reject) => {
    return fetch(`${baseUrl}/${url}`, getFetchInitOptions(payload, headers, 'PUT'))
      .then((response) => handleFetchResponse<'put', Url>('put', response, resolve, reject))
      .catch(reject);
  });
}

export function del<Url extends string>(url: Url, headers: HeadersInit = {}) {
  return new Promise((resolve, reject) => {
    return fetch(`${baseUrl}/${url}`, getFetchInitOptions(undefined, headers, 'DELETE'))
      .then((response) => handleFetchResponse<'delete', Url>('delete', response, resolve, reject))
      .catch(reject);
  });
}

type RequestMethod = 'delete' | 'get' | 'post' | 'put';
type RequestBody<
  Method extends RequestMethod,
  Url extends string = string
> = Url extends keyof TypedRequests[Method] ? TypedRequests[Method][Url] : any;
type ResponseBody<
  Method extends RequestMethod,
  Url extends string = string
> = Url extends keyof TypedResponses[Method] ? TypedResponses[Method][Url] : any;

interface TypedRequests {
  delete: {};
  get: {};
  post: {
    'github/test': RepoConfig;
    analyze: AnalyzeRequest;
    'ssh-keys': SSHKeySaveRequest;
    'ssh-keys/test': {keyId: string};
  };
  put: {
    repos: RepoConfig;
    settings: AppSettings;
  };
}

interface TypedResponses {
  delete: {};
  get: {
    'github/token': {token: string};
    repos: RepoConfig[];
    teams: TeamInfo[];
    users: UserInfo[];
    settings: AppSettings;
    'ssh-keys': SSHKeyListResponse;
  };
  post: {
    'github/test': null;
    analyze: AnalyzeResult;
    'ssh-keys': SSHKeyInfo;
    'ssh-keys/test': SSHKeyTestResult;
  };
  put: {
    repos: RepoConfig;
    settings: AppSettings;
  };
}
