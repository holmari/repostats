import "./index.css";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

import { Routes, Route, Navigate, NavLink } from "react-router";

import { StateProvider } from "./state";
import { ToastProvider } from "components/ToastContext";
import AppStartupActions from "./AppStartupActions";
import ReposPage from "repos/ReposPage";
import SettingsPage from "settings/SettingsPage";
import ExclusionsSettingsPage from "settings/ExclusionsSettingsPage";
import SSHKeySettingsPage from "settings/SSHKeySettingsPage";
import TeamsSettingsPage from "settings/TeamsSettingsPage";
import AnalysisPage from "analysis/AnalysisPage";
import AnalysisPerUserPage from "analysis/AnalysisPerUserPage";
import AnalysisPerTeamPage from "analysis/AnalysisPerTeamPage";
import AnalysisTeamGraphPage from "analysis/AnalysisTeamGraphPage";
import AllUsersOverviewPage from "analysis/AllUsersOverviewPage";

export default function Root() {
  return (
    <div className="App">
      <StateProvider>
        <ToastProvider>
        <AppStartupActions />
        <nav>
          <div className="App__nav-content">
            <NavLink className={({ isActive }) => isActive ? "App__nav-link--active" : ""} to="/analysis/people">
              Analysis
            </NavLink>
            <NavLink className={({ isActive }) => isActive ? "App__nav-link--active" : ""} to="/analysis/team-graph">
              Org Graph
            </NavLink>
            <NavLink className={({ isActive }) => isActive ? "App__nav-link--active" : ""} to="/analysis/overview">
              Overview
            </NavLink>
            <div className="App__nav-spacer" />
            <NavLink className={({ isActive }) => isActive ? "App__nav-link--active" : ""} to="/settings/repos">
              Settings
            </NavLink>
          </div>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/settings/repos" replace />} />
            <Route path="/settings" element={<SettingsPage />}>
              <Route index element={<Navigate to="/settings/repos" replace />} />
              <Route path="repos/:selectedRepo?/:add?" element={<ReposPage />} />
              <Route path="teams" element={<TeamsSettingsPage />} />
              <Route path="exclusions" element={<ExclusionsSettingsPage />} />
              <Route path="ssh-keys" element={<SSHKeySettingsPage />} />
            </Route>
            <Route path="/analysis" element={<AnalysisPage />}>
              <Route path="people/:userId?" element={<AnalysisPerUserPage />} />
              <Route path="teams/:teamSlug?" element={<AnalysisPerTeamPage />} />
              <Route path="team-graph" element={<AnalysisTeamGraphPage />} />
              <Route path="overview" element={<AllUsersOverviewPage />} />
            </Route>
          </Routes>
        </main>
        </ToastProvider>
      </StateProvider>
    </div>
  );
}
