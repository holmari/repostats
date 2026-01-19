import './RepositoryPicker.css';

import React, {useEffect, useState} from 'react';
import {Button, OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

import TopBarButton from './TopBarButton';
import PopoverSelectionList, {defaultItemRenderer} from './PopoverSelectionList';

function getSubtitle(selectedRepos: ReadonlyArray<string> | undefined, entriesToDisplay = 2) {
  if (!selectedRepos) {
    return 'All';
  } else if (!selectedRepos.length) {
    return 'None';
  }

  const baseSubtitle = selectedRepos.slice(0, entriesToDisplay).join(', ');
  const remaining = selectedRepos.length - entriesToDisplay;
  return remaining > 0 ? `${baseSubtitle} +${remaining} more` : baseSubtitle;
}

const RepositoryPicker: React.FC<Props> = ({
  availableRepositories,
  onChange,
  selectedRepositories,
}) => {
  const [proposedSelection, setProposedSelection] = useState<ReadonlyArray<string>>(
    selectedRepositories || availableRepositories
  );
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setProposedSelection(selectedRepositories || availableRepositories);
  }, [availableRepositories, selectedRepositories]);

  const handleConfirm = () => {
    setPopoverOpen(false);
    onChange(proposedSelection);
  };

  const popover = (
    <Popover id="repositories-popover" placement="top-start">
      <Popover.Header>Repositories</Popover.Header>
      <Popover.Body className="RepositoryPicker__popover-content">
        <PopoverSelectionList
          itemRenderer={defaultItemRenderer}
          items={availableRepositories}
          onChange={setProposedSelection}
          selectedItems={proposedSelection}
        />
        <div className="RepositoryPicker__popover-footer">
          <Button onClick={handleConfirm} size="sm">
            Change
          </Button>
        </div>
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger show={isPopoverOpen} placement="bottom-start" overlay={popover} rootClose>
      <div className="RepositoryPicker">
        <TopBarButton
          onClick={() => setPopoverOpen(!isPopoverOpen)}
          title="Repositories"
          subtitle={getSubtitle(selectedRepositories)}
        />
      </div>
    </OverlayTrigger>
  );
};
RepositoryPicker.displayName = 'RepositoryPicker';

interface Props {
  availableRepositories: ReadonlyArray<string>;
  selectedRepositories: ReadonlyArray<string> | undefined;
  onChange: (selectedRepoName: ReadonlyArray<string>) => void;
}

export default RepositoryPicker;
