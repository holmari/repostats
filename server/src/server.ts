import errorHandler from 'errorhandler';

import app from './app';
import {ensureSettingsDir, getSettingsFilePath} from './file/settings';

app.use(errorHandler());

ensureSettingsDir();

const server = app.listen(app.get('port'), () => {
  console.log(
    '  App is running at http://localhost:%d in %s mode',
    app.get('port'),
    app.get('env')
  );
  console.log('  Press CTRL-C to stop');
  console.log('  Settings file: %s\n', getSettingsFilePath());
});

export default server;
