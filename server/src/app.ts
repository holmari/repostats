import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

import * as analysis from './controllers/analysis';
import * as repos from './controllers/repos';
import * as github from './controllers/github';
import * as teams from './controllers/teams';
import * as users from './controllers/users';
import * as settings from './controllers/settings';
import * as sshKeys from './controllers/sshKeys';
import * as gitStats from './controllers/git-stats';
import {ensurePaths} from './file/paths';
import {SERVER_PORT} from '../../shared/config';

const app = express();
app.use(cors());
app.use(express.json());

app.set('port', process.env.PORT || SERVER_PORT);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/api/repos', repos.get);
app.put('/api/repos', repos.saveRepo);
app.delete('/api/repos/:repoName', repos.deleteRepo);
app.post('/api/repos/:repoName/download', repos.startDownload);
app.get('/api/repos/:repoName/:requestId/status', repos.downloadStatus);
app.get('/api/repos/:repoName/meta', repos.getRepoMetadata);
app.get('/api/repos/:repoName/active-download', repos.getActiveDownload);

app.get('/api/github/token', github.getGithubToken);
app.post('/api/github/test', github.testConnection);

app.post('/api/analyze', analysis.analyze);

app.get('/api/teams', teams.getTeams);
app.get('/api/users', users.getUsers);

app.get('/api/settings', settings.getSettingsHandler);
app.put('/api/settings', settings.saveSettingsHandler);

app.get('/api/ssh-keys', sshKeys.listSSHKeysHandler);
app.post('/api/ssh-keys', sshKeys.saveSSHKeyHandler);
app.delete('/api/ssh-keys/:keyId', sshKeys.deleteSSHKeyHandler);
app.post('/api/ssh-keys/test', sshKeys.testSSHConnectionHandler);

app.get('/api/repos/:repoName/top-changed-files', gitStats.getTopChangedFilesHandler);
app.get('/api/repos/:repoName/user-file-stats/:userId', gitStats.getUserFileStatsHandler);

ensurePaths();

export default app;
