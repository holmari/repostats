import {Response, Request} from 'express';
import fs from 'fs';
import path from 'path';

import {CachePath, readFromCache, writeToCache} from '../cache/cache';
import {
  ALL_TIME_INTERVAL,
  intersectIntervals,
  iterateInterval,
  sliceDate,
  unionAllIntervals,
} from '../date/utils';
import {getCachePath, getConfigPath, getReposPath} from '../file/paths';
import {getConfigFile} from '../file/repo';
import {
  AnalyzeRequest,
  AnalyzeResult,
  DateInterval,
  RepoConfig,
  ReviewsSummary,
  GithubConnector,
  CountByDay,
  Mutable,
  ReviewSummariesByDay,
  UserRepoTotals,
} from '../types/types';
import {
  AnalyzeRequestOptions,
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  PartialDataRevision,
  ReviewSummariesByDateAndUserId,
} from './analysis/types';
import {getGithubRepoResult} from './github/analysis';
import {getDailyUserResults, postProcessUserResults} from './analysis/utils';
import {removeDuplicates} from '../collections/utils';
import {getAllDirectories, getAllJsonFilenamesInDirectory, getFileMd5Hash} from '../file/utils';
import {readJsonFile, writeJsonToFile} from '../file/json';

export type NormalizedAnalyzeRequest = Required<AnalyzeRequest>;

function getPartialDataRevisionPath(repoName: string): string {
  return `${getCachePath()}/${CachePath.analysisPartial}/${repoName}/revision.json`;
}

function getPartialDataPath(repoName: string): string {
  return `${getCachePath()}/${CachePath.analysisPartial}/${repoName}/daily`;
}

function getPartialDataPathForDate(repoName: string, date: string): string {
  return `${getCachePath()}/${CachePath.analysisPartial}/${repoName}/daily/${date}`;
}

function getPartialDataFilename(repoName: string, date: string, userId: string): string {
  return `${getPartialDataPath(repoName)}/${date}/${userId}.json`;
}

function computeRepoResult(
  repoConfig: RepoConfig,
  request: NormalizedAnalyzeRequest,
  options: AnalyzeRequestOptions
): IntermediateAnalyzeResult {
  if (!options.ignorePartialCache) {
    aggregatePartialCacheIfNeeded(repoConfig, options);
  }

  return computeFromPartialCache(repoConfig, request);
}

function getIntervalFromDates(dates: ReadonlyArray<string>): DateInterval | null {
  if (!dates.length) {
    return null;
  }
  const sortedDates = [...dates].sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  return {
    startDate,
    endDate,
  };
}

function computeFromPartialCache(
  repoConfig: RepoConfig,
  request: NormalizedAnalyzeRequest
): IntermediateAnalyzeResult {
  const resultsByUserId: {[userId: string]: IntermediateUserResult} = {};

  const availableDates = getAllDirectories(getPartialDataPath(repoConfig.name)).map((filename) =>
    path.basename(filename)
  );
  const intervalFromPaths = getIntervalFromDates(availableDates);
  const availableInterval = intersectIntervals(intervalFromPaths, request.dateInterval);

  const filenamesByUserId: {[userId: string]: string[]} = {};
  for (const date of iterateInterval(availableInterval)) {
    const datePath = getPartialDataPathForDate(repoConfig.name, date);
    const allFiles = getAllJsonFilenamesInDirectory(datePath);

    allFiles
      .map((filename) => [path.basename(filename, path.extname(filename)), filename])
      .forEach(([userId, filename]) => {
        filenamesByUserId[userId] = [...(filenamesByUserId[userId] || []), filename];
      });
  }

  Object.keys(filenamesByUserId).forEach((userId) => {
    const allResultsForUser = filenamesByUserId[userId].map<IntermediateUserResult>(readJsonFile);
    resultsByUserId[userId] = mergeAllResults(allResultsForUser);
  });

  return {
    includedRepos: [repoConfig],
    userResults: resultsByUserId,
  };
}

function compute(repoConfig: RepoConfig, request: NormalizedAnalyzeRequest) {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getGithubRepoResult(repoConfig as RepoConfig<GithubConnector>, request);
    default:
      throw new Error(`Unsupported connector ${repoConfig.connector.type}`);
  }
}

function getPartialDataRevisionFile(repoName: string): PartialDataRevision | null {
  const filename = getPartialDataRevisionPath(repoName);
  return fs.existsSync(filename) ? readJsonFile(filename) : null;
}

