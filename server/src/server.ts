import {ErrorRequestHandler} from 'express';
import app from './app';

const jsonErrorHandler: ErrorRequestHandler = (err, _, res) => {
  if (!(err instanceof Error)) {
    res.status(400).send({error: err});
    return;
  }

  res.status(500).send({error: err, message: err.message, stack: err.stack?.split('\n') || []});
};

app.use(jsonErrorHandler);

const server = app.listen(app.get('port'), () => {
  console.log(
    '  App is running at http://localhost:%d in %s mode',
    app.get('port'),
    app.get('env')
  );
  console.log('  Press CTRL-C to stop\n');
});

export default server;
