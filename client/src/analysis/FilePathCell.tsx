import './FilePathCell.css';

import React, {useCallback, useState} from 'react';
import Dropdown from 'react-bootstrap/Dropdown';

import {useToast} from 'components/ToastContext';
import {get, put} from 'repos/requests';

interface Props {
  path: string;
  repoName: string;
  width: number;
}

const FilePathCell: React.FC<Props> = ({path, repoName, width}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const {showToast} = useToast();

  const handleAddToExclusions = useCallback(async () => {
    setMenuOpen(false);

    try {
      // Fetch current repo config
      const repos = await get('repos');
      const repo = repos.find((r) => r.name === repoName);

      if (!repo) {
        showToast(`Could not find repository: ${repoName}`);
        return;
      }

      const excludedFilePaths = repo.excludedFilePaths || [];

      // Check if already excluded
      if (excludedFilePaths.includes(path)) {
        showToast(`${path} is already excluded`);
        return;
      }

      // Update repo with new exclusion
      const updatedRepo = {
        ...repo,
        excludedFilePaths: [...excludedFilePaths, path],
      };

      await put('repos', updatedRepo);

      const filename = path.split('/').pop() || path;
      showToast(`Added "${filename}" to exclusions. Refresh to update.`, {
        action: {
          icon: 'refresh',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      showToast('Failed to add file to exclusions');
    }
  }, [path, repoName, showToast]);

  return (
    <div className="FilePathCell">
      <Dropdown show={menuOpen} onToggle={setMenuOpen}>
        <Dropdown.Toggle
          as="button"
          className={`FilePathCell__action-button ${menuOpen ? 'FilePathCell__action-button--visible' : ''}`}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          ⋮
        </Dropdown.Toggle>
        <Dropdown.Menu className="FilePathCell__dropdown-menu">
          <Dropdown.Item className="FilePathCell__dropdown-item" onClick={handleAddToExclusions}>
            Add to File Exclusions
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <span
        className="UserFileStatsPanel__path"
        style={{width: width - 24, maxWidth: width - 24}}
        title={path}
      >
        {path}
      </span>
    </div>
  );
};

FilePathCell.displayName = 'FilePathCell';

export default FilePathCell;
