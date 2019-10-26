import {CachePath, readFromCache, writeToCache} from '../cache/cache';
import {DownloadRequest, DownloadStatus} from '../types/types';

const DEFAULT_DOWNLOAD_STATUS: DownloadStatus = {
  fetchedResources: 0,
  rateLimit: null,
  rateLimitLeft: null,
  startedAt: new Date().toISOString(),
};

export function updateDownloadStatus(
  downloadRequest: DownloadRequest,
  status: Partial<DownloadStatus>
): void {
  const originalStatus = getDownloadStatus(downloadRequest.requestId) || DEFAULT_DOWNLOAD_STATUS;
  const updatedStatus: DownloadStatus = {
    ...originalStatus,
    ...status,
    fetchedResources: (originalStatus.fetchedResources || 0) + (status.fetchedResources || 0),
  };

  writeToCache(downloadRequest.requestId, CachePath.download, updatedStatus);
}

export function getDownloadStatus(requestId: string): DownloadStatus | null {
  return readFromCache(requestId, CachePath.download);
}
