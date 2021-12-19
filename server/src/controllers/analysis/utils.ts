import {descByCreationDate} from '../../collections/sort';
import {removeDuplicates} from '../../collections/utils';
import {
  createInterval,
  EMPTY_INTERVAL,
  iterateInterval,
  sliceDate,
  unionAllIntervals,
} from '../../date/utils';
import {
  AnalyzeResult,
  AuthoredTotals,
  CommentsPerChangeByUserId,
  DateInterval,
  Mutable,
  ReceivedTotals,
  RepoConfig,
  ReviewComment,
  ReviewSummariesByUserId,
  UserActivitySummary,
  UserRepoTotals,
  UserResult,
} from '../../types/types';
import {
  IntermediateAnalyzeResult,
  IntermediateUserResult,
  IntermediateUserResultsByUserId,
  UserResultsByDisplayName,
} from './types';

export function createDefaultUserRepoTotals(repoName: string): UserRepoTotals {
  return {
    repoName: repoName,
    authoredTotals: {
      approvals: 0,
      rejections: 0,
      commentsWrittenTotal: 0,
      commentsWrittenToOthers: 0,
      changesCreated: 0,
      commits: 0,
      meanChangeOpenTimeMsec: NaN,
    },
    receivedTotals: {
      commentsTotal: 0,
      commentsByOthers: 0,
      approvals: 0,
      rejections: 0,
      reviewRequests: 0,
    },
  };
}

function getUserResultDateInterval(
  timeSeries: ReadonlyArray<UserActivitySummary>
): DateInterval | null {
  return createInterval(...timeSeries.map((item) => item.date));
}

function postProcessUserRepoTotals(
  repoTotals: UserRepoTotals,
  userResult: IntermediateUserResult
): UserRepoTotals {
  const changesInRepo = userResult.changesAuthored.filter(
    (change) => change.repoName === repoTotals.repoName
  );
  return {
    ...repoTotals,
    authoredTotals: {
      ...repoTotals.authoredTotals,
      changesCreated: changesInRepo.length,
      meanChangeOpenTimeMsec:
        userResult.changesAuthored.length > 0
          ? userResult.changesAuthored
              .map((change) => change.timeOpenMsec)
              .reduce((acc, timeOpen) => acc + timeOpen, 0) / userResult.changesAuthored.length
          : NaN,
    },
  };
}

function toTimeSeries(userResult: IntermediateUserResult): ReadonlyArray<UserActivitySummary> {
  const authoredCommentsDates = Object.keys(userResult.commentsAuthoredByDay);
  const commentsReceivedDates = Object.keys(userResult.commentsReceivedByDay);
  const changesAuthoredDates = Object.keys(userResult.changesAuthoredByDay);
  const commitsAuthoredDates = Object.keys(userResult.commitsAuthoredByDay);
  const reviewsAuthoredDates = Object.keys(userResult.reviewsAuthoredByDay);
  const reviewsReceivedDates = Object.keys(userResult.reviewsReceivedByDay);

  const allDates: ReadonlyArray<string> = [
    ...removeDuplicates([
      ...authoredCommentsDates,
      ...commentsReceivedDates,
      ...changesAuthoredDates,
      ...commitsAuthoredDates,
      ...reviewsAuthoredDates,
      ...reviewsReceivedDates,
    ]),
  ].sort((a, b) => -b.localeCompare(a));

  return allDates.map((date) => {
    return {
      date,
      changesAuthored: userResult.changesAuthoredByDay[date] || 0,
      commentsAuthored: userResult.commentsAuthoredByDay[date] || 0,
      commentsReceived: userResult.commentsReceivedByDay[date] || 0,
      commitsAuthored: userResult.commitsAuthoredByDay[date] || 0,
      reviewsAuthored: userResult.reviewsAuthoredByDay[date] || {approvals: 0, rejections: 0},
      reviewsReceived: userResult.reviewsReceivedByDay[date] || {approvals: 0, rejections: 0},
    };
  });
}

