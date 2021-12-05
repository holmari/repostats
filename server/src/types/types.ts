// Remember to keep client/src/types.ts and server/src/types.ts in sync

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export type ConnectorType = 'GIT' | 'GITHUB';

interface BaseConnector {
  readonly type: ConnectorType;
}

export interface GitConnector extends BaseConnector {
  readonly type: 'GIT';
  readonly gitUrl: string;
}

export interface GithubConnector extends BaseConnector {
  readonly type: 'GITHUB';
  readonly token: string;
}

export type RepoConnector = GitConnector | GithubConnector;

export interface RepoConfig<T extends RepoConnector = RepoConnector> {
  readonly name: string;
  readonly url: string;
  readonly connector: T;
}

export interface BaseSourceDataMetadata {
  readonly downloadsPath: string;
  readonly type: ConnectorType;
  readonly updatedAt: string;
}

export interface DownloadRequest {
  readonly requestId: string;
}

export interface DownloadStatus {
  readonly rateLimit: number | null;
  readonly rateLimitLeft: number | null;
  readonly startedAt: string;
  readonly fetchedResources: number | null;
}

export interface GitSourceDataMetadata extends BaseSourceDataMetadata {
  readonly type: 'GIT';
}

export interface GithubSourceDataMetadata extends BaseSourceDataMetadata {
  readonly fetchedCommentIds: ReadonlyArray<number>;
  readonly fetchedPullNumbers: ReadonlyArray<number>;
  readonly totalCommentCount: number;
  readonly totalPullsInRepository: number;
  readonly type: 'GITHUB';
}

export type RepoSourceDataMetadata = GitSourceDataMetadata | GithubSourceDataMetadata;

export interface DateInterval {
  readonly startDate: string;
  readonly endDate: string;
}
export interface AnalyzeRequest {
  readonly dateInterval?: DateInterval;
  readonly includedRepoNames?: ReadonlyArray<string>;
}

export interface ReviewComment {
  readonly authorId: number;
  readonly comment: string;
  readonly createdAt: string;
  readonly reviewUrl: string;
  readonly reviewCommentUrl: string;
  readonly recipientUserId: string | null;
  readonly reviewTitle: string;
}

export interface Change {
  readonly repoName: string;
  readonly reviewUrl: string;
  readonly createdAt: string;
  readonly title: string;
  readonly timeOpenMsec: number;
}

export interface AuthoredTotals {
  // The number of approvals this user handed out. In Gerrit, this is analogous to +2 reviews.
  readonly approvals: number;
  // The number of rejections this user handed out. In Gerrit, this is analogous to -2 reviews.
  readonly rejections: number;
  // The number of comments this user wrote. This includes comments written also to one's own changes.
  readonly commentsWrittenTotal: number;
  // The number of comments this user wrote. This excludes comments written to one's own changes.
  readonly commentsWrittenToOthers: number;
  // The number of changes the user created. In GitHub, a change is called a "Pull Request".
  // In Gerrit, this is the number of change requests the user has pushed.
  // Note the unfortunate ambiguity with change requests vs. GitHub's "Changes requested".
  readonly changesCreated: number;
  // The mean (average) time that the change was open (i.e. from creation to merge/close).
  readonly meanChangeOpenTimeMsec: number;
  // The number of commits this user created.
  readonly commits: number;
}

export interface ReceivedTotals {
  // The number of approvals received by this user.
  readonly approvals: number;
  // The number of approvals received by this user.
  readonly rejections: number;
  // The number of total comments the user's changes received, including comments from others.
  readonly commentsTotal: number;
  // The number of total comments the user's changes received, including comments from others.
  readonly commentsByOthers: number;
  // The number of total comments the user's changes received, including comments from others.
  readonly reviewRequests: number;
}

export interface UserRepoTotals {
  readonly repoName: string;
  readonly authoredTotals: AuthoredTotals;
  readonly receivedTotals: ReceivedTotals;
}

export interface ReviewRequest {
  readonly userId: string;
  readonly timesAdded: number;
}

export interface ReviewsSummary {
  readonly approvals: number;
  readonly rejections: number;
}

export type ReviewRequestsByUserId = {readonly [userId: string]: ReviewRequest};
export type ReviewSummariesByUserId = {readonly [userId: string]: ReviewsSummary};
export type CommentsByUserId = {readonly [userId: string]: number};
export type CommentsPerChangeByUserId = {readonly [userId: string]: number};
export type CountByDay = {readonly [date: string]: number};
export type ReviewSummariesByDay = {readonly [date: string]: ReviewsSummary};

export interface UserActivitySummary {
  readonly date: string;
  readonly commentsAuthored: number;
  readonly commentsReceived: number;
  readonly changesAuthored: number;
  readonly commitsAuthored: number;
  readonly reviewsAuthored: ReviewsSummary;
  readonly reviewsReceived: ReviewsSummary;
}
export interface UserResult {
  // Uniquely identifiable user id in the given backend.
  readonly id: string;
  // This could be the person's name in case of Gerrit. In case of GitHub, it's the GH handle.
  readonly displayName: string;
  // The user's email address(es), if available.
  readonly emailAddresses: ReadonlyArray<string>;
  // User-facing URL to the user's page in the given data source.
  readonly url: string;
  // The totals for each repository that is included in the analysis.
  readonly repoTotals: ReadonlyArray<UserRepoTotals>;
  // The review requests that this user initiated.
  readonly reviewRequestsAuthoredByUserId: ReviewRequestsByUserId;
  // The review requests that this user received, keyed by user id that requested the review.
  readonly reviewRequestsReceivedByUserId: ReviewRequestsByUserId;
  // Number of comments that this user wrote, keyed by user id that comments we addressed towards.
  readonly commentsWrittenByUserId: CommentsByUserId;
  // Number of comments that this user received, keyed by user id that wrote the comments.
  readonly commentsReceivedByUserId: CommentsByUserId;
  // The reviews that this user authored, keyed by user id whose changes were reviewed.
  readonly authoredReviewsByUserId: ReviewSummariesByUserId;
  // The reviews that this user received, keyed by user id who reviewed the changes.
  readonly reviewsReceivedByUserId: ReviewSummariesByUserId;
  // Mean number of comments per change that this use authored, keyed by receipient user id.
  readonly commentsAuthoredPerChangeByUserId: CommentsPerChangeByUserId;
  // A sparse time-series activity summary of the user, ordered by the date of activity.
  readonly timeSeries: ReadonlyArray<UserActivitySummary>;

  // The date interval this user has been active.
  readonly interval: DateInterval;
  // How many days the user has been active in the given interval.
  readonly activeDaysCount: number;

  // All comments written by the user.
  // NOTE: This part of the result is very large; in case of performance issues, this could be
  // separated into its own response.
  readonly commentsAuthored: ReadonlyArray<ReviewComment>;
}

export type UserResultsByUserId = {readonly [userId: string]: UserResult};

export interface AnalyzeResult {
  readonly includedRepos: ReadonlyArray<RepoConfig>;
  readonly interval: DateInterval | null;
  readonly userResults: UserResultsByUserId;
}
