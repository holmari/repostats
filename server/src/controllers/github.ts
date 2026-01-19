import Axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import {Response, Request} from 'express';
import parse from 'parse-link-header';

import fs from 'fs';
import {readJsonFile, writeJsonToFile} from '../file/json';
import {ensurePathExists} from '../file/paths';
import {GithubConnector, GithubSourceDataMetadata, RepoConfig} from '../types/types';
import {
  getGithubCommentPath,
  getGithubPullPath,
  getGithubPullReviewsPath,
  getGithubReviewPath,
  getGithubTeamPath,
  getGithubTeamMemberPath,
  getGithubCommitPath,
} from './github/paths';
import {
  getDownloadedCommentIds,
  getDownloadedPullRequestNumbers,
  getDownloadedPullRequestNumbersForCommits,
  getDownloadedPullRequestNumbersForReviews,
  getDownloadedTeamSlugs,
  getPullRequestNumberFromUrl,
  orgsUrl,
  RATE_LIMIT_URL,
  repoUrl,
  updateMetadataFile,
} from './github/utils';
import {
  Comment,
  Commit,
  PullRequest,
  RateLimit,
  Repository,
  Review,
  Team,
  User,
} from '../types/github';
import {getHttpClient} from '../http/axios';
import {getSourceDataMetadata} from '../file/repo';
import {removeDuplicates} from '../arrays/utils';
import {DownloadContext} from '../types/download';
import {RateLimitedAxiosInstance} from 'axios-rate-limit';
import {incrementPhaseProgress, initPhaseProgress, setPhaseError, updateDownloadStatus} from './utils';

const githubDefaultHeaders = {
  Accept: 'application/vnd.github.v3+json',
};

const MAX_PER_PAGE = 100;
const UNKNOWN_ENTITY_COUNT = -1;

/** Return true if a next page is required; false if there is no need to fetch further pages. */
type PageConsumer = (
  response: AxiosResponse<unknown>,
  requestConfig: AxiosRequestConfig
) => Promise<boolean>;

function getDefaultHeaders(repoConfig: RepoConfig<GithubConnector>) {
  return {
    ...githubDefaultHeaders,
    Authorization: `token ${repoConfig.connector.token}`,
  };
}

export function getGithubToken(_: Request, res: Response): void {
  res.status(200).send({
    token: process.env.GITHUB_TOKEN || undefined,
  });
}

// p-limit supports dynamic concurrency but the types don't expose it
type LimitWithConcurrency = DownloadContext['limit'] & {concurrency: number};

function updateConcurrency(context: DownloadContext, remaining: number): void {
  const limit = context.limit as LimitWithConcurrency;
  const newConcurrency = calculateConcurrencyFromRemaining(remaining);
  if (newConcurrency !== context.concurrency) {
    console.log(`Adjusting concurrency: ${context.concurrency} -> ${newConcurrency} (${remaining} requests remaining)`);
    limit.concurrency = newConcurrency;
    context.concurrency = newConcurrency;
    context.http.setMaxRPS(newConcurrency);
  }
}