function pickBestRealName(userResult: IntermediateUserResult) {
  const namesAndCounts = userResult.possibleRealNameCounts;
  return (
    Object.keys(userResult.possibleRealNameCounts)
      // Prefer any other name than the user id
      .filter((name) => name !== userResult.id)
      .reduce<string | null>((prevLargestName, name) => {
        const count = namesAndCounts[name];
        return count > (namesAndCounts[prevLargestName || ''] || 0) ? name : prevLargestName;
      }, null)
  );
}

type CommentEntitiesByUserId = {readonly [userId: string]: ReadonlyArray<ReviewComment>};

function getCommentsAuthoredPerChangeByUserId(
  userResult: IntermediateUserResult
): CommentsPerChangeByUserId {
  const commentsByUserId: CommentEntitiesByUserId =
    userResult.commentsAuthored.reduce<CommentEntitiesByUserId>((acc, comment) => {
      if (!comment.recipientUserId) {
        return acc;
      }
      const existingItem = acc[comment.recipientUserId] || [];
      return {
        ...acc,
        [comment.recipientUserId]: [...existingItem, comment],
      };
    }, {});

  return Object.keys(commentsByUserId).reduce<CommentsPerChangeByUserId>((acc, userId) => {
    const comments = commentsByUserId[userId];
    const changes = removeDuplicates(comments.map((comment) => comment.reviewUrl));
    return {
      ...acc,
      [userId]: comments.length / changes.length,
    };
  }, {});
}

function aggregateAuthoredTotals(repoTotals: ReadonlyArray<UserRepoTotals>): AuthoredTotals {
  return repoTotals
    .map((totals) => totals.authoredTotals)
    .reduce<AuthoredTotals>(
      (totals, item) => {
        return {
          approvals: totals.approvals + item.approvals,
          changesCreated: totals.changesCreated + item.changesCreated,
          commentsWrittenTotal: totals.commentsWrittenTotal + item.commentsWrittenTotal,
          commentsWrittenToOthers: totals.commentsWrittenToOthers + item.commentsWrittenToOthers,
          rejections: totals.rejections + item.rejections,
          commits: totals.commits + item.commits,
          meanChangeOpenTimeMsec: isNaN(totals.meanChangeOpenTimeMsec)
            ? item.meanChangeOpenTimeMsec
            : (totals.meanChangeOpenTimeMsec + item.meanChangeOpenTimeMsec) / 2,
        };
      },
      {
        approvals: 0,
        changesCreated: 0,
        commentsWrittenTotal: 0,
        commentsWrittenToOthers: 0,
        rejections: 0,
        commits: 0,
        meanChangeOpenTimeMsec: NaN,
      }
    );
}

function aggregateReceivedTotals(repoTotals: ReadonlyArray<UserRepoTotals>): ReceivedTotals {
  return repoTotals
    .map((totals) => totals.receivedTotals)
    .reduce<ReceivedTotals>(
      (totals, item) => ({
        approvals: totals.approvals + item.approvals,
        rejections: totals.rejections + item.rejections,
        commentsTotal: totals.commentsTotal + item.commentsTotal,
        commentsByOthers: totals.commentsByOthers + item.commentsByOthers,
        reviewRequests: totals.reviewRequests + item.reviewRequests,
      }),
      {approvals: 0, rejections: 0, commentsTotal: 0, commentsByOthers: 0, reviewRequests: 0}
    );
}

function aggregateByDate(values: {readonly [date: string]: {readonly [userId: string]: number}}): {
  readonly [userId: string]: number;
} {
  const result: {[userId: string]: number} = {};

  Object.keys(values).forEach((date) => {
    const valuesByUserId = values[date] ?? {};

    Object.keys(valuesByUserId).forEach((userId) => {
      const existingValue = result[userId] ?? 0;
      result[userId] = existingValue + valuesByUserId[userId];
    });
  });

  return result;
}

