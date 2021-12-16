import './RepoSettingsModal.css';

import React, {useCallback, useEffect, useState} from 'react';
import Button from 'react-bootstrap/Button';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Modal from 'react-bootstrap/Modal';

import {RepoConfig, GithubConnector} from 'types/types';
import {useRootState} from 'state';
import {Pagination, Spinner} from 'react-bootstrap';
import {RequestStatus} from 'requests/types';
import {post} from './requests';

const GithubConnectorInputs: React.FC<GHConnectorInputProps> = ({
  onChange,
  repoConfig,
}: GHConnectorInputProps) => {
  const [testStatus, setTestStatus] = useState(RequestStatus.UNSTARTED);
  const [testFailure, setTestFailure] = useState(null);

  const [state] = useRootState();
  const savedToken = state.github.oauthToken;

  const updateToken = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        ...repoConfig,
        connector: {...repoConfig.connector, token: event.currentTarget.value || ''},
      }),
    [onChange, repoConfig]
  );

  useEffect(() => {
    if (savedToken && !repoConfig.connector.token) {
      onChange({...repoConfig, connector: {...repoConfig.connector, token: savedToken}});
    }
    // Note: only fill the token in automatically once, but allow clearing by user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testGithubConnection = () => {
    setTestFailure(null);
    setTestStatus(RequestStatus.IN_PROGRESS);

    post('github/test', repoConfig)
      .then(() => {
        setTestStatus(RequestStatus.SUCCESS);
      })
      .catch((error) => {
        setTestStatus(RequestStatus.FAILURE);
        setTestFailure(error?.message || null);
      });
  };

  return (
    <>
      <p>
        Add a{' '}
        <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
          Personal Access Token
        </a>{' '}
        below with at least <strong>read:org</strong> and <strong>repo</strong> access:{' '}
      </p>
      <InputGroup className="mb-3">
        <InputGroup.Prepend>
          <InputGroup.Text>GitHub OAuth token</InputGroup.Text>
        </InputGroup.Prepend>
        <FormControl placeholder="" onChange={updateToken} value={repoConfig.connector.token} />
      </InputGroup>
      <p>
        You can store the token in GITHUB_TOKEN env variable, in which case it will be picked up
        automatically.
      </p>
      <div className="RepoSettingsModal__connection-test-bar">
        <Button
          size="sm"
          onClick={testGithubConnection}
          disabled={!repoConfig.connector.token}
          variant="outline-info"
        >
          {testStatus === RequestStatus.IN_PROGRESS && (
            <Spinner
              className="RepoSettingsModal__connection-test--spinner"
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
            />
          )}
          Test Connection
        </Button>
        {testStatus === RequestStatus.FAILURE && (
          <div className="RepoSettingsModal__connection-test--error">
            {testFailure || 'An unknown error occurred.'}
          </div>
        )}
        {testStatus === RequestStatus.SUCCESS && (
          <div className="RepoSettingsModal__connection-test--success">Connected!</div>
        )}
      </div>
    </>
  );
};
interface GHConnectorInputProps {
  onChange: (repoConfig: RepoConfig<GithubConnector>) => void;
  repoConfig: RepoConfig<GithubConnector>;
}

const ConnectorInputs: React.FC<ConnectorInputsProps> = ({onChange, repoConfig}) => {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return (
        <GithubConnectorInputs
          onChange={onChange}
          repoConfig={repoConfig as RepoConfig<GithubConnector>}
        />
      );
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
};
interface ConnectorInputsProps {
  onChange: (config: RepoConfig) => void;
  repoConfig: RepoConfig;
}

const stepCount = 2;

const RepoSettingsModal: React.FC<Props> = ({
  isDialogOpen,
  isNew,
  onClose,
  onChange,
  onSave,
  repo,
}: Props) => {
  const [currentStep, setCurrentStep] = useState(0);

  const hasLessSteps = isNew && currentStep > 0;
  const hasMoreSteps = isNew && stepCount - currentStep > 1;

  const getPage = (step: number) => {
    switch (step) {
      case 0:
        return (
          <>
            <p>To add a repository, copypaste its GitHub URL below:</p>
            <InputGroup className="mb-3">
              <InputGroup.Prepend>
                <InputGroup.Text>Repository URL</InputGroup.Text>
              </InputGroup.Prepend>
              <FormControl
                onChange={setUrl}
                placeholder="e.g. https://github.com/holmari/gerritstats"
                value={repo.url}
              />
            </InputGroup>
          </>
        );
      case 1:
        return <ConnectorInputs onChange={onChange} repoConfig={repo} />;
      default:
        throw new Error(`Unsupported step '${step}'`);
    }
  };

  const setUrl = (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({...repo, url: event.currentTarget.value || ''});

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 0) {
      onClose();
    }
  };

  const handleNext = () => {
    if (hasMoreSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onSave(repo);
    }
  };

  const hasUrl = repo.url?.length > 0;

  return (
    <Modal show={isDialogOpen} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add repository</Modal.Title>
      </Modal.Header>
      <Modal.Body className="RepoSettingsModal__body">
        {isNew && (
          <div className="RepoSettingsModal__step-bar">
            <Pagination>
              <Pagination.Item active={currentStep === 0} onClick={() => setCurrentStep(0)}>
                Setup
              </Pagination.Item>
              <Pagination.Item
                disabled={!hasUrl}
                active={currentStep === 1}
                onClick={() => setCurrentStep(1)}
              >
                Connectivity
              </Pagination.Item>
            </Pagination>
          </div>
        )}

        <div className="RepoSettingsModal__body-content">
          {isNew ? (
            getPage(currentStep)
          ) : (
            <>
              {getPage(0)}
              {getPage(1)}
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleBack}>
          {hasLessSteps ? 'Back' : 'Close'}
        </Button>
        <Button variant="primary" disabled={!hasUrl} onClick={handleNext}>
          {hasMoreSteps ? 'Next' : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
interface Props {
  isDialogOpen: boolean;
  isNew?: boolean;
  onClose: () => void;
  onChange: (repo: RepoConfig) => void;
  onSave: (config: RepoConfig) => void;
  repo: RepoConfig;
}
export default RepoSettingsModal;
