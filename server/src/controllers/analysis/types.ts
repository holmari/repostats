import {
  AnalyzeResult,
  Change,
  CommentsByUserId,
  CountByDay,
  ReviewRequestsByUserId,
  ReviewSummariesByDay,
  ReviewSummariesByUserId,
  UserResult,
} from '../../types/types';

export type ReviewRequestsByDateAndUserId = {
  readonly [date: string]: ReviewRequestsByUserId;
};
export type ReviewSummariesByDateAndUserId = {
  readonly [date: string]: ReviewSummariesByUserId;
};
export type CommentsByDateAndUserId = {
  readonly [date: string]: CommentsByUserId;
};
export type CommentsPerChangeByDateAndUserId = {
  readonly [date: string]: CommentsByUserId;
};

export type IntermediateUserResult = Omit<
  UserResult,
  | 'activeDaysCount'
  | 'aggregatedAuthoredTotals'
  | 'aggregatedReceivedTotals'
  | 'commentsAuthoredPerChangeByUserId'
  | 'interval'
  | 'realName'
  | 'timeSeries'
  | 'reviewRequestsAuthoredByUserId'
  | 'reviewRequestsReceivedByUserId'
  | 'commentsWrittenByUserId'
  | 'commentsReceivedByUserId'
  | 'authoredReviewsByUserId'
  | 'reviewsReceivedByUserId'
  | 'commentsAuthoredPerChangeByUserId'
> & {
  // The review requests that this user initiated, keyed by user id that authored the review.
  readonly reviewRequestsAuthoredByDateAndUserId: ReviewRequestsByDateAndUserId;
  // The review requests that this user received, keyed by user id that requested the review.
  readonly reviewRequestsReceivedByDateAndUserId: ReviewRequestsByDateAndUserId;
  // Number of comments that this user wrote, keyed by user id that comments were addressed towards.
  readonly commentsWrittenByDateAndUserId: CommentsByDateAndUserId;
  // Number of comments that this user received, keyed by user id that wrote the comments.
  readonly commentsReceivedByDateAndUserId: CommentsByDateAndUserId;
  // The reviews that this user authored, keyed by user id whose changes were reviewed.
  readonly authoredReviewsByDateAndUserId: ReviewSummariesByDateAndUserId;
  // The reviews that this user received, keyed by user id who reviewed the changes.
  readonly reviewsReceivedByDateAndUserId: ReviewSummariesByDateAndUserId;
  // Mean number of comments per change that this use authored, keyed by receipient user id.
  readonly commentsAuthoredPerChangeByDateAndUserId: CommentsPerChangeByDateAndUserId;

  // All the real names the user might have.
  readonly possibleRealNameCounts: {readonly [name: string]: number};
  // Number of comments per day (keyed by an ISO date timestamp) that the user wrote to others.
  readonly commentsAuthoredByDay: CountByDay;
  // Number of comments per day (keyed by an ISO date timestamp) that the user received from others.
  readonly commentsReceivedByDay: CountByDay;
  // Number of changes that the user authored, keyed by an ISO date timestamp.
  readonly changesAuthoredByDay: CountByDay;
  // Number of commits that the user authored, keyed by an ISO date timestamp.
  readonly commitsAuthoredByDay: CountByDay;
  // The reviews that the user authored, keyed by an ISO date timestamp.
  readonly reviewsAuthoredByDay: ReviewSummariesByDay;
  // The reviews that the user authored, keyed by an ISO date timestamp.
  readonly reviewsReceivedByDay: ReviewSummariesByDay;
  // The change requests (i.e. pull requests in GitHub) the user authored.
  readonly changesAuthored: ReadonlyArray<Change>;
};

export type IntermediateAnalyzeResult = Omit<AnalyzeResult, 'interval' | 'userResults'> & {
  readonly userResults: IntermediateUserResultsByUserId;
};

export type IntermediateUserResultsByUserId = {
  readonly [userId: string]: IntermediateUserResult;
};

export type UserResultsByDisplayName = {readonly [displayName: string]: UserResult};