function aggregatePartialCacheIfNeeded(repoConfig: RepoConfig, options: AnalyzeRequestOptions) {
  const revisionFilePath = getPartialDataRevisionPath(repoConfig.name);
  const configHash = getFileMd5Hash(getConfigPath(repoConfig.name));
  const oldRevisionMetadata = getPartialDataRevisionFile(repoConfig.name);
  const needToRecompute = !options.canReadFromCache || configHash !== oldRevisionMetadata?.revision;

  if (!configHash) {
    throw new Error(`Could not compute hash for ${getConfigPath(repoConfig.name)}!`);
  }

  if (!needToRecompute) {
    console.info('Partial cache computed, no need to recompute.');
    return;
  }
  console.log(
    `Need to reaggregate: canReadFromCache=${options.canReadFromCache}, configHash=${configHash}, oldRevisionMetadataRevision=${oldRevisionMetadata?.revision}`
  );

  const fullRequest = normalizeRequest({});
  const fullResult = compute(repoConfig, fullRequest);

  Object.keys(fullResult.userResults).forEach((userId) => {
    const userResult = fullResult.userResults[userId];
    for (const [dailyResult, date] of getDailyUserResults(userResult)) {
      const filename = getPartialDataFilename(repoConfig.name, date, dailyResult.id);
      writeJsonToFile(filename, dailyResult);
    }
  });

  const revisionMetadata: PartialDataRevision = {revision: configHash};
  writeJsonToFile(revisionFilePath, revisionMetadata);
}

function mergeKeyedCountsMutable(left: Mutable<CountByDay>, right: CountByDay): void {
  Object.keys(right).forEach((date) => {
    left[date] = (left[date] ?? 0) + right[date];
  });
}

function mergeSummariesByDayMutable(
  left: Mutable<ReviewSummariesByDay>,
  right: ReviewSummariesByDay
): void {
  Object.keys(right).forEach((date) => {
    left[date] = {
      approvals: (left[date]?.approvals ?? 0) + right[date].approvals,
      rejections: (left[date]?.rejections ?? 0) + right[date].rejections,
    };
  });
}

function mergeDateUserKeyedRecordsMutable(
  left: {[date: string]: {[userId: string]: number}},
  right: {readonly [date: string]: {readonly [userId: string]: number}}
): void {
  Object.keys(right).forEach((date) => {
    Object.keys(right[date]).forEach((userId) => {
      left[date] = left[date] ?? {};
      left[date][userId] = (left[date][userId] ?? 0) + right[date][userId];
    });
  });
}

function mergeRepoTotalsRecordsMutable(
  left: {[date: string]: ReadonlyArray<UserRepoTotals>},
  right: IntermediateUserResult['repoTotalsByDay']
): void {
  Object.keys(right).forEach((date) => {
    if (left[date]) {
      left[date] = [...left[date], ...right[date]];
    } else {
      left[date] = right[date];
    }
  });
}

function mergeReviewSummariesByUserIdMutable(
  left: {[date: string]: {[userId: string]: ReviewsSummary}},
  right: ReviewSummariesByDateAndUserId
): void {
  Object.keys(right).forEach((date) => {
    Object.keys(right[date]).forEach((userId) => {
      const newValue: ReviewsSummary = {
        approvals: (left[date]?.[userId]?.approvals ?? 0) + right[date][userId].approvals,
        rejections: (left[date]?.[userId]?.rejections ?? 0) + right[date][userId].rejections,
      };
      left[date] = left[date] ?? {};
      left[date][userId] = newValue;
    });
  });
}

function mergeDateUserKeyedRecords(
  left: {readonly [date: string]: {readonly [userId: string]: number}},
  right: {readonly [date: string]: {readonly [userId: string]: number}}
): {readonly [date: string]: {readonly [userId: string]: number}} {
  const result: {[date: string]: {[userId: string]: number}} = {...left};
  mergeDateUserKeyedRecordsMutable(result, right);

  return result;
}

function mergeRepoTotalsRecords(
  left: IntermediateUserResult['repoTotalsByDay'],
  right: IntermediateUserResult['repoTotalsByDay']
): {readonly [date: string]: ReadonlyArray<UserRepoTotals>} {
  const result: {[date: string]: ReadonlyArray<UserRepoTotals>} = {...left};
  mergeRepoTotalsRecordsMutable(result, right);

  return result;
}

function mergeReviewSummariesByUserId(
  left: ReviewSummariesByDateAndUserId,
  right: ReviewSummariesByDateAndUserId
): ReviewSummariesByDateAndUserId {
  const authoredReviews: {[date: string]: {[userId: string]: ReviewsSummary}} = {...left};
  mergeReviewSummariesByUserIdMutable(authoredReviews, right);

  return authoredReviews;
}

function mergeKeyedCounts(left: CountByDay, right: CountByDay): CountByDay {
  const countsByDay: Mutable<CountByDay> = {...left};
  mergeKeyedCountsMutable(countsByDay, right);

  return countsByDay;
}

