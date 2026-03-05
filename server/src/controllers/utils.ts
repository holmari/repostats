import fs from 'fs';
import {CachePath, getCacheFilename, readFromCache, writeToCache} from '../cache/cache';
import {DownloadRequest, DownloadStatus} from '../types/types';

const DEFAULT_DOWNLOAD_STATUS: DownloadStatus = {
  phase: 'start',
  phaseProgress: null,
  phaseErrors: {},
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

export function incrementPhaseProgress(
  downloadRequest: DownloadRequest,
  increment: number = 1
): void {
  const status = getDownloadStatus(downloadRequest.requestId);
  if (!status?.phaseProgress) return;

  const updatedProgress = {
    current: status.phaseProgress.current + increment,
    total: status.phaseProgress.total,
  };
  updateDownloadStatus(downloadRequest, {phaseProgress: updatedProgress});
}

export function setPhaseTotal(
  downloadRequest: DownloadRequest,
  total: number
): void {
  const status = getDownloadStatus(downloadRequest.requestId);
  const currentProgress = status?.phaseProgress?.current ?? 0;

  updateDownloadStatus(downloadRequest, {
    phaseProgress: {current: currentProgress, total},
  });
}

export function initPhaseProgress(
  downloadRequest: DownloadRequest,
  alreadyDownloaded: number,
  total: number
): void {
  updateDownloadStatus(downloadRequest, {
    phaseProgress: {current: alreadyDownloaded, total},
  });
}

export function setPhaseError(
  downloadRequest: DownloadRequest,
  error: string
): void {
  const status = getDownloadStatus(downloadRequest.requestId);
  if (!status) return;

  updateDownloadStatus(downloadRequest, {
    phaseErrors: {
      ...status.phaseErrors,
      [status.phase]: error,
    },
  });
}

function activeDownloadKey(repoName: string): string {
  return `active-download-${repoName}`;
}

export function setActiveDownload(repoName: string, requestId: string): void {
  writeToCache(activeDownloadKey(repoName), CachePath.download, {requestId});
}

export function getActiveDownloadForRepo(
  repoName: string
): {requestId: string; status: DownloadStatus} | null {
  const mapping = readFromCache<{requestId: string}>(
    activeDownloadKey(repoName),
    CachePath.download
  );
  if (!mapping) return null;

  const status = getDownloadStatus(mapping.requestId);
  if (!status) return null;

  if (status.phase === 'finish') return null;

  return {requestId: mapping.requestId, status};
}

export function clearActiveDownload(repoName: string): void {
  const filename = getCacheFilename(activeDownloadKey(repoName), CachePath.download);
  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
  }
}
