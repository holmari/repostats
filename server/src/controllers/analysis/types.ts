import {
  AnalyzeResult,
  Change,
  CountByDay,
  ReviewSummariesByDay,
  UserResult,
} from '../../types/types';

export type IntermediateUserResult = Omit<
  UserResult,
  | 'activeDaysCount'
  | 'aggregatedAuthoredTotals'
  | 'aggregatedReceivedTotals'
  | 'commentsAuthoredPerChangeByUserId'
  | 'realName'
  | 'timeSeries'
> & {
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

export type UserResultsByEmail = {readonly [emailAddress: string]: UserResult};
