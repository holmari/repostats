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
  readonly excludedFilePaths?: ReadonlyArray<string>;
}

export interface BaseSourceDataMetadata {
  readonly downloadsPath: string;
  readonly type: ConnectorType;
  readonly updatedAt: string;
}

export interface DownloadRequest {
  readonly requestId: string;
}

export type DownloadPhase =
  | 'start'
  | 'pulls'
  | 'comments'
  | 'teams'
  | 'reviews'
  | 'commits'
  | 'gitClone'
  | 'finish';

export interface PhaseProgress {
  readonly current: number;
  readonly total: number | null;
}

export type PhaseErrors = {readonly [phase in DownloadPhase]?: string};

export interface DownloadStatus {
  readonly phase: DownloadPhase;
  readonly phaseProgress: PhaseProgress | null;
  readonly phaseErrors: PhaseErrors;
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
  readonly fetchedReviewCount: number;
  readonly fetchedReviewedPullCount: number;
  readonly totalCommentCount: number;
  readonly totalPullsInRepository: number;
  readonly type: 'GITHUB';
}

export type RepoSourceDataMetadata = GitSourceDataMetadata | GithubSourceDataMetadata;

export interface DateInterval {
  readonly startDate: string;
  readonly endDate: string;
}

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type ComparisonGranularity = 'year' | 'quarter';

export interface MetricComparison {
  readonly currentValue: number;
  readonly previousValue: number;
  readonly percentageChange: number | null; // null when previous is 0
}

export interface AuthoredTotalsComparison {
  readonly approvals: MetricComparison;
  readonly rejections: MetricComparison;
  readonly commentsWrittenTotal: MetricComparison;
  readonly commentsWrittenToOthers: MetricComparison;
  readonly changesCreated: MetricComparison;
  readonly commits: MetricComparison;
  readonly medianChangeOpenTimeMsec: MetricComparison;
  readonly linesAdded: MetricComparison;
  readonly linesDeleted: MetricComparison;
}

export interface ReceivedTotalsComparison {
  readonly approvals: MetricComparison;
  readonly rejections: MetricComparison;
  readonly commentsTotal: MetricComparison;
  readonly commentsByOthers: MetricComparison;
  readonly reviewRequests: MetricComparison;
}

export interface UserResultComparison {
  readonly authoredTotals: AuthoredTotalsComparison;
  readonly receivedTotals: ReceivedTotalsComparison;
}

export interface AnalyzeRequest {
  readonly dateInterval?: DateInterval;
  readonly includedRepoNames?: ReadonlyArray<string>;
  readonly excludedUserIds?: ReadonlyArray<string>;
  readonly granularity?: Granularity;
  readonly comparisonGranularity?: ComparisonGranularity;
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
  // Percentile values for time that changes were open (from creation to merge/close).
  readonly medianChangeOpenTimeMsec: number;
  readonly p25ChangeOpenTimeMsec: number;
  readonly p90ChangeOpenTimeMsec: number;
  readonly p99ChangeOpenTimeMsec: number;
  // The number of commits this user created.
  readonly commits: number;
  // Lines of code added by this user.
  readonly linesAdded: number;
  // Lines of code deleted by this user.
  readonly linesDeleted: number;
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
  readonly linesAdded: number;
  readonly linesDeleted: number;
}
export interface UserResult {
  // Uniquely identifiable user id in the given backend.
  readonly id: string;
  // The display name the user is referred to in the given backend (i.e. handle in case of GH).
  readonly displayName: string;
  // The person's real name, if available.
  readonly realName: string | null;
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

  // The user-authored totals, aggregated across all repositories. See also `repoTotals`.
  readonly aggregatedAuthoredTotals: AuthoredTotals;

  // The user-received totals, aggregated across all repositories. See also `repoTotals`.
  readonly aggregatedReceivedTotals: ReceivedTotals;

  // All comments written by the user.
  // NOTE: This part of the result is very large; in case of performance issues, this could be
  // separated into its own response.
  readonly commentsAuthored: ReadonlyArray<ReviewComment>;

  // All changes authored by the user.
  // NOTE: this could also be its own request if needed.
  readonly changesAuthored: ReadonlyArray<Change>;
}

export type UserResultsByUserId = {readonly [userId: string]: UserResult};

export interface TeamInfo {
  readonly slug: string;
  readonly name: string;
  readonly memberLogins: ReadonlyArray<string>;
}

export interface AnalyzeResult {
  readonly includedRepos: ReadonlyArray<RepoConfig>;
  // Computed from the union of all user activity intervals. Represents when users
  // actually had activity. Can be null if no activity was found.
  readonly interval: DateInterval | null;
  // The date range selected by the user in the UI. This is the filter criteria
  // from the analysis request, used by git stats queries.
  readonly requestedInterval: DateInterval;
  readonly userResults: UserResultsByUserId;
  // The granularity used for aggregating time series data.
  readonly granularity: Granularity;
  readonly comparisonResults?: {readonly [userId: string]: UserResultComparison};
  readonly comparisonGranularity?: ComparisonGranularity;
}

export interface AppSettings {
  readonly excludedUserIds: ReadonlyArray<string>;
  readonly excludedTeamSlugs: ReadonlyArray<string>;
  readonly activeSSHKeyId?: string;
}
