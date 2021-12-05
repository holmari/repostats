import Axios from 'axios';
import axiosRetry from 'axios-retry';
import rateLimit, {RateLimitedAxiosInstance} from 'axios-rate-limit';

export function getHttpClient(
  maxRequests: number,
  perMilliseconds: number
): RateLimitedAxiosInstance {
  const axios = Axios.create();
  axiosRetry(axios, {retries: 3});

  return rateLimit(Axios.create(), {maxRequests, perMilliseconds});
}
