import {AxiosInstance} from 'axios';
import pLimit from 'p-limit';
import {DownloadRequest, GithubConnector, RepoConfig} from './types';

export interface DownloadContext {
  readonly repoConfig: RepoConfig<GithubConnector>;
  readonly http: AxiosInstance;
  readonly request: DownloadRequest;
  readonly limit: ReturnType<typeof pLimit>;
  readonly concurrency: number;
}
