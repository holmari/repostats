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

function getParentDirectory(filePath: string): string | null {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) {
    return null;
  }
  return filePath.substring(0, lastSlash);
}

const FilePathCell: React.FC<Props> = ({path, repoName, width}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const {showToast} = useToast();
  const parentDir = getParentDirectory(path);
  const grandparentDir = parentDir != null ? getParentDirectory(parentDir) : null;

  const addExclusion = useCallback(async (pattern: string) => {
    setMenuOpen(false);

    try {
      const repos = await get('repos');
      const repo = repos.find((r) => r.name === repoName);

      if (!repo) {
        showToast(`Could not find repository: ${repoName}`);
        return;
      }

      const excludedFilePaths = repo.excludedFilePaths || [];

      if (excludedFilePaths.includes(pattern)) {
        showToast(`${pattern} is already excluded`);
        return;
      }

      const updatedRepo = {
        ...repo,
        excludedFilePaths: [...excludedFilePaths, pattern],
      };

      await put('repos', updatedRepo);

      showToast(`Added "${pattern}" to exclusions. Refresh to update.`, {
        action: {
          icon: 'refresh',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      showToast('Failed to add exclusion');
    }
  }, [repoName, showToast]);

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
          <Dropdown.Item className="FilePathCell__dropdown-item" onClick={() => addExclusion(path)}>
            Exclude File
          </Dropdown.Item>
          {parentDir != null && (
            <Dropdown.Item className="FilePathCell__dropdown-item" onClick={() => addExclusion(`${parentDir}/**`)}>
              Exclude .../{grandparentDir ? `${grandparentDir.split('/').pop()}/` : ''}{parentDir.split('/').pop()}/
            </Dropdown.Item>
          )}
          {grandparentDir != null && (
            <Dropdown.Item className="FilePathCell__dropdown-item" onClick={() => addExclusion(`${grandparentDir}/**`)}>
              Exclude .../{grandparentDir.split('/').pop()}/
            </Dropdown.Item>
          )}
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
