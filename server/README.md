## RepoStats backend

The backend of RepoStats provides both source data fetching and storage, as well as analytics computation to the frontend. 

### Architecture

The backend is a node.js + express server, written in TS. It only has a handful of endpoints; see `src/app.ts` for the endpoints.

The backend is responsible for configuring repositories, persisting that configuration and fetching source data from the supported connectors like from Github's REST API. These configurations are stored on disk, in a way that makes incremental data fetching possible.

The server is also responsible for computing analytics results based on the frontend's requests. By default, the frontend requests analytics for all repositories, for all time. However, the frontend can also limit the time range or the included repositories, in which case the backend filters out non-matching content when aggregating the results.

The current version of the client/server interaction is not optimized for performance. While the results are cached, large repositories with tens of thousands of comments can get pretty slow. Computing results can take up to one minute or so on a powerful laptop. This could be improved, possibly substanitally with some intermediate caching and perhaps by parallelizing some of the result computations, but this is not done to keep the code simpler, and because performance has not a major usability factor with this tool as of the initial release, at least.

### Usage

To install dependencies,

`npm install`

To start the development server, run

`npm run watch`

To debug with the Chrome web inspector, `npm run build && npm run serve-debug` and fire up the inspector from `chrome://inspect`.
