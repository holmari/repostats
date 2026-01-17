import Axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import {Response, Request} from 'express';
import parse from 'parse-link-header';

import fs from 'fs';
import {readJsonFile, writeJsonToFile} from '../file/json';
import {GithubConnector, GithubSourceDataMetadata, RepoConfig} from '../types/types';
import {
  getGithubCommentPath,
  getGithubPullPath,
  getGithubReviewPath,
  getGithubTeamPath,
  getGithubTeamMemberPath,
  getGithubCommitPath,
  getGithubPullsPath,
} from './github/paths';
import {
  getDownloadedCommentIds,
  getDownloadedPullRequestNumbers,
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
import {iterEachFile} from '../file/utils';
import {getSourceDataMetadata} from '../file/repo';
import {removeDuplicates} from '../arrays/utils';
import {DownloadContext} from '../types/download';
import {RateLimitedAxiosInstance} from 'axios-rate-limit';
import {updateDownloadStatus} from './utils';

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

function get(context: DownloadContext, url: string, requestConfig: AxiosRequestConfig) {
  console.log(`GET ${url}`);

  return context.http.get(url, requestConfig).then((response) => {
    updateDownloadStatus(context.request, {
      rateLimit: response.headers['x-ratelimit-limit'],
      rateLimitLeft: response.headers['x-ratelimit-remaining'],
      fetchedResources: 1,
    });

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

export async function getGitHubRateLimitedHttpClient(
  repoConfig: RepoConfig<GithubConnector>
): Promise<RateLimitedAxiosInstance> {
  const rateLimit = await getGithubRateLimit(repoConfig);
  return getHttpClient(rateLimit.remaining, 60 * 60 * 1000);
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
    if (e.response.status === 404) {
      return Promise.resolve();
    } else {
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
    await getGithubTeams(context);
    await getGithubTeamMembersForAllTeams(context);
  } catch (err) {
    // do nothing; the teams are not mandatory and it's possible that the user does not have
    // permissions to view the teams and members.
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
      metaHolder.meta = {
        ...metaHolder.meta,
        totalPullsInRepository: await computeTotalEntityCount(context, response, requestConfig),
      };
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
      metaHolder.meta = {
        ...metaHolder.meta,
        totalCommentCount: await computeTotalEntityCount(context, response, requestConfig),
      };
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
  const url = `${repoUrl(
    context.repoConfig
  )}/pulls/${pullNumber}/reviews?per_page=${MAX_PER_PAGE}&page=1`;

  // if we fetch this at the same time with the actual PR, then we can avoid
  // fetching this altogether on incremental runs.
  // same thing for reviewers, commits below

  const responsePageConsumer = (response: AxiosResponse) => {
    const reviews: ReadonlyArray<Review> = response.data;

    // Process reviews until we find one that's already cached.
    // Reviews are immutable, so if the file exists, it's cached.
    let foundCachedReview = false;

    for (const review of reviews) {
      const filePath = getGithubReviewPath(context.repoConfig, pullNumber, review.id);

      if (isReviewCached(filePath)) {
        foundCachedReview = true;
        break;
      }

      // New review - write to disk
      writeJsonToFile(filePath, review);
    }

    // Stop if we found a cached review; otherwise continue
    return Promise.resolve(!foundCachedReview);
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

  const pullsWithoutReviews = downloadedPullNumbers
    .filter((prNumber) => !reviewPullNumbers.includes(prNumber))
    .sort((a, b) => a - b);

  const result: number[] = [];
  for (const [pull] of iterEachFile<PullRequest>(getGithubPullsPath(context.repoConfig))) {
    if (!pullsWithoutReviews.includes(pull.number)) {
      continue;
    }
    if (pull.merged_at || pull.closed_at) {
      continue;
    }
    result.push(pull.number);
  }

  return result;
}

export async function getGithubReviewsForPullRequests(
  context: DownloadContext,
  requestedPullNumbers: ReadonlyArray<number>
): Promise<void[]> {
  const pullNumbers = removeDuplicates([
    ...requestedPullNumbers,
    ...getMissedPullNumbersForReviews(context),
  ]);
  return Promise.all(
    pullNumbers.map((pullNumber) => getGithubReviewsForPullRequest(context, pullNumber))
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

export async function getGithubCommitsForPullRequests(
  context: DownloadContext,
  pullNumbers: ReadonlyArray<number>
): Promise<void[]> {
  return Promise.all(
    pullNumbers.map((pullNumber) => getGithubCommitsForPullRequest(context, pullNumber))
  );
}
