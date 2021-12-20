import {Response, Request} from 'express';
import fs from 'fs';

import {CachePath, readFromCache, writeToCache} from '../cache/cache';
import {ALL_TIME_INTERVAL, sliceDate, unionAllIntervals} from '../date/utils';
import {getConfigPath, getReposPath} from '../file/paths';
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
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  ReviewSummariesByDateAndUserId,
} from './analysis/types';
import {getGithubRepoResult} from './github/analysis';
import {postProcessUserResults} from './analysis/utils';
import {removeDuplicates} from '../collections/utils';

export type NormalizedAnalyzeRequest = Required<AnalyzeRequest>;

function getRepoResult(
  repoConfig: RepoConfig,
  request: NormalizedAnalyzeRequest
): IntermediateAnalyzeResult {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getGithubRepoResult(repoConfig as RepoConfig<GithubConnector>, request);
    default:
      throw new Error(`Unsupported connector ${repoConfig.connector.type}`);
  }
}

function mergeDateUserKeyedRecords(
  left: {readonly [date: string]: {readonly [userId: string]: number}},
  right: {readonly [date: string]: {readonly [userId: string]: number}}
): {readonly [date: string]: {readonly [userId: string]: number}} {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const result: {[date: string]: {[userId: string]: number}} = {...left};
  Object.keys(right).forEach((date) => {
    Object.keys(right[date]).forEach((userId) => {
      result[date] = result[date] ?? {};
      result[date][userId] = (result[date][userId] ?? 0) + right[date][userId];
    });
  });

  return result;
}

function mergeRepoTotalsRecords(
  left: {readonly [date: string]: ReadonlyArray<UserRepoTotals>},
  right: {readonly [date: string]: ReadonlyArray<UserRepoTotals>}
): {readonly [date: string]: ReadonlyArray<UserRepoTotals>} {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const result: {[date: string]: ReadonlyArray<UserRepoTotals>} = {...left};
  Object.keys(right).forEach((date) => {
    result[date] = [...(result[date] || []), ...right[date]];
  });

  return result;
}

function mergeReviewSummariesByUserId(
  left: ReviewSummariesByDateAndUserId,
  right: ReviewSummariesByDateAndUserId
): ReviewSummariesByDateAndUserId {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const authoredReviews: {[date: string]: {[userId: string]: ReviewsSummary}} = {...left};
  Object.keys(right).forEach((date) => {
    Object.keys(right[date]).forEach((userId) => {
      const newValue: ReviewsSummary = {
        approvals: (left[date]?.[userId]?.approvals ?? 0) + right[date][userId].approvals,
        rejections: (left[date]?.[userId]?.rejections ?? 0) + right[date][userId].rejections,
      };
      authoredReviews[date] = authoredReviews[date] ?? {};
      authoredReviews[date][userId] = newValue;
    });
  });

  return authoredReviews;
}

function mergeKeyedCounts(left: CountByDay, right: CountByDay): CountByDay {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const countsByDay: Mutable<CountByDay> = {...left};
  Object.keys(right).forEach((date) => {
    countsByDay[date] = (left[date] || 0) + right[date];
  });

  return countsByDay;
}

function mergeSummariesByDay(
  left: ReviewSummariesByDay,
  right: ReviewSummariesByDay
): ReviewSummariesByDay {
  if (!right) {
    return left;
  }

  const summaries: Mutable<ReviewSummariesByDay> = {...left};
  Object.keys(right).forEach((date) => {
    summaries[date] = {
      approvals: (summaries[date]?.approvals || 0) + right[date].approvals,
      rejections: (summaries[date]?.rejections || 0) + right[date].rejections,
    };
  });

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

function computeAnalysisResult(request: NormalizedAnalyzeRequest): AnalyzeResult {
  const repoMetadatas = fs
    .readdirSync(getReposPath())
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)))
    .filter((repoName) => request.includedRepoNames.includes(repoName))
    .map((repoName) => getConfigFile(repoName));

  const repoResults = repoMetadatas.map((config) => getRepoResult(config, request));
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

  const result = computeAnalysisResult(request);

  if (canStoreInCache) {
    writeToCache(request, CachePath.analysis, result);
  }

  res.status(200).send(result);
}
