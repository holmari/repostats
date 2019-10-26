import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import React from 'react';
import {BrowserRouter, Switch, Route, Redirect, NavLink} from 'react-router-dom';

import ReposPage from './repos/ReposPage';
import {StateProvider} from './state';
import AppStartupActions from './AppStartupActions';
import AnalysisPage from './analysis/AnalysisPage';

const App: React.FC = () => {
  return (
    <div className="App">
      <BrowserRouter>
        <StateProvider>
          <AppStartupActions />

          <nav>
            <div className="App__nav-content">
              <NavLink activeClassName="App__nav-link--active" to="/analysis/people">
                Per-user analysis
              </NavLink>
              <NavLink activeClassName="App__nav-link--active" to="/analysis/team-graph">
                Team Graph
              </NavLink>
              <NavLink activeClassName="App__nav-link--active" to="/analysis/overview">
                Overview
              </NavLink>
              <div className="App__nav-spacer" />
              <NavLink activeClassName="App__nav-link--active" to="/settings">
                Settings
              </NavLink>
            </div>
          </nav>

          <main>
            <Switch>
              <Route path="/analysis" component={AnalysisPage} />
              <Route path="/settings/repos/:selectedRepo/:add?" component={ReposPage} />
              <Route path="/settings/repos" component={ReposPage} />
              <Route path="/">
                <Redirect to="/settings/repos" />
              </Route>
            </Switch>
          </main>
        </StateProvider>
      </BrowserRouter>
    </div>
  );
};

export default App;
