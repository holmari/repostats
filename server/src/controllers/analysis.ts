import {Response, Request} from 'express';
import fs from 'fs';

import {CachePath, readFromCache, writeToCache} from '../cache/cache';
import {ALL_TIME_INTERVAL, shiftIntervalBack, sliceDate, unionAllIntervals, unionIntervals} from '../date/utils';
import {getConfigPath, getReposPath} from '../file/paths';
import {getConfigFile} from '../file/repo';
import {
  AnalyzeRequest,
  AnalyzeResult,
  ComparisonGranularity,
  DateInterval,
  Granularity,
  RepoConfig,
  ReviewSummariesByUserId,
  ReviewsSummary,
  CommentsByUserId,
  ReviewRequestsByUserId,
  GithubConnector,
  CountByDay,
  Mutable,
  ReviewSummariesByDay,
  UserResultComparison,
} from '../types/types';
import {IntermediateAnalyzeResult, IntermediateUserResult} from './analysis/types';
import {getGithubRepoResult} from './github/analysis';
import {postProcessUserResults} from './analysis/utils';
import {removeDuplicates} from '../arrays/utils';
import {getSettings} from './settings';
import {buildComparisonResults} from './analysis/comparison';

export type NormalizedAnalyzeRequest = Required<Omit<AnalyzeRequest, 'comparisonGranularity'>> & {
  readonly granularity: Granularity;
  readonly comparisonGranularity: ComparisonGranularity | undefined;
};

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

function mergeReviewRequests(
  left: ReviewRequestsByUserId,
  right: ReviewRequestsByUserId
): ReviewRequestsByUserId {
  const reviewsByUserId: Mutable<ReviewRequestsByUserId> = {...left};
  Object.keys(right || {}).forEach((userId) => {
    reviewsByUserId[userId] = {
      userId,
      timesAdded: (reviewsByUserId[userId]?.timesAdded || 0) + right[userId].timesAdded,
    };
  });

  return reviewsByUserId;
}

function mergeCommentsByUserId(
  left: CommentsByUserId | CommentsByUserId,
  right: CommentsByUserId | CommentsByUserId
): CommentsByUserId {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const commentsByUserId: Mutable<CommentsByUserId> = {...left};
  Object.keys(right).forEach((userId) => {
    const newCommentCount = (left[userId] || 0) + right[userId];
    commentsByUserId[userId] = newCommentCount;
  });

  return commentsByUserId;
}

function mergeReviewSummariesByUserId(
  left: ReviewSummariesByUserId,
  right: ReviewSummariesByUserId
) {
  if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const authoredReviewsByUserId: Mutable<ReviewSummariesByUserId> = {...left};
  Object.keys(right).forEach((userId) => {
    const newValue: ReviewsSummary = {
      approvals: (left[userId]?.approvals || 0) + right[userId].approvals,
      rejections: (left[userId]?.rejections || 0) + right[userId].rejections,
    };
    authoredReviewsByUserId[userId] = newValue;
  });

  return authoredReviewsByUserId;
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

  const interval = unionIntervals(left.interval, right.interval);
  if (!interval) {
    throw new Error('Merged user had a null interval!');
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
    repoTotals: [...left.repoTotals, ...right.repoTotals],
    commentsAuthored: [...left.commentsAuthored, ...right.commentsAuthored],
    changesAuthored: [...left.changesAuthored, ...right.changesAuthored],
    reviewRequestsAuthoredByUserId: mergeReviewRequests(
      left.reviewRequestsAuthoredByUserId,
      right.reviewRequestsAuthoredByUserId
    ),
    reviewRequestsReceivedByUserId: mergeReviewRequests(
      left.reviewRequestsReceivedByUserId,
      right.reviewRequestsReceivedByUserId
    ),
    commentsWrittenByUserId: mergeCommentsByUserId(
      left.commentsWrittenByUserId,
      right.commentsWrittenByUserId
    ),
    commentsReceivedByUserId: mergeCommentsByUserId(
      left.commentsReceivedByUserId,
      right.commentsReceivedByUserId
    ),
    authoredReviewsByUserId: mergeReviewSummariesByUserId(
      left.authoredReviewsByUserId,
      right.authoredReviewsByUserId
    ),
    reviewsReceivedByUserId: mergeReviewSummariesByUserId(
      left.reviewsReceivedByUserId,
      right.reviewsReceivedByUserId
    ),
    commentsAuthoredByDay: mergeKeyedCounts(
      left.commentsAuthoredByDay,
      right.commentsAuthoredByDay
    ),
    commentsReceivedByDay: mergeKeyedCounts(
      left.commentsReceivedByDay,
      right.commentsReceivedByDay
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
    linesAddedByDay: mergeKeyedCounts(left.linesAddedByDay, right.linesAddedByDay),
    linesDeletedByDay: mergeKeyedCounts(left.linesDeletedByDay, right.linesDeletedByDay),
    interval,
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
  const settings = getSettings();
  return {
    ...request,
    dateInterval: request.dateInterval
      ? normalizeInterval(request.dateInterval)
      : ALL_TIME_INTERVAL,
    includedRepoNames: request.includedRepoNames || getAvailableRepoNames(),
    excludedUserIds: request.excludedUserIds ?? [...settings.excludedUserIds],
    granularity: request.granularity ?? 'day',
    comparisonGranularity: request.comparisonGranularity,
  };
}

function computeAnalysisResultCore(
  request: NormalizedAnalyzeRequest,
  excludedUserIdSet: Set<string>
): {
  includedRepos: ReadonlyArray<RepoConfig>;
  interval: DateInterval | null;
  requestedInterval: DateInterval;
  userResults: ReturnType<typeof postProcessUserResults>;
  granularity: Granularity;
} {
  const repoMetadatas = fs
    .readdirSync(getReposPath())
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)))
    .filter((repoName) => request.includedRepoNames.includes(repoName))
    .map((repoName) => getConfigFile(repoName));

  const repoResults = repoMetadatas.map((config) => getRepoResult(config, request));
  const interval = unionAllIntervals(
    repoResults
      .flatMap((result) => Object.values(result.userResults))
      .map((result) => result.interval)
  );
  const includedRepos = repoResults
    .map((result) => result.includedRepos)
    .reduce((acc, item) => [...acc, ...item], []);

  const userResults = repoResults
    .map((result) => result.userResults)
    .reduce((acc, item) => {
      const result = {...acc};

      Object.keys(item).forEach((userId) => {
        // Skip excluded users
        if (excludedUserIdSet.has(userId.toLowerCase())) {
          return;
        }
        result[userId] = mergeUserResults(result[userId], item[userId]);
      });

      return result;
    }, {});

  return {
    includedRepos,
    interval,
    requestedInterval: request.dateInterval,
    userResults: postProcessUserResults(userResults, request.granularity),
    granularity: request.granularity,
  };
}

