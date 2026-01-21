import './UserFileStatsPanel.css';

import React, {useEffect, useMemo, useState} from 'react';

import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';
import {AnalyzeResult, UserFileStats, UserResult} from 'types/types';
import {getUserFileStats} from 'repos/requests';
import CenteredSpinner from 'components/CenteredSpinner';
import FilePathCell from './FilePathCell';

interface FileStatsWithRepo extends UserFileStats {
  readonly repoName: string;
}

const FILE_COLUMN_WIDTH = 650;
const REPO_COLUMN_WIDTH = 150;

function getColumns(showRepoColumn: boolean): ReadonlyArray<SortableColumn<FileStatsWithRepo>> {
  const fileColumnWidth = showRepoColumn ? FILE_COLUMN_WIDTH : FILE_COLUMN_WIDTH + REPO_COLUMN_WIDTH;

  const cols: Array<SortableColumn<FileStatsWithRepo>> = [
    {
      Header: 'File',
      accessor: (row) => row.path,
      width: fileColumnWidth,
      Cell: ({row}: {row: {original: FileStatsWithRepo}}) => (
        <FilePathCell
          path={row.original.path}
          repoName={row.original.repoName}
          width={fileColumnWidth}
        />
      ),
    },
  ];

  if (showRepoColumn) {
    cols.push({
      Header: 'Repository',
      accessor: (row) => row.repoName,
      width: REPO_COLUMN_WIDTH,
    });
  }

  cols.push(
    {
      Header: 'Lines Added',
      accessor: (row) => row.linesAdded,
      width: 120,
      Cell: ({value}: {value: number}) => (
        <span className="UserFileStatsPanel__cell--added">+{value.toLocaleString()}</span>
      ),
    },
    {
      Header: 'Lines Deleted',
      accessor: (row) => row.linesDeleted,
      width: 120,
      Cell: ({value}: {value: number}) => (
        <span className="UserFileStatsPanel__cell--deleted">-{value.toLocaleString()}</span>
      ),
    }
  );

  return cols;
}

const INITIAL_DISPLAY_COUNT = 25;

const UserFileStatsPanel: React.FC<Props> = ({user, fullResult}) => {
  const [fileStats, setFileStats] = useState<FileStatsWithRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const repoNames = useMemo(
    () => fullResult.includedRepos.map((r) => r.name),
    [fullResult.includedRepos]
  );

  const showRepoColumn = repoNames.length > 1;
  const columns = useMemo(() => getColumns(showRepoColumn), [showRepoColumn]);
  const fileColumnWidth = showRepoColumn ? FILE_COLUMN_WIDTH : FILE_COLUMN_WIDTH + REPO_COLUMN_WIDTH;

  // Use the requested analysis date interval to match what processGitStats uses for the Authored panel
  const dateInterval = fullResult.requestedInterval;

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const allStats: FileStatsWithRepo[] = [];

      for (const repoName of repoNames) {
        try {
          const stats = await getUserFileStats(
            repoName,
            user.id,
            dateInterval?.startDate,
            dateInterval?.endDate
          );
          for (const stat of stats) {
            allStats.push({...stat, repoName});
          }
        } catch {
          // Ignore errors for individual repos
        }
      }

      // Sort by total lines changed
      allStats.sort((a, b) => b.linesAdded + b.linesDeleted - (a.linesAdded + a.linesDeleted));

      setFileStats(allStats);
      setLoading(false);
    };

    fetchStats();
  }, [repoNames, user.id, dateInterval?.startDate, dateInterval?.endDate]);

  // Calculate totals - must be before any conditional returns (React hooks rules)
  const totalAdded = useMemo(
    () => fileStats.reduce((sum, f) => sum + f.linesAdded, 0),
    [fileStats]
  );
  const totalDeleted = useMemo(
    () => fileStats.reduce((sum, f) => sum + f.linesDeleted, 0),
    [fileStats]
  );

  const displayedFiles = showAll ? fileStats : fileStats.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreFiles = fileStats.length > INITIAL_DISPLAY_COUNT;

  if (loading) {
    return (
      <Panel title="Top Changed Files" size="flex">
        <CenteredSpinner />
      </Panel>
    );
  }

  if (fileStats.length === 0) {
    return null;
  }

  const panelTitle = showAll ? 'All Changed Files' : 'Top Changed Files';

  return (
    <Panel title={panelTitle} size="flex">
      <div className="UserFileStatsPanel__table-container">
        <Table columns={columns} data={displayedFiles} />
        <div className="UserFileStatsPanel__totals-row">
          <span className="UserFileStatsPanel__totals-label" style={{width: fileColumnWidth}}>
            Total ({fileStats.length} files)
          </span>
          {showRepoColumn && <span style={{width: REPO_COLUMN_WIDTH}}></span>}
          <span className="UserFileStatsPanel__cell--added" style={{width: 120}}>
            +{totalAdded.toLocaleString()}
          </span>
          <span className="UserFileStatsPanel__cell--deleted" style={{width: 120}}>
            -{totalDeleted.toLocaleString()}
          </span>
        </div>
        {hasMoreFiles && !showAll && (
          <button
            className="UserFileStatsPanel__see-all-button"
            onClick={() => setShowAll(true)}
          >
            See all {fileStats.length} files
          </button>
        )}
      </div>
    </Panel>
  );
};

interface Props {
  user: UserResult;
  fullResult: AnalyzeResult;
}

UserFileStatsPanel.displayName = 'UserFileStatsPanel';

export default UserFileStatsPanel;