function mergeSummariesByDay(
  left: ReviewSummariesByDay,
  right: ReviewSummariesByDay
): ReviewSummariesByDay {
  const summaries: Mutable<ReviewSummariesByDay> = {...left};
  mergeSummariesByDayMutable(summaries, right);

  return summaries;
}

function mergeUserResults(
  left: IntermediateUserResult,
  right: IntermediateUserResult
): IntermediateUserResult {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  if (left.id !== right.id) {
    throw new Error(
      `Tried to merge incompatible records; ids were '${left.id}' and '${right.id}'.`
    );
  }

  if (left.url !== right.url) {
    throw new Error(`Tried to merge incompatible records; urls '${left.url}' and '${right.url}'.`);
  }

  return {
    id: left.id,
    displayName: left.displayName,
    possibleRealNameCounts: mergeKeyedCounts(
      left.possibleRealNameCounts,
      right.possibleRealNameCounts
    ),
    url: left.url,
    emailAddresses: removeDuplicates([...left.emailAddresses, ...right.emailAddresses]),
    repoTotalsByDay: mergeRepoTotalsRecords(left.repoTotalsByDay, right.repoTotalsByDay),
    commentsAuthored: [...left.commentsAuthored, ...right.commentsAuthored],
    changesAuthored: [...left.changesAuthored, ...right.changesAuthored],
    reviewRequestsAuthoredByDateAndUserId: mergeDateUserKeyedRecords(
      left.reviewRequestsAuthoredByDateAndUserId,
      right.reviewRequestsAuthoredByDateAndUserId
    ),
    reviewRequestsReceivedByDateAndUserId: mergeDateUserKeyedRecords(
      left.reviewRequestsReceivedByDateAndUserId,
      right.reviewRequestsReceivedByDateAndUserId
    ),
    commentsWrittenByDateAndUserId: mergeDateUserKeyedRecords(
      left.commentsWrittenByDateAndUserId,
      right.commentsWrittenByDateAndUserId
    ),
    commentsReceivedByDateAndUserId: mergeDateUserKeyedRecords(
      left.commentsReceivedByDateAndUserId,
      right.commentsReceivedByDateAndUserId
    ),
    authoredReviewsByDateAndUserId: mergeReviewSummariesByUserId(
      left.authoredReviewsByDateAndUserId,
      right.authoredReviewsByDateAndUserId
    ),
    reviewsReceivedByDateAndUserId: mergeReviewSummariesByUserId(
      left.reviewsReceivedByDateAndUserId,
      right.reviewsReceivedByDateAndUserId
    ),
    commentsAuthoredByDay: mergeKeyedCounts(
      left.commentsAuthoredByDay,
      right.commentsAuthoredByDay
    ),
    commentsReceivedByDay: mergeKeyedCounts(
      left.commentsReceivedByDay,
      right.commentsReceivedByDay
    ),
    commentsAuthoredPerChangeByDateAndUserId: mergeDateUserKeyedRecords(
      left.commentsAuthoredPerChangeByDateAndUserId,
      right.commentsAuthoredPerChangeByDateAndUserId
    ),
    changesAuthoredByDay: mergeKeyedCounts(left.changesAuthoredByDay, right.changesAuthoredByDay),
    commitsAuthoredByDay: mergeKeyedCounts(left.commitsAuthoredByDay, right.commitsAuthoredByDay),
    reviewsAuthoredByDay: mergeSummariesByDay(
      left.reviewsAuthoredByDay,
      right.reviewsAuthoredByDay
    ),
    reviewsReceivedByDay: mergeSummariesByDay(
      left.reviewsReceivedByDay,
      right.reviewsReceivedByDay
    ),
  };
}