function aggregateReviewSummariesByDate(values: {
  readonly [date: string]: ReviewSummariesByUserId;
}): ReviewSummariesByUserId {
  const result: Mutable<ReviewSummariesByUserId> = {};

  Object.keys(values).forEach((date) => {
    const valuesByUserId = values[date] ?? {};

    Object.keys(valuesByUserId).forEach((userId) => {
      const existingValue = result[userId] ?? {
        approvals: 0,
        rejections: 0,
      };
      result[userId] = {
        approvals: existingValue.approvals + valuesByUserId[userId].approvals,
        rejections: existingValue.rejections + valuesByUserId[userId].rejections,
      };
    });
  });

  return result;
}

function aggregateRepoTotalsByDate(repoTotalsByDay: {
  readonly [date: string]: ReadonlyArray<UserRepoTotals>;
}): ReadonlyArray<UserRepoTotals> {
  const result: {[repoName: string]: UserRepoTotals} = {};

  Object.keys(repoTotalsByDay).forEach((date) => {
    const totals = repoTotalsByDay[date];
    totals.forEach((entity) => {
      const old = result[entity.repoName] || createDefaultUserRepoTotals(entity.repoName);
      result[entity.repoName] = {
        repoName: entity.repoName,
        authoredTotals: {
          approvals: old.authoredTotals.approvals + entity.authoredTotals.approvals,
          rejections: old.authoredTotals.rejections + entity.authoredTotals.rejections,
          changesCreated: old.authoredTotals.changesCreated + entity.authoredTotals.changesCreated,
          commentsWrittenToOthers:
            old.authoredTotals.commentsWrittenToOthers +
            entity.authoredTotals.commentsWrittenToOthers,
          commentsWrittenTotal:
            old.authoredTotals.commentsWrittenTotal + entity.authoredTotals.commentsWrittenTotal,
          commits: old.authoredTotals.commits + entity.authoredTotals.commits,
          meanChangeOpenTimeMsec:
            old.authoredTotals.meanChangeOpenTimeMsec +
            entity.authoredTotals.meanChangeOpenTimeMsec,
        },
        receivedTotals: {
          approvals: old.receivedTotals.approvals + entity.receivedTotals.approvals,
          rejections: old.receivedTotals.rejections + entity.receivedTotals.rejections,
          commentsByOthers:
            old.receivedTotals.commentsByOthers + entity.receivedTotals.commentsByOthers,
          commentsTotal: old.receivedTotals.commentsTotal + entity.receivedTotals.commentsTotal,
          reviewRequests: old.receivedTotals.reviewRequests + entity.receivedTotals.reviewRequests,
        },
      };
    });
  });

  return Object.values(result);
}

export function getDailyUserResult(
  result: IntermediateUserResult,
  date: string
): IntermediateUserResult {
  return {
    id: result.id,
    displayName: result.displayName,
    emailAddresses: result.emailAddresses,
    possibleRealNameCounts: result.possibleRealNameCounts,
    url: result.url,
    authoredReviewsByDateAndUserId: {
      [date]: result.authoredReviewsByDateAndUserId[date],
    },
    changesAuthored: result.changesAuthored.filter(
      (change) => sliceDate(change.createdAt) === date
    ),
    changesAuthoredByDay: {[date]: result.changesAuthoredByDay[date]},
    commentsAuthored: result.commentsAuthored.filter(
      (comment) => sliceDate(comment.createdAt) === date
    ),
    commentsAuthoredByDay: {[date]: result.commentsAuthoredByDay[date]},
    commentsAuthoredPerChangeByDateAndUserId: {
      [date]: result.commentsAuthoredPerChangeByDateAndUserId[date],
    },
    commentsReceivedByDateAndUserId: {[date]: result.commentsReceivedByDateAndUserId[date]},
    commentsReceivedByDay: {[date]: result.commentsReceivedByDay[date]},
    commentsWrittenByDateAndUserId: {[date]: result.commentsWrittenByDateAndUserId[date]},
    commitsAuthoredByDay: {[date]: result.commitsAuthoredByDay[date]},
    repoTotalsByDay: {[date]: result.repoTotalsByDay[date]},
    reviewRequestsAuthoredByDateAndUserId: {
      [date]: result.reviewRequestsAuthoredByDateAndUserId[date],
    },
    reviewRequestsReceivedByDateAndUserId: {
      [date]: result.reviewRequestsReceivedByDateAndUserId[date],
    },
    reviewsAuthoredByDay: {[date]: result.reviewsAuthoredByDay[date]},
    reviewsReceivedByDateAndUserId: {[date]: result.reviewsReceivedByDateAndUserId[date]},
    reviewsReceivedByDay: {[date]: result.reviewsReceivedByDay[date]},
  };
}

