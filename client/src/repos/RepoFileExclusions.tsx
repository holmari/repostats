import './RepoFileExclusions.css';

import React, {useCallback, useEffect, useRef, useState} from 'react';

import {FileChangeStats, getTopChangedFiles, put} from './requests';
import {RepoConfig} from 'types/types';

interface Props {
  repo: RepoConfig;
  onRepoChange: (repo: RepoConfig) => void;
}

const RepoFileExclusions: React.FC<Props> = ({repo, onRepoChange}) => {
  const [topChangedFiles, setTopChangedFiles] = useState<ReadonlyArray<FileChangeStats>>([]);
  const [fileInput, setFileInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const excludedFilePaths = repo.excludedFilePaths || [];

  useEffect(() => {
    getTopChangedFiles(repo.name)
      .then(setTopChangedFiles)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [repo.name]);

  const handleAddFilePath = useCallback(
    (path: string) => {
      const trimmed = path.trim();
      if (!trimmed || excludedFilePaths.includes(trimmed)) {
        return;
      }
      const newPaths = [...excludedFilePaths, trimmed];
      const updatedRepo = {...repo, excludedFilePaths: newPaths};
      put('repos', updatedRepo)
        .then(onRepoChange)
        .catch(() => {});
      setFileInput('');
    },
    [excludedFilePaths, repo, onRepoChange]
  );

  const handleRemoveFilePath = useCallback(
    (path: string) => {
      const newPaths = excludedFilePaths.filter((p) => p !== path);
      const updatedRepo = {...repo, excludedFilePaths: newPaths};
      put('repos', updatedRepo)
        .then(onRepoChange)
        .catch(() => {});
    },
    [excludedFilePaths, repo, onRepoChange]
  );

  const handleFileInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && fileInput.trim()) {
        e.preventDefault();
        handleAddFilePath(fileInput);
      }
    },
    [fileInput, handleAddFilePath]
  );

  // Filter suggestions based on input and exclude already added paths
  const filteredSuggestions = topChangedFiles.filter(
    (file) =>
      !excludedFilePaths.includes(file.path) &&
      file.path.toLowerCase().includes(fileInput.toLowerCase())
  );

  if (isLoading) {
    return <div className="RepoFileExclusions__loading">Loading suggestions...</div>;
  }

  return (
    <div className="RepoFileExclusions">
      <p className="RepoFileExclusions__description">
        Exclude files from line count statistics. Type a file path or select from suggestions.
      </p>

      <div className="RepoFileExclusions__input-container">
        <input
          ref={inputRef}
          type="text"
          className="RepoFileExclusions__input"
          value={fileInput}
          onChange={(e) => {
            setFileInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          onKeyDown={handleFileInputKeyDown}
          placeholder="Type a file path or pattern..."
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="RepoFileExclusions__suggestions">
            {filteredSuggestions.slice(0, 10).map((file) => (
              <button
                key={file.path}
                type="button"
                className="RepoFileExclusions__suggestion"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddFilePath(file.path);
                }}
              >
                <span className="RepoFileExclusions__suggestion-path">{file.path}</span>
                <span className="RepoFileExclusions__suggestion-lines">
                  {file.linesChanged.toLocaleString()} lines
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {excludedFilePaths.length > 0 ? (
        <div className="RepoFileExclusions__chips">
          {[...excludedFilePaths].sort((a, b) => a.localeCompare(b)).map((path) => (
            <div key={path} className="RepoFileExclusions__chip">
              <span className="RepoFileExclusions__chip-text">{path}</span>
              <button
                type="button"
                className="RepoFileExclusions__chip-remove"
                onClick={() => handleRemoveFilePath(path)}
                aria-label={`Remove ${path}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="RepoFileExclusions__empty">No files excluded yet.</p>
      )}
    </div>
  );
};

export default RepoFileExclusions;
