## RepoStats client

The client is responsible for the rendering the analysis data. It doesn't fetch data from GitHub or elsewhere - the server component does all that.

### Architecture

The technology choices are React, Typescript, and a few libraries for the UI components - namely, react-bootstrap.

The frontend does minimal analysis computations on its own - it fires requests to the server, and processes the results. At its most complex, it does a bit of summing.

The current version of the client/server interaction is not optimized for performance. While the results are cached, large repositories with tens of thousands of comments can get pretty slow.

### Usage

To install dependencies,

`npm install`

To start the development mode, run

`npm run start`

Alternatively, you can also build the distribution, install `serve`, and serve the binary that way.