function get(context: DownloadContext, url: string, requestConfig: AxiosRequestConfig) {
  const active = context.limit.activeCount;
  const pending = context.limit.pendingCount;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] GET ${url} [concurrency: ${context.concurrency}, active: ${active}, pending: ${pending}]`);

  return context.http.get(url, requestConfig).then((response) => {
    const rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'], 10);

    updateDownloadStatus(context.request, {
      rateLimit: response.headers['x-ratelimit-limit'],
      rateLimitLeft: rateLimitRemaining,
      fetchedResources: 1,
    });

    updateConcurrency(context, rateLimitRemaining);

    return response;
  });
}

export function testConnection(req: Request, res: Response): void {
  const repoConfig: RepoConfig<GithubConnector> = req.body;

  const url = `${repoUrl(repoConfig)}/pulls?state=all`;

  try {
    Axios.get(url, {
      headers: getDefaultHeaders(repoConfig),
    })
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          res.status(204).send();
        } else {
          res.status(500).send(response.data);
        }
      })
      .catch((err) => {
        const serverResponse = err.response;
        if (serverResponse.status === 404) {
          res.status(400).send({
            message:
              'Repository not found. Does your token have both repo and read:org permissions?',
          });
        } else {
          res
            .status(serverResponse.status)
            .send({message: serverResponse?.statusText || 'A connection error occurred.', url});
        }
      });
  } catch (e) {
    res.status(500).send({message: e?.message || 'A server error has occurred.', url});
  }
}

function consumePagedRequests(
  context: DownloadContext,
  url: string,
  requestConfig: AxiosRequestConfig,
  consumer: PageConsumer,
  resolve: (value: unknown) => void,
  reject: () => void
) {
  return get(context, url, requestConfig)
    .then(async (response) => {
      const needsNextPage = await consumer(response, requestConfig);
      if (!needsNextPage) {
        console.debug('no need to load next page for url ' + url);
      }

      const nextUrl = parse(response.headers['link'])?.next?.url;

      if (nextUrl && needsNextPage) {
        consumePagedRequests(context, nextUrl, requestConfig, consumer, resolve, reject);
      } else {
        resolve(null);
      }
    })
    .catch(reject);
}

async function getGithubRateLimit(repoConfig: RepoConfig<GithubConnector>): Promise<RateLimit> {
  return Axios.get(RATE_LIMIT_URL, {headers: getDefaultHeaders(repoConfig)}).then(
    (response) => response.data.resources.core
  );
}

/**
 * Calculate requests per second based on rate limit state.
 *
 * The goal is to use the sustainable rate: remaining / seconds until reset.
 * This ensures we never exhaust the rate limit before it resets.
 *
 * @param remaining - Remaining API requests allowed
 * @param secondsUntilReset - Seconds until the rate limit resets
 * @returns Requests per second to use
 */
export function calculateRequestsPerSecond(remaining: number, secondsUntilReset: number): number {
  // Sustainable rate: if we made this many requests per second continuously,
  // we'd exactly use up our remaining limit when it resets.
  const sustainableRate = remaining / Math.max(1, secondsUntilReset);

  // Use floor to ensure we stay under the sustainable rate.
  // Clamp to reasonable bounds:
  // - Min 1 req/sec to always make progress
  // - Max 15 req/sec to avoid GitHub's secondary rate limits
  return Math.max(1, Math.min(15, Math.floor(sustainableRate)));
}

export async function getGitHubRateLimitedHttpClient(
  repoConfig: RepoConfig<GithubConnector>
): Promise<{http: RateLimitedAxiosInstance; rateLimit: RateLimit}> {
  const rateLimit = await getGithubRateLimit(repoConfig);

  // Use concurrency as the rate limit so requests can go out in parallel.
  // When we exhaust the GitHub rate limit, the retry logic will wait for reset.
  const concurrency = calculateConcurrency(rateLimit);

  console.log(
    `Rate limit: ${rateLimit.remaining} remaining. ` +
      `Using ${concurrency} req/sec to match concurrency.`
  );

  const http = getHttpClient(concurrency, 1000);
  return {http, rateLimit};
}

/**
 * Calculate appropriate concurrency based on remaining requests.
 * GitHub's secondary rate limits aren't exposed, but we scale based on remaining requests.
 * Conservative: 1-10 concurrent requests depending on headroom.
 */
export function calculateConcurrencyFromRemaining(remaining: number): number {
  if (remaining < 100) return 1; // Very low, be careful
  if (remaining < 500) return 2;
  if (remaining < 1000) return 3;
  if (remaining < 2000) return 5;
  return 10; // Plenty of headroom
}

/**
 * Calculate appropriate concurrency based on rate limit.
 */
export function calculateConcurrency(rateLimit: RateLimit): number {
  return calculateConcurrencyFromRemaining(rateLimit.remaining);
}

export async function getGithubTeams(context: DownloadContext): Promise<void> {
  const url = `${orgsUrl(context.repoConfig)}/teams?per_page=${MAX_PER_PAGE}&page=1`;

  const responsePageConsumer = (response: AxiosResponse) => {
    const teams: ReadonlyArray<Team> = response.data;
    teams.forEach((team) => {
      writeJsonToFile(getGithubTeamPath(context.repoConfig, team.slug), team);
    });
    return Promise.resolve(true);
  };

  await new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  }).catch((e) => {
    // it's ok for the teams request to fail in this way: if the repo is someone's private one,
    // there is no org, and no teams.
    if (e.response?.status === 404) {
      console.log('No teams found (404) - this is normal for personal repos');
      return Promise.resolve();
    } else {
      console.log(`Teams fetch error: ${e.response?.status} - ${e.message}`);
      throw e;
    }
  });
}

function getGithubTeamMembers(context: DownloadContext, teamSlug: string): Promise<unknown> {
  const url = `${orgsUrl(context.repoConfig)}/teams/${teamSlug}/members`;

  const responsePageConsumer = (response: AxiosResponse) => {
    const members: ReadonlyArray<User> = response.data;
    members.forEach((member) => {
      writeJsonToFile(getGithubTeamMemberPath(context.repoConfig, teamSlug, member.login), member);
    });
    return Promise.resolve(true);
  };

  return new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  });
}

export async function getGithubTeamMembersForAllTeams(
  context: DownloadContext
): Promise<unknown[]> {
  return Promise.all(
    getDownloadedTeamSlugs(context.repoConfig).map((teamSlug) =>
      getGithubTeamMembers(context, teamSlug)
    )
  );
}

export async function getGithubTeamsAndMembers(context: DownloadContext): Promise<void> {
  try {
    console.log(`Fetching teams from ${orgsUrl(context.repoConfig)}/teams`);
    await getGithubTeams(context);
    await getGithubTeamMembersForAllTeams(context);
  } catch (err) {
    // Teams are not mandatory - user may not have permissions to view org teams
    const errorMessage = (err as Error).message || String(err);
    console.log(`Failed to fetch teams: ${errorMessage}`);
    setPhaseError(context.request, errorMessage);
  }
}

// Computes the total number of entities in a series of potentially paged requests.
// Helps avoid unnecessary fetching of data if we are already up-to-date.
async function computeTotalEntityCount(
  context: DownloadContext,
  response: AxiosResponse,
  requestConfig: AxiosRequestConfig
): Promise<number> {
  const parsedLinkHeader = parse(response.headers['link']);
  if (!parsedLinkHeader?.last?.url) {
    return response.data?.length || 0;
  }

  const lastPageLength: number = await get(context, parsedLinkHeader.last.url, requestConfig)
    .then((response) => response.data.length)
    .catch((e: AxiosError) => {
      if ((e.response?.status || -1) >= 500) {
        // if the server repeatedly fails (which GitHub does for e.g. fetching
        // comments at the end of a large repository with multi-year history as of writing this),
        // assume that the last page has no entries. This results in a slightly incorrect count
        // but the next download will fix it.
        return 0;
      }
      throw e;
    });

  const lastPageParams = new URLSearchParams(parsedLinkHeader.last.url);
  const pageCount = parseInt(lastPageParams.get('page') || '1', 10);

  return Promise.resolve(MAX_PER_PAGE * (pageCount - 1) + lastPageLength);
}

function hasMissingData(
  fetchedItems: ReadonlyArray<unknown> | undefined,
  totalCount: number | undefined
): boolean {
  return (fetchedItems?.length || 0) < (totalCount || 0);
}

/**
 * Check if a PR is already cached by comparing updated_at timestamps.
 * GitHub updates this field whenever the PR changes.
 */
function isPullRequestCached(filePath: string, apiUpdatedAt: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const cached = readJsonFile<PullRequest>(filePath);
    return cached.updated_at === apiUpdatedAt;
  } catch {
    return false;
  }
}

/**
 * Check if a comment is already cached by comparing updated_at timestamps.
 */
function isCommentCached(filePath: string, apiUpdatedAt: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const cached = readJsonFile<Comment>(filePath);
    return cached.updated_at === apiUpdatedAt;
  } catch {
    return false;
  }
}

/**
 * Check if a review is already cached. Reviews are immutable, so we just check existence.
 */
function isReviewCached(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function createComparableRepoForPull(pull: PullRequest): Repository {
  return {
    ...pull.base.repo,
    open_issues: 0,
    open_issues_count: 0,
    updated_at: null,
    pushed_at: null,
    template_repository: !pull.base.repo.template_repository
      ? pull.base.repo.template_repository
      : {
          ...pull.base.repo.template_repository,
          open_issues_count: 0,
          updated_at: undefined,
          pushed_at: undefined,
        },
  };
}

async function downloadGithubPullRequestsForUrl(
  context: DownloadContext,
  url: string
): Promise<ReadonlyArray<number>> {
  const metaHolder: {
    updatedPullNumbers: ReadonlyArray<number>;
    meta: Partial<GithubSourceDataMetadata>;
  } = {
    updatedPullNumbers: [],
    meta: {
      fetchedPullNumbers: undefined,
      totalPullsInRepository: UNKNOWN_ENTITY_COUNT,
      updatedAt: undefined,
    },
  };

  const responsePageConsumer = async (
    response: AxiosResponse,
    requestConfig: AxiosRequestConfig
  ) => {
    const pulls: ReadonlyArray<PullRequest> = response.data;

    if (metaHolder.meta.totalPullsInRepository === UNKNOWN_ENTITY_COUNT && pulls.length) {
      const totalCount = await computeTotalEntityCount(context, response, requestConfig);
      const alreadyFetched = getDownloadedPullRequestNumbers(context.repoConfig).length;
      metaHolder.meta = {
        ...metaHolder.meta,
        totalPullsInRepository: totalCount,
      };
      initPhaseProgress(context.request, alreadyFetched, totalCount);
    }

    // Process PRs until we find one that's already cached.
    // PRs are sorted by updated_at desc, so once we find a cached PR,
    // all older PRs (later in the list) should also be cached.
    let foundCachedPr = false;

    for (const pull of pulls) {
      const filePath = getGithubPullPath(context.repoConfig, pull.number);

      if (isPullRequestCached(filePath, pull.updated_at)) {
        foundCachedPr = true;
        break;
      }

      // PR is new or updated - write to disk
      const adjustedPull: PullRequest = {
        ...pull,
        base: {...pull.base, repo: createComparableRepoForPull(pull)},
      };
      if (adjustedPull.updated_at > (metaHolder.meta.updatedAt || '')) {
        metaHolder.meta = {...metaHolder.meta, updatedAt: adjustedPull.updated_at};
      }

      writeJsonToFile(filePath, adjustedPull);
      metaHolder.updatedPullNumbers = [...metaHolder.updatedPullNumbers, pull.number];
      incrementPhaseProgress(context.request);
    }

    // Stop if we found a cached PR; otherwise continue if missing data
    if (foundCachedPr) {
      return false;
    }

    metaHolder.meta = {
      ...metaHolder.meta,
      fetchedPullNumbers: getDownloadedPullRequestNumbers(context.repoConfig),
    };

    return hasMissingData(
      metaHolder.meta.fetchedPullNumbers,
      metaHolder.meta.totalPullsInRepository
    );
  };

  await new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  });

  updateMetadataFile(context.repoConfig, {
    ...metaHolder.meta,
    fetchedPullNumbers: getDownloadedPullRequestNumbers(context.repoConfig),
  });

  return metaHolder.updatedPullNumbers;
}

export async function getGithubPullRequests(
  context: DownloadContext
): Promise<ReadonlyArray<number>> {
  const url = `${repoUrl(
    context.repoConfig
  )}/pulls?state=all&sort=updated&direction=desc&per_page=${MAX_PER_PAGE}&page=1`;

  return downloadGithubPullRequestsForUrl(context, url);
}

export async function getGithubRepoComments(context: DownloadContext): Promise<void> {
  const url = `${repoUrl(
    context.repoConfig
  )}/pulls/comments?sort=updated&direction=desc&per_page=${MAX_PER_PAGE}&page=1`;

  const metaHolder: {meta: Partial<GithubSourceDataMetadata>} = {
    meta: {
      ...(getSourceDataMetadata(context.repoConfig) as GithubSourceDataMetadata),
      fetchedCommentIds: [],
      totalCommentCount: UNKNOWN_ENTITY_COUNT,
    },
  };

  const responsePageConsumer = async (
    response: AxiosResponse,
    requestConfig: AxiosRequestConfig
  ) => {
    const comments: ReadonlyArray<Comment> = response.data;

    if (metaHolder.meta.totalCommentCount === UNKNOWN_ENTITY_COUNT && comments.length) {
      const totalCount = await computeTotalEntityCount(context, response, requestConfig);
      const alreadyFetched = getDownloadedCommentIds(context.repoConfig).length;
      metaHolder.meta = {
        ...metaHolder.meta,
        totalCommentCount: totalCount,
      };
      initPhaseProgress(context.request, alreadyFetched, totalCount);
    }

    // Process comments until we find one that's already cached.
    // Comments are sorted by updated_at desc, so once we find a cached comment,
    // all older comments should also be cached.
    let foundCachedComment = false;

    for (const comment of comments) {
      const pullNumber = getPullRequestNumberFromUrl(comment.pull_request_url);
      const filePath = getGithubCommentPath(context.repoConfig, pullNumber, comment.id);

      if (isCommentCached(filePath, comment.updated_at)) {
        foundCachedComment = true;
        break;
      }

      // Comment is new or updated - write to disk
      writeJsonToFile(filePath, comment);
      incrementPhaseProgress(context.request);
    }

    // Stop if we found a cached comment; otherwise continue if missing data
    if (foundCachedComment) {
      return false;
    }

    metaHolder.meta = {
      ...metaHolder.meta,
      fetchedCommentIds: getDownloadedCommentIds(context.repoConfig),
    };

    return hasMissingData(
      metaHolder.meta.fetchedCommentIds,
      metaHolder.meta.totalCommentCount
    );
  };

  await new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  });

  updateMetadataFile(context.repoConfig, metaHolder.meta);
}

async function getGithubReviewsForPullRequest(
  context: DownloadContext,
  pullNumber: number
): Promise<void> {
  // Create the PR's reviews directory upfront, even if empty.
  // This marks that we've checked this PR for reviews, so we don't re-fetch on subsequent runs.
  ensurePathExists(getGithubPullReviewsPath(context.repoConfig, pullNumber));

  const url = `${repoUrl(
    context.repoConfig
  )}/pulls/${pullNumber}/reviews?per_page=${MAX_PER_PAGE}&page=1`;

  // if we fetch this at the same time with the actual PR, then we can avoid
  // fetching this altogether on incremental runs.
  // same thing for reviewers, commits below

  const responsePageConsumer = (response: AxiosResponse) => {
    const reviews: ReadonlyArray<Review> = response.data;

    // Reviews are fetched per-PR and aren't sorted by time like PRs/comments.
    // We need to process all reviews, skipping ones already cached.
    for (const review of reviews) {
      const filePath = getGithubReviewPath(context.repoConfig, pullNumber, review.id);

      if (isReviewCached(filePath)) {
        continue; // Skip already cached, but keep processing others
      }

      writeJsonToFile(filePath, review);
    }

    // Always fetch all pages for reviews
    return Promise.resolve(true);
  };

  await new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  });
}

function getMissedPullNumbersForReviews(context: DownloadContext): ReadonlyArray<number> {
  const downloadedPullNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const reviewPullNumbers = getDownloadedPullRequestNumbersForReviews(context.repoConfig);

  // Return all PRs that don't have reviews yet (regardless of merged/closed status)
  return downloadedPullNumbers
    .filter((prNumber) => !reviewPullNumbers.includes(prNumber))
    .sort((a, b) => a - b);
}

export async function getGithubReviewsForPullRequests(
  context: DownloadContext,
  requestedPullNumbers: ReadonlyArray<number>
): Promise<void[]> {
  const pullNumbers = removeDuplicates([
    ...requestedPullNumbers,
    ...getMissedPullNumbersForReviews(context),
  ]);

  const allPrNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const prsWithReviews = getDownloadedPullRequestNumbersForReviews(context.repoConfig);
  initPhaseProgress(context.request, prsWithReviews.length, allPrNumbers.length);

  // Use p-limit for concurrency control based on rate limit
  return Promise.all(
    pullNumbers.map((pullNumber) =>
      context.limit(async () => {
        await getGithubReviewsForPullRequest(context, pullNumber);
        incrementPhaseProgress(context.request);
      })
    )
  );
}

async function getGithubCommitsForPullRequest(
  context: DownloadContext,
  pullNumber: number
): Promise<void> {
  const url = `${repoUrl(
    context.repoConfig
  )}/pulls/${pullNumber}/commits?per_page=${MAX_PER_PAGE}&page=1`;

  const responsePageConsumer = (response: AxiosResponse) => {
    const commits: ReadonlyArray<Commit> = response.data;

    commits.forEach((commit) => {
      writeJsonToFile(getGithubCommitPath(context.repoConfig, pullNumber, commit.sha), commit);
    });

    return Promise.resolve(true);
  };

  await new Promise((resolve, reject) => {
    consumePagedRequests(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  });
}

function getMissedPullNumbersForCommits(context: DownloadContext): ReadonlyArray<number> {
  const downloadedPullNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const commitPullNumbers = getDownloadedPullRequestNumbersForCommits(context.repoConfig);

  // Return all PRs that don't have commits yet
  return downloadedPullNumbers
    .filter((prNumber) => !commitPullNumbers.includes(prNumber))
    .sort((a, b) => a - b);
}

export async function getGithubCommitsForPullRequests(
  context: DownloadContext,
  requestedPullNumbers: ReadonlyArray<number>
): Promise<void[]> {
  const pullNumbers = removeDuplicates([
    ...requestedPullNumbers,
    ...getMissedPullNumbersForCommits(context),
  ]);

  const allPrNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const prsWithCommits = getDownloadedPullRequestNumbersForCommits(context.repoConfig);
  initPhaseProgress(context.request, prsWithCommits.length, allPrNumbers.length);

  console.log(`Fetching commits for ${pullNumbers.length} PRs`);

  // Use p-limit for concurrency control based on rate limit
  return Promise.all(
    pullNumbers.map((pullNumber) =>
      context.limit(async () => {
        await getGithubCommitsForPullRequest(context, pullNumber);
        incrementPhaseProgress(context.request);
      })
    )
  );
}
