import {AxiosInstance} from 'axios';
import {LimitFunction} from 'p-limit';
import {DownloadRequest, GithubConnector, RepoConfig} from './types';

export interface DownloadContext {
  readonly repoConfig: RepoConfig<GithubConnector>;
  readonly http: AxiosInstance;
  readonly request: DownloadRequest;
  readonly limit: LimitFunction;
  readonly concurrency: number;
}
