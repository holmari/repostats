import React, {useState} from 'react';
import {Button, OverlayTrigger} from 'react-bootstrap';
import Popover from 'react-bootstrap/Popover';

const DeleteButton: React.FC<Props> = ({onConfirm}) => {
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const handleConfirm = () => {
    setPopoverOpen(false);
    onConfirm();
  };
  const popover = (
    <Popover id="delete-popover">
      <Popover.Header as="h3">Confirm Deletion</Popover.Header>
      <Popover.Body>
        <p>Are you sure you want to delete this?</p>
        <Button onClick={handleConfirm} size="sm" variant="outline-danger">
          Yes, Delete
        </Button>
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger show={isPopoverOpen} placement="bottom" overlay={popover}>
      <Button onClick={() => setPopoverOpen(true)} variant="danger">
        Delete…
      </Button>
    </OverlayTrigger>
  );
};
DeleteButton.displayName = 'DeleteButton';
interface Props {
  onConfirm: () => void;
}

export default DeleteButton;