function isAllTimeInterval(interval: DateInterval): boolean {
  return (
    interval.startDate === ALL_TIME_INTERVAL.startDate &&
    interval.endDate === ALL_TIME_INTERVAL.endDate
  );
}

function computeAnalysisResult(request: NormalizedAnalyzeRequest): AnalyzeResult {
  const excludedUserIdSet = new Set(request.excludedUserIds.map((id) => id.toLowerCase()));
  const currentResult = computeAnalysisResultCore(request, excludedUserIdSet);

  // If no comparison requested or using ALL_TIME interval, return without comparison
  if (!request.comparisonGranularity || isAllTimeInterval(request.dateInterval)) {
    return currentResult;
  }

  // Compute comparison results for the previous period
  const previousInterval = shiftIntervalBack(request.dateInterval, request.comparisonGranularity);
  const previousRequest: NormalizedAnalyzeRequest = {
    ...request,
    dateInterval: previousInterval,
    comparisonGranularity: undefined, // Don't recurse
  };
  const previousResult = computeAnalysisResultCore(previousRequest, excludedUserIdSet);

  const comparisonResults: {[userId: string]: UserResultComparison} = buildComparisonResults(
    currentResult.userResults,
    previousResult.userResults
  );

  return {
    ...currentResult,
    comparisonResults,
    comparisonGranularity: request.comparisonGranularity,
  };
}

function buildCacheKey(request: NormalizedAnalyzeRequest): object {
  // Include repo file exclusions in cache key so changing exclusions invalidates cache
  const repoExclusions: {[repoName: string]: ReadonlyArray<string>} = {};
  for (const repoName of request.includedRepoNames) {
    if (fs.existsSync(getConfigPath(repoName))) {
      const config = getConfigFile(repoName);
      if (config.excludedFilePaths && config.excludedFilePaths.length > 0) {
        repoExclusions[repoName] = config.excludedFilePaths;
      }
    }
  }

  return {
    ...request,
    _repoExclusions: repoExclusions,
  };
}

export function analyze(req: Request, res: Response): void {
  const request = normalizeRequest(req.body);
  const cacheKey = buildCacheKey(request);
  const cacheControl = (req.header('Cache-Control') || '').split(',');
  const canStoreInCache = !cacheControl.includes('no-store');
  const canReadFromCache = !cacheControl.includes('max-age=0');

  const cachedResponse = canReadFromCache ? readFromCache(cacheKey, CachePath.analysis) : null;

  if (cachedResponse) {
    res.status(200).header('X-Cached', 'true').send(cachedResponse);
    return;
  }

  const result = computeAnalysisResult(request);

  if (canStoreInCache) {
    writeToCache(cacheKey, CachePath.analysis, result);
  }

  res.status(200).send(result);
}
