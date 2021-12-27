import Axios, {AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {Response, Request} from 'express';
import parse from 'parse-link-header';
import {URLSearchParams} from 'url';

import {writeJsonToFile} from '../file/json';
import {GithubConnector, GithubSourceDataMetadata, RepoConfig} from '../types/types';
import {
  getGithubCommentPath,
  getGithubPullPath,
  getGithubReviewPath,
  getGithubTeamPath,
  getGithubTeamMemberPath,
  getGithubCommitPath,
  getGithubTeamsPath,
  getGithubTeamMembersPath,
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
import {getFileMd5Hash} from '../file/utils';
import {getSourceDataMetadata} from '../file/repo';
import {removeDuplicates} from '../collections/utils';
import {DownloadContext} from '../types/download';
import {updateDownloadStatus} from './utils';
import {deletePath} from '../file/paths';

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

function get<T>(
  context: DownloadContext,
  url: string,
  requestConfig: AxiosRequestConfig
): Promise<AxiosResponse<T, unknown>> {
  console.log(`GET ${url}`);

  return context.http.get(url, requestConfig).then((response) => {
    updateDownloadStatus(context.request, {
      rateLimit: parseInt(response.headers['x-ratelimit-limit'], 10) ?? undefined,
      rateLimitLeft: parseInt(response.headers['x-ratelimit-remaining'], 10) ?? undefined,
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
    const message = (e instanceof Error ? e?.message : undefined) ?? 'A server error has occurred.';
    res.status(500).send({message, url});
  }
}

function consumePagedRequests<T>(
  context: DownloadContext,
  url: string,
  requestConfig: AxiosRequestConfig,
  consumer: PageConsumer,
  resolve: PromiseLike<T> | ((value: T | null) => void),
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
      } else if (typeof resolve === 'function') {
        resolve(null);
      } else {
        resolve.then(null);
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
): Promise<AxiosInstance> {
  const rateLimit = await getGithubRateLimit(repoConfig);
  return getHttpClient(rateLimit.remaining, 60 * 60 * 1000);
}

export function deleteGithubTeamsAndMembers(context: DownloadContext): void {
  deletePath(getGithubTeamsPath(context.repoConfig));
  deletePath(getGithubTeamMembersPath(context.repoConfig));
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
    deleteGithubTeamsAndMembers(context);
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

  const lastPageLength: number = await get<{length: number}>(
    context,
    parsedLinkHeader.last.url,
    requestConfig
  )
    .then((response) => response.data.length)
    .catch((e: AxiosError) => {
      if ((e.response?.status || -1) >= 500) {
        // if the server repeatedly fails (which GitHub does for e.g. fetching
        // comments at the end of a large repository with multi-year history as of writing this),
        // assume that the last page has no entries. This results in a slightly incorrect count
        // but the next download will fix it.
        console.error(
          `Could not determine number of entities, response was '${e.response?.status}'`
        );
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

function createComparableRepoForPull(baseRepo: Repository): Repository {
  return {
    ...baseRepo,
    open_issues: 0,
    forks: 0,
    permissions: undefined,
    owner: null,
    private: false,
    description: null,
    homepage: null,
    language: null,
    forks_count: 0,
    stargazers_count: 0,
    watchers_count: 0,
    size: 0,
    default_branch: 'main',
    open_issues_count: 0,
    is_template: undefined,
    topics: undefined,
    has_issues: false,
    has_projects: false,
    has_wiki: false,
    has_pages: false,
    has_downloads: false,
    archived: false,
    fork: false,
    disabled: false,
    visibility: undefined,
    updated_at: null,
    pushed_at: null,
    allow_rebase_merge: false,
    template_repository: null,
    temp_clone_token: undefined,
    allow_squash_merge: undefined,
    delete_branch_on_merge: undefined,
    allow_merge_commit: undefined,
    subscribers_count: undefined,
    network_count: undefined,
    watchers: 0,
    master_branch: undefined,
    starred_at: undefined,
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
    const pullNumbers = pulls.map((pull) => pull.number);
    metaHolder.updatedPullNumbers = removeDuplicates([
      ...metaHolder.updatedPullNumbers,
      ...pullNumbers,
    ]);

    metaHolder.meta = {
      ...metaHolder.meta,
      fetchedPullNumbers: getDownloadedPullRequestNumbers(context.repoConfig),
    };

    if (metaHolder.meta.totalPullsInRepository === UNKNOWN_ENTITY_COUNT && pulls.length) {
      metaHolder.meta = {
        ...metaHolder.meta,
        totalPullsInRepository: await computeTotalEntityCount(context, response, requestConfig),
      };
    }

    const editedPullPaths = pulls.reduce<ReadonlyArray<string>>((acc, pull) => {
      const adjustedPull: PullRequest = {
        ...pull,
        base: {...pull.base, repo: createComparableRepoForPull(pull.base.repo)},
        head: {...pull.head, repo: createComparableRepoForPull(pull.head.repo)},
      };
      if (adjustedPull.updated_at > (metaHolder.meta.updatedAt || '')) {
        metaHolder.meta = {...metaHolder.meta, updatedAt: adjustedPull.updated_at};
      }

      const filePath = getGithubPullPath(context.repoConfig, adjustedPull.number);
      const existingFileHash = getFileMd5Hash(filePath);
      const writtenHash = writeJsonToFile(filePath, adjustedPull);

      return writtenHash === existingFileHash ? acc : [...acc, filePath];
    }, []);

    // We only need a next page if we know that there's gaps from most recent to
    // latest, or if one of this page's requests did not yet exist.
    const needsNextPage =
      editedPullPaths.length > 0 ||
      hasMissingData(metaHolder.meta.fetchedPullNumbers, metaHolder.meta.totalPullsInRepository);
    if (needsNextPage) {
      const reason = editedPullPaths.length
        ? `${editedPullPaths.length} pulls changed`
        : `has missing data,
      ${metaHolder.meta.fetchedPullNumbers?.length} fetched, but ${metaHolder.meta.totalPullsInRepository} pulls exist`;

      console.info(`Fetching next page of pulls: ${reason}`);
    }

    return Promise.resolve(needsNextPage);
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

  return await downloadGithubPullRequestsForUrl(context, url);
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

    if (metaHolder.meta.totalCommentCount === UNKNOWN_ENTITY_COUNT) {
      metaHolder.meta = {
        fetchedCommentIds: getDownloadedCommentIds(context.repoConfig),
        totalCommentCount: await computeTotalEntityCount(context, response, requestConfig),
      };
    }

    const editedCommentPaths = comments.reduce<ReadonlyArray<string>>((acc, comment) => {
      const pullNumber = getPullRequestNumberFromUrl(comment.pull_request_url);
      const filePath = getGithubCommentPath(context.repoConfig, pullNumber, comment.id);
      const existingHash = getFileMd5Hash(filePath);
      const writtenHash = writeJsonToFile(filePath, comment);
      return existingHash === writtenHash ? acc : [...acc, filePath];
    }, []);

    const needsNextPage =
      editedCommentPaths.length > 0 ||
      hasMissingData(metaHolder.meta.fetchedCommentIds, metaHolder.meta.totalCommentCount);

    if (needsNextPage) {
      const reason = editedCommentPaths.length
        ? `${editedCommentPaths.length} comments changed`
        : `has missing data,
      ${metaHolder.meta.fetchedCommentIds?.length} fetched, but ${metaHolder.meta.totalCommentCount} comments exist`;

      console.info(`Fetching next page of comments: ${reason}`);
    }

    return Promise.resolve(needsNextPage);
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
  }).catch((e: unknown) => {
    console.error(`Failed to fetch repo comments, will not reattempt for now: ${e}`);
  });

  updateMetadataFile(context.repoConfig, metaHolder.meta);
}

function getGithubReviewsForPullRequest(
  context: DownloadContext,
  pullNumber: number
): Promise<unknown> {
  const url = `${repoUrl(
    context.repoConfig
  )}/pulls/${pullNumber}/reviews?per_page=${MAX_PER_PAGE}&page=1`;

  // if we fetch this at the same time with the actual PR, then we can avoid
  // fetching this altogether on incremental runs.
  // same thing for reviewers, commits below

  const responsePageConsumer = (response: AxiosResponse) => {
    const reviews: ReadonlyArray<Review> = response.data;

    const isCurrentPageUpToDate = reviews.reduce((acc, review) => {
      const filePath = getGithubReviewPath(context.repoConfig, pullNumber, review.id);
      const existingHash = getFileMd5Hash(filePath);
      const writtenHash = writeJsonToFile(filePath, review);
      return acc && existingHash === writtenHash;
    }, true);

    return Promise.resolve(!isCurrentPageUpToDate);
  };

  return new Promise<boolean | null>((resolve, reject) => {
    consumePagedRequests<boolean | null>(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  }).catch((e: unknown) => {
    console.error(
      `Failed to fetch reviews for pull ${pullNumber}, will not reattempt for now: ${e}`
    );
  });
}

function getMissedPullNumbersForReviews(context: DownloadContext): ReadonlyArray<number> {
  const downloadedPullNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const reviewPullNumbers = getDownloadedPullRequestNumbersForReviews(context.repoConfig);

  return downloadedPullNumbers
    .filter((prNumber) => !reviewPullNumbers.includes(prNumber))
    .sort((a, b) => a - b);
}

function getMissedPullNumbersForCommits(context: DownloadContext): ReadonlyArray<number> {
  const downloadedPullNumbers = getDownloadedPullRequestNumbers(context.repoConfig);
  const commitPullNumbers = getDownloadedPullRequestNumbersForCommits(context.repoConfig);

  return downloadedPullNumbers
    .filter((pullNumber) => !commitPullNumbers.includes(pullNumber))
    .sort((a, b) => a - b);
}

export async function getGithubReviewsForPullRequests(
  context: DownloadContext,
  requestedPullNumbers: ReadonlyArray<number>
): Promise<unknown> {
  const pullNumbers = removeDuplicates([
    ...requestedPullNumbers,
    ...getMissedPullNumbersForReviews(context),
  ]);
  console.log(`Fetching reviews for ${pullNumbers.length} pulls`);

  return Promise.all(
    pullNumbers.map((pullNumber) => getGithubReviewsForPullRequest(context, pullNumber))
  );
}

function getGithubCommitsForPullRequest(
  context: DownloadContext,
  pullNumber: number
): Promise<unknown> {
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

  return new Promise((resolve, reject) => {
    consumePagedRequests<boolean | null>(
      context,
      url,
      {headers: getDefaultHeaders(context.repoConfig)},
      responsePageConsumer,
      resolve,
      reject
    );
  }).catch((e: unknown) => {
    console.error(`Failed to fetch commits, will not reattempt for now: ${e}`);
  });
}

export async function getGithubCommitsForPullRequests(
  context: DownloadContext,
  requestedPullNumbers: ReadonlyArray<number>
): Promise<unknown[]> {
  const pullNumbers = removeDuplicates([
    ...requestedPullNumbers,
    ...getMissedPullNumbersForCommits(context),
  ]);
  console.log(`Fetching commits for ${pullNumbers.length} pulls`);

  return Promise.all(
    pullNumbers.map((pullNumber) => getGithubCommitsForPullRequest(context, pullNumber))
  );
}