function mergeUserResultsMutable(
  left: Mutable<IntermediateUserResult>,
  right: IntermediateUserResult
): void {
  if (left.id !== right.id) {
    throw new Error(
      `Tried to merge incompatible records, ids differ '${left.id}' and '${right.id}'.`
    );
  }

  if (left.url !== right.url) {
    throw new Error(
      `Tried to merge incompatible records, urls differ: '${left.url}' and '${right.url}'.`
    );
  }

  if (left.displayName !== right.displayName) {
    throw new Error(
      `Tried to merge incompatible records, displayNames differ: '${left.displayName}' and '${right.displayName}'.`
    );
  }

  mergeKeyedCountsMutable(left.possibleRealNameCounts, right.possibleRealNameCounts);
  left.emailAddresses = removeDuplicates([...left.emailAddresses, ...right.emailAddresses]);
  mergeRepoTotalsRecordsMutable(left.repoTotalsByDay, right.repoTotalsByDay);
  left.commentsAuthored = [...left.commentsAuthored, ...right.commentsAuthored];
  left.changesAuthored = [...left.changesAuthored, ...right.changesAuthored];
  mergeDateUserKeyedRecordsMutable(
    left.reviewRequestsAuthoredByDateAndUserId,
    right.reviewRequestsAuthoredByDateAndUserId
  );
  mergeDateUserKeyedRecordsMutable(
    left.reviewRequestsReceivedByDateAndUserId,
    right.reviewRequestsReceivedByDateAndUserId
  );
  mergeDateUserKeyedRecordsMutable(
    left.commentsWrittenByDateAndUserId,
    right.commentsWrittenByDateAndUserId
  );
  mergeDateUserKeyedRecordsMutable(
    left.commentsReceivedByDateAndUserId,
    right.commentsReceivedByDateAndUserId
  );
  mergeReviewSummariesByUserIdMutable(
    left.authoredReviewsByDateAndUserId,
    right.authoredReviewsByDateAndUserId
  );
  mergeReviewSummariesByUserIdMutable(
    left.reviewsReceivedByDateAndUserId,
    right.reviewsReceivedByDateAndUserId
  );
  mergeKeyedCountsMutable(left.commentsAuthoredByDay, right.commentsAuthoredByDay);
  mergeKeyedCountsMutable(left.commentsReceivedByDay, right.commentsReceivedByDay);
  mergeDateUserKeyedRecordsMutable(
    left.commentsAuthoredPerChangeByDateAndUserId,
    right.commentsAuthoredPerChangeByDateAndUserId
  );
  mergeKeyedCountsMutable(left.changesAuthoredByDay, right.changesAuthoredByDay);
  mergeKeyedCountsMutable(left.commitsAuthoredByDay, right.commitsAuthoredByDay);
  mergeSummariesByDayMutable(left.reviewsAuthoredByDay, right.reviewsAuthoredByDay);
  mergeSummariesByDayMutable(left.reviewsReceivedByDay, right.reviewsReceivedByDay);
}

function mergeAllResults(results: ReadonlyArray<IntermediateUserResult>): IntermediateUserResult {
  const result = results[0];
  for (let i = 1; i < results.length; ++i) {
    mergeUserResultsMutable(result, results[i]);
  }
  return result;
}

function getAvailableRepoNames(): ReadonlyArray<string> {
  const allRepoDirs = fs.readdirSync(getReposPath());
  return allRepoDirs.filter((repoName) => fs.existsSync(getConfigPath(repoName)));
}

function normalizeInterval(interval: DateInterval): DateInterval {
  return {
    startDate: sliceDate(interval.startDate),
    endDate: sliceDate(interval.endDate),
  };
}

function normalizeRequest(request: AnalyzeRequest): NormalizedAnalyzeRequest {
  return {
    ...request,
    dateInterval: request.dateInterval
      ? normalizeInterval(request.dateInterval)
      : ALL_TIME_INTERVAL,
    includedRepoNames: request.includedRepoNames || getAvailableRepoNames(),
  };
}

function computeAnalysisResult(
  request: NormalizedAnalyzeRequest,
  options: AnalyzeRequestOptions = {canReadFromCache: false}
): AnalyzeResult {
  const repoMetadatas = fs
    .readdirSync(getReposPath())
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)))
    .filter((repoName) => request.includedRepoNames.includes(repoName))
    .map((repoName) => getConfigFile(repoName));

  const repoResults = repoMetadatas.map((config) => computeRepoResult(config, request, options));
  const includedRepos = repoResults
    .map((result) => result.includedRepos)
    .reduce((acc, item) => [...acc, ...item], []);

  const mergedUserResults = repoResults
    .map((result) => result.userResults)
    .reduce((acc, item) => {
      const result = {...acc};

      Object.keys(item).forEach((userId) => {
        result[userId] = mergeUserResults(result[userId], item[userId]);
      });

      return result;
    }, {});

  const userResults = postProcessUserResults(mergedUserResults);
  const interval = unionAllIntervals(
    Object.values(userResults).flatMap((result) => result.interval)
  );
  return {
    includedRepos,
    interval,
    userResults,
  };
}

export function analyze(req: Request, res: Response): void {
  const request = normalizeRequest(req.body);
  const cacheControl = (req.header('Cache-Control') || '').split(',');
  const canStoreInCache = !cacheControl.includes('no-store');
  const canReadFromCache = !cacheControl.includes('max-age=0');

  const cachedResponse = canReadFromCache ? readFromCache(request, CachePath.analysis) : null;

  if (cachedResponse) {
    res.status(200).header('X-Cached', 'true').send(cachedResponse);
    return;
  }

  const result = computeAnalysisResult(request, {canReadFromCache});

  res.status(200).send(result);

  if (canStoreInCache) {
    writeToCache(request, CachePath.analysis, result);
  }
}
