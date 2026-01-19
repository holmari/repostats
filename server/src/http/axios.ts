import Axios from 'axios';
import axiosRetry from 'axios-retry';
import rateLimit, {RateLimitedAxiosInstance} from 'axios-rate-limit';

/**
 * Check if an error is a GitHub rate limit error (primary or secondary).
 */
function isRateLimitError(error: unknown): boolean {
  const axiosError = error as {
    response?: {
      status?: number;
      headers?: Record<string, string>;
      data?: {message?: string};
    };
  };
  const response = axiosError?.response;
  if (!response) return false;

  // 429 is explicit rate limit
  if (response.status === 429) return true;

  // 403 with X-RateLimit-Remaining: 0 is primary rate limit exhausted
  if (response.status === 403) {
    const remaining = response.headers?.['x-ratelimit-remaining'];
    if (remaining === '0') return true;

    // Secondary rate limit: GitHub returns 403 with "rate limit" in the message
    const message = response.data?.message?.toLowerCase() ?? '';
    if (message.includes('rate limit') || message.includes('abuse')) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate wait time until rate limit reset.
 */
function getRateLimitWaitMs(error: unknown): number {
  const axiosError = error as {
    response?: {headers?: Record<string, string>};
  };
  const resetTime = axiosError?.response?.headers?.['x-ratelimit-reset'];
  if (resetTime) {
    const waitMs = parseInt(resetTime, 10) * 1000 - Date.now();
    // Add 5 second buffer to ensure rate limit has fully reset
    if (waitMs > 0 && waitMs < 3600000) {
      return waitMs + 5000;
    }
  }
  // Default to 60 seconds if no reset time available
  return 60000;
}

export function getHttpClient(
  maxRequests: number,
  perMilliseconds: number
): RateLimitedAxiosInstance {
  const axios = Axios.create();

  axiosRetry(axios, {
    retries: 10, // More retries to handle long rate limit waits
    retryDelay: (retryCount, error) => {
      // For rate limit errors, wait until the reset time
      if (isRateLimitError(error)) {
        const waitMs = getRateLimitWaitMs(error);
        console.log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s until reset...`);
        return waitMs;
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

      // Retry 403 if it's a rate limit error
      if (error.response?.status === 403) {
        return isRateLimitError(error);
      }

      return false;
    },
  });

  return rateLimit(axios, {maxRequests, perMilliseconds});
}
