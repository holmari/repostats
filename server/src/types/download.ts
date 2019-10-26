import {AxiosInstance} from 'axios';
import {DownloadRequest, GithubConnector, RepoConfig} from './types';

export interface DownloadContext {
  readonly repoConfig: RepoConfig<GithubConnector>;
  readonly http: AxiosInstance;
  readonly request: DownloadRequest;
}
