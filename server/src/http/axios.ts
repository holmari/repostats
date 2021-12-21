import Axios, {AxiosInstance} from 'axios';
import axiosRetry from 'axios-retry';
import rateLimit from 'axios-rate-limit';

export function getHttpClient(maxRequests: number, perMilliseconds: number): AxiosInstance {
  const axios = Axios.create();
  axiosRetry(axios, {retries: 3});

  return rateLimit(Axios.create(), {maxRequests, perMilliseconds});
}