export function* getDailyUserResults(
  intermediateResult: IntermediateUserResult
): Generator<[IntermediateUserResult, string], void, unknown> {
  const postProcessedResult = postProcessUserResult(intermediateResult);

  for (const date of iterateInterval(postProcessedResult.interval)) {
    const dailyResult = getDailyUserResult(intermediateResult, date);
    yield [dailyResult, date];
  }
}

function postProcessUserResult(userResult: IntermediateUserResult): UserResult {
  const timeSeries = toTimeSeries(userResult);

  const repoTotals = aggregateRepoTotalsByDate(userResult.repoTotalsByDay).map((totals) =>
    postProcessUserRepoTotals(totals, userResult)
  );

  return {
    id: userResult.displayName, // intentional: displayName is assumed to be unique at this point.
    displayName: userResult.displayName,
    realName: pickBestRealName(userResult),
    url: userResult.url,
    changesAuthored: [...userResult.changesAuthored].sort(descByCreationDate),
    commentsAuthored: [...userResult.commentsAuthored].sort(descByCreationDate),
    reviewRequestsAuthoredByUserId: aggregateByDate(
      userResult.reviewRequestsAuthoredByDateAndUserId
    ),
    reviewRequestsReceivedByUserId: aggregateByDate(
      userResult.reviewRequestsReceivedByDateAndUserId
    ),
    commentsWrittenByUserId: aggregateByDate(userResult.commentsWrittenByDateAndUserId),
    commentsReceivedByUserId: aggregateByDate(userResult.commentsReceivedByDateAndUserId),
    commentsAuthoredPerChangeByUserId: getCommentsAuthoredPerChangeByUserId(userResult),
    authoredReviewsByUserId: aggregateReviewSummariesByDate(
      userResult.authoredReviewsByDateAndUserId
    ),
    reviewsReceivedByUserId: aggregateReviewSummariesByDate(
      userResult.reviewsReceivedByDateAndUserId
    ),
    timeSeries,
    emailAddresses: [...userResult.emailAddresses].sort((a, b) => a.localeCompare(b)),
    repoTotals,
    interval: getUserResultDateInterval(timeSeries) || EMPTY_INTERVAL,
    activeDaysCount: timeSeries.length,
    aggregatedAuthoredTotals: aggregateAuthoredTotals(repoTotals),
    aggregatedReceivedTotals: aggregateReceivedTotals(repoTotals),
  };
}

export function postProcessUserResults(
  results: IntermediateUserResultsByUserId
): UserResultsByDisplayName {
  const mappedResultsHolder: {[displayName: string]: UserResult} = {};

  Object.keys(results).forEach((userId) => {
    const processedResult = postProcessUserResult(results[userId]);
    mappedResultsHolder[processedResult.displayName] = processedResult;
  });

  return mappedResultsHolder;
}

export function createAnalyzeResult(result: IntermediateAnalyzeResult): AnalyzeResult {
  const userResults = postProcessUserResults(result.userResults);
  const interval: DateInterval | null = unionAllIntervals(
    Object.values(userResults).map((userResult) => userResult.interval)
  );

  return {
    includedRepos: result.includedRepos,
    interval,
    userResults,
  };
}

export function createIntermediateAnalyzeResult(
  repoConfig: RepoConfig,
  userResults: IntermediateUserResultsByUserId
): IntermediateAnalyzeResult {
  return {
    includedRepos: [repoConfig],
    userResults,
  };
}
