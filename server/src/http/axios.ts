import Axios from 'axios';
import axiosRetry from 'axios-retry';
import rateLimit, {RateLimitedAxiosInstance} from 'axios-rate-limit';

/**
 * Check if an error is a GitHub rate limit error (primary or secondary).
 */
function isRateLimitError(error: unknown): boolean {
  const response = (error as {response?: {status?: number; headers?: Record<string, string>}})
    ?.response;
  if (!response) return false;

  // 429 is explicit rate limit
  if (response.status === 429) return true;

  // 403 with X-RateLimit-Remaining: 0 is primary rate limit exhausted
  if (response.status === 403) {
    const remaining = response.headers?.['x-ratelimit-remaining'];
    if (remaining === '0') return true;

    // Secondary rate limit often has "rate limit" in the response
    // But we should be conservative - not all 403s are rate limits
  }

  return false;
}

export function getHttpClient(
  maxRequests: number,
  perMilliseconds: number
): RateLimitedAxiosInstance {
  const axios = Axios.create();

  axiosRetry(axios, {
    retries: 5,
    retryDelay: (retryCount, error) => {
      // Only use rate limit reset time for actual rate limit errors
      if (isRateLimitError(error)) {
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        if (resetTime) {
          const waitMs = parseInt(resetTime, 10) * 1000 - Date.now();
          if (waitMs > 0 && waitMs < 3600000) {
            // Cap at 1 hour sanity check
            console.log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s until reset...`);
            return Math.min(waitMs, 60000); // Cap at 60s per retry attempt
          }
        }
      }
      // Exponential backoff for other errors: 1s, 2s, 4s, 8s, 16s
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`Retrying in ${delay / 1000}s (attempt ${retryCount + 1})...`);
      return delay;
    },
    retryCondition: (error) => {
      // Retry on network errors, 5xx, and rate limit errors
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true;
      if (error.response?.status === 429) return true;
      if (error.response?.status === 503) return true;

      // Only retry 403 if it's actually a rate limit error
      if (error.response?.status === 403) {
        return isRateLimitError(error);
      }

      return false;
    },
  });

  return rateLimit(axios, {maxRequests, perMilliseconds});
}
