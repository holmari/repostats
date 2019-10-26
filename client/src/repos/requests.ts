import {AnalyzeRequest, AnalyzeResult, RepoConfig} from 'types/types';

const baseUrl = 'http://localhost:3001/api';

const defaultOptions = {};

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export const cacheOff: HeadersInit = {
  'Cache-Control': 'no-store, max-age=0',
};

export function get<Url extends string>(url: Url): Promise<ResponseBody<'get', Url>> {
  return new Promise((resolve, reject) => {
    fetch(`${baseUrl}/${url}`, {
      ...defaultOptions,
      headers: defaultHeaders,
    })
      .then((response) => (response === null ? null : response.json()))
      .then((response) => {
        if (!!response) {
          resolve(response);
        }
      })
      .catch(reject);
  });
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
  };
  put: {
    repos: RepoConfig;
  };
}

interface TypedResponses {
  delete: {};
  get: {
    'github/token': {token: string};
    repos: RepoConfig[];
  };
  post: {
    'github/test': null;
    analyze: AnalyzeResult;
  };
  put: {
    repos: RepoConfig;
  };
}
