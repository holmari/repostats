import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

import * as analysis from './controllers/analysis';
import * as repos from './controllers/repos';
import * as github from './controllers/github';
import {ensurePaths} from './file/paths';

const app = express();
app.use(cors());
app.use(express.json());

app.set('port', process.env.PORT || 3001);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/api/repos', repos.get);
app.put('/api/repos', repos.saveRepo);
app.delete('/api/repos/:repoName', repos.deleteRepo);
app.post('/api/repos/:repoName/download', repos.startDownload);
app.get('/api/repos/:repoName/:requestId/status', repos.downloadStatus);
app.get('/api/repos/:repoName/meta', repos.getRepoMetadata);

app.get('/api/github/token', github.getGithubToken);
app.post('/api/github/test', github.testConnection);

app.post('/api/analyze', analysis.analyze);

ensurePaths();

export default app;
