import Axios from 'axios';
import rateLimit, {RateLimitedAxiosInstance} from 'axios-rate-limit';

export function getHttpClient(
  maxRequests: number,
  perMilliseconds: number
): RateLimitedAxiosInstance {
  return rateLimit(Axios.create(), {maxRequests, perMilliseconds});
}
