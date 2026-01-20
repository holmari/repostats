import './SSHKeySettingsPage.css';

import React, {useCallback, useEffect, useState} from 'react';

import {get, post, put, del, SSHKeyListResponse} from 'repos/requests';
import CenteredSpinner from 'components/CenteredSpinner';

const SSHKeySettingsPage: React.FC = () => {
  const [keysData, setKeysData] = useState<SSHKeyListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [keyName, setKeyName] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const loadKeys = useCallback(async () => {
    try {
      const data = await get('ssh-keys');
      setKeysData(data);
    } catch (e) {
      setError('Failed to load SSH keys');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleSaveKey = useCallback(async () => {
    if (!keyName.trim() || !privateKey.trim()) {
      setError('Name and private key are required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setTestResult(null);

    try {
      const newKey = await post('ssh-keys', {
        name: keyName.trim(),
        privateKey: privateKey.trim(),
      });

      // Set as active key
      const currentSettings = await get('settings');
      await put('settings', {
        ...currentSettings,
        activeSSHKeyId: newKey.id,
      });

      setKeyName('');
      setPrivateKey('');
      await loadKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save SSH key');
    }

    setIsSaving(false);
  }, [keyName, privateKey, loadKeys]);

  const handleDeleteKey = useCallback(async (keyId: string) => {
    setError(null);
    setTestResult(null);

    try {
      await del(`ssh-keys/${keyId}`);

      // Clear active key if it was deleted
      const currentSettings = await get('settings');
      if (currentSettings.activeSSHKeyId === keyId) {
        await put('settings', {
          ...currentSettings,
          activeSSHKeyId: undefined,
        });
      }

      await loadKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete SSH key');
    }
  }, [loadKeys]);

  const handleTestConnection = useCallback(async (keyId: string) => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await post('ssh-keys/test', {keyId});
      setTestResult(result);
    } catch (e: unknown) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : 'Connection test failed',
      });
    }

    setIsTesting(false);
  }, []);

  const handleSetActiveKey = useCallback(async (keyId: string) => {
    setError(null);

    try {
      const currentSettings = await get('settings');
      await put('settings', {
        ...currentSettings,
        activeSSHKeyId: keyId,
      });
      await loadKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to set active key');
    }
  }, [loadKeys]);

  if (isLoading) {
    return <CenteredSpinner />;
  }

  const hasKeys = keysData && keysData.keys.length > 0;

  return (
    <div className="SSHKeySettingsPage">
      <div className="SSHKeySettingsPage__section">
        <h3 className="SSHKeySettingsPage__title">SSH Key for Git Clone</h3>
        <p className="SSHKeySettingsPage__description">
          Configure an SSH key to enable cloning repositories for lines-of-code statistics.
          The key will be used to clone repos via SSH and run git log to count additions/deletions.
        </p>

        {error && (
          <div className="SSHKeySettingsPage__error">{error}</div>
        )}

        {testResult && (
          <div className={`SSHKeySettingsPage__testResult SSHKeySettingsPage__testResult--${testResult.success ? 'success' : 'error'}`}>
            {testResult.message}
          </div>
        )}

        {hasKeys && (
          <div className="SSHKeySettingsPage__keyList">
            <h4>Configured Keys</h4>
            {keysData.keys.map((key) => (
              <div
                key={key.id}
                className={`SSHKeySettingsPage__keyItem ${key.id === keysData.activeKeyId ? 'SSHKeySettingsPage__keyItem--active' : ''}`}
              >
                <div className="SSHKeySettingsPage__keyInfo">
                  <div className="SSHKeySettingsPage__keyName">
                    {key.name}
                    {key.id === keysData.activeKeyId && (
                      <span className="SSHKeySettingsPage__activeBadge">Active</span>
                    )}
                  </div>
                  <div className="SSHKeySettingsPage__keyFingerprint">
                    {key.fingerprint}
                  </div>
                  <div className="SSHKeySettingsPage__keyDate">
                    Added: {new Date(key.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="SSHKeySettingsPage__keyActions">
                  {key.id !== keysData.activeKeyId && (
                    <button
                      type="button"
                      className="SSHKeySettingsPage__button SSHKeySettingsPage__button--secondary"
                      onClick={() => handleSetActiveKey(key.id)}
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    type="button"
                    className="SSHKeySettingsPage__button SSHKeySettingsPage__button--secondary"
                    onClick={() => handleTestConnection(key.id)}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    type="button"
                    className="SSHKeySettingsPage__button SSHKeySettingsPage__button--danger"
                    onClick={() => handleDeleteKey(key.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="SSHKeySettingsPage__form">
          <h4>Add New SSH Key</h4>
          <div className="SSHKeySettingsPage__field">
            <label htmlFor="keyName">Key Name</label>
            <input
              id="keyName"
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Work Laptop"
              className="SSHKeySettingsPage__input"
            />
          </div>
          <div className="SSHKeySettingsPage__field">
            <label htmlFor="privateKey">Private Key</label>
            <textarea
              id="privateKey"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              className="SSHKeySettingsPage__textarea"
              rows={8}
            />
          </div>
          <button
            type="button"
            className="SSHKeySettingsPage__button SSHKeySettingsPage__button--primary"
            onClick={handleSaveKey}
            disabled={isSaving || !keyName.trim() || !privateKey.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
};
SSHKeySettingsPage.displayName = 'SSHKeySettingsPage';

export default SSHKeySettingsPage;
