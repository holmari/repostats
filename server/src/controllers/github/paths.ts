import {ensurePathExists, getSourceDataPath} from '../../file/paths';
import {RepoConfig} from '../../types/types';

export function getGithubDataPath(repoConfig: RepoConfig): string {
  return `${getSourceDataPath(repoConfig.name)}/gh`;
}

export function getGithubMetadataPath(repoConfig: RepoConfig): string {
  return `${getSourceDataPath(repoConfig.name)}/gh/meta.json`;
}

export function getGithubPullsPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/pulls`;
}

export function getGithubPullPath(repoConfig: RepoConfig, pullNumber: number): string {
  return `${getGithubPullsPath(repoConfig)}/${pullNumber}.json`;
}

export function getGithubReviewsPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/reviews`;
}

export function getGithubReviewPath(
  repoConfig: RepoConfig,
  pullNumber: number,
  reviewId: number
): string {
  return `${getGithubReviewsPath(repoConfig)}/${pullNumber}/${reviewId}.json`;
}

export function getGithubCommentsPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/comments`;
}

export function getGithubCommentPath(
  repoConfig: RepoConfig,
  pullNumber: number,
  commentId: number
): string {
  return `${getGithubCommentsPath(repoConfig)}/${pullNumber}/${commentId}.json`;
}

export function getGithubTeamsPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/teams`;
}

export function getGithubTeamPath(repoConfig: RepoConfig, teamSlug: string): string {
  return `${getGithubTeamsPath(repoConfig)}/${teamSlug}.json`;
}

export function getGithubTeamMembersPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/team_members`;
}

export function getGithubTeamMemberPath(
  config: RepoConfig,
  teamSlug: string,
  userHandle: string
): string {
  return `${getGithubTeamMembersPath(config)}/${teamSlug}/${userHandle}.json`;
}

export function getGithubCommitsPath(repoConfig: RepoConfig): string {
  return `${getGithubDataPath(repoConfig)}/commits`;
}

export function getGithubCommitPath(
  repoConfig: RepoConfig,
  pullNumber: number,
  sha: string
): string {
  return `${getGithubDataPath(repoConfig)}/commits/${pullNumber}/${sha}.json`;
}

export function ensureGithubPaths(repoConfig: RepoConfig): void {
  ensurePathExists(getGithubPullsPath(repoConfig));
  ensurePathExists(getGithubCommentsPath(repoConfig));
  ensurePathExists(getGithubReviewsPath(repoConfig));
  ensurePathExists(getGithubTeamsPath(repoConfig));
  ensurePathExists(getGithubTeamMembersPath(repoConfig));
  ensurePathExists(getGithubCommitsPath(repoConfig));
}
