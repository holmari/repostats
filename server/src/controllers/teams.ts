import {Response, Request} from 'express';
import fs from 'fs';

import {getReposPath, getConfigPath, ensurePaths} from '../file/paths';
import {getConfigFile} from '../file/repo';
import {RepoConfig, TeamInfo} from '../types/types';
import {getGithubTeamsPath, getGithubTeamMembersPath} from './github/paths';
import {Team} from '../types/github';
import {readJsonFile} from '../file/json';
import {readCustomTeams} from '../file/customTeams';

function getTeamsForRepo(repoConfig: RepoConfig): TeamInfo[] {
  if (repoConfig.connector.type !== 'GITHUB') {
    return [];
  }

  const teamsPath = getGithubTeamsPath(repoConfig);
  if (!fs.existsSync(teamsPath)) {
    return [];
  }

  const teamFiles = fs.readdirSync(teamsPath).filter((f) => f.endsWith('.json'));
  const teams: TeamInfo[] = [];

  for (const teamFile of teamFiles) {
    const teamFilePath = `${teamsPath}/${teamFile}`;
    const team: Team = readJsonFile(teamFilePath);

    const membersPath = `${getGithubTeamMembersPath(repoConfig)}/${team.slug}`;
    let memberLogins: string[] = [];

    if (fs.existsSync(membersPath)) {
      memberLogins = fs
        .readdirSync(membersPath)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    }

    teams.push({
      slug: team.slug,
      name: team.name,
      memberLogins,
      source: 'github',
    });
  }

  return teams;
}

export function getTeams(_req: Request, res: Response): void {
  ensurePaths();

  const reposPath = getReposPath();
  const allRepoDirs = fs.readdirSync(reposPath);

  const teamsBySlug = new Map<string, TeamInfo>();

  for (const repoName of allRepoDirs) {
    if (!fs.existsSync(getConfigPath(repoName))) {
      continue;
    }

    const repoConfig = getConfigFile(repoName);
    const repoTeams = getTeamsForRepo(repoConfig);

    for (const team of repoTeams) {
      const existing = teamsBySlug.get(team.slug);
      if (existing) {
        // Merge member logins from multiple repos
        const mergedLogins = new Set([...existing.memberLogins, ...team.memberLogins]);
        teamsBySlug.set(team.slug, {
          ...existing,
          memberLogins: Array.from(mergedLogins),
        });
      } else {
        teamsBySlug.set(team.slug, team);
      }
    }
  }

  // Merge in custom teams
  const customTeams = readCustomTeams();
  for (const customTeam of customTeams) {
    teamsBySlug.set(customTeam.slug, {...customTeam, source: 'custom'});
  }

  const teams = Array.from(teamsBySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  res.json(teams);
}
