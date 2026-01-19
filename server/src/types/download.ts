import {RateLimitedAxiosInstance} from 'axios-rate-limit';
import pLimit from 'p-limit';
import {DownloadRequest, GithubConnector, RepoConfig} from './types';

export interface DownloadContext {
  readonly repoConfig: RepoConfig<GithubConnector>;
  readonly http: RateLimitedAxiosInstance;
  readonly request: DownloadRequest;
  readonly limit: ReturnType<typeof pLimit>;
  concurrency: number;
}
