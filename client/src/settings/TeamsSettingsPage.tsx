import './TeamsSettingsPage.css';

import React, {useCallback, useEffect, useState} from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

import {get, post, put, del} from 'repos/requests';
import {TeamInfo, UserInfo} from 'types/types';
import CenteredSpinner from 'components/CenteredSpinner';

const TeamsSettingsPage: React.FC = () => {
  const [customTeams, setCustomTeams] = useState<TeamInfo[]>([]);
  const [allUsers, setAllUsers] = useState<ReadonlyArray<UserInfo>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [newMemberSearch, setNewMemberSearch] = useState('');

  // Edit state
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMembers, setEditMembers] = useState<string[]>([]);
  const [editMemberSearch, setEditMemberSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [teams, users] = await Promise.all([get('custom-teams'), get('users')]);
      setCustomTeams(teams);
      setAllUsers(users);
    } catch {
      setError('Failed to load data');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = useCallback(() => {
    setNewName('');
    setNewMembers([]);
    setNewMemberSearch('');
    setError(null);
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setError(null);
    try {
      const created = await post('custom-teams', {name: trimmed, memberLogins: newMembers});
      setCustomTeams((prev) => [...prev, created]);
      setIsCreateOpen(false);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'error' in e ? (e as {error: string}).error : 'Failed to create team';
      setError(msg);
    }
  }, [newName, newMembers]);

  const handleStartEdit = useCallback(
    (team: TeamInfo) => {
      setEditingSlug(team.slug);
      setEditName(team.name);
      setEditMembers([...team.memberLogins]);
      setEditMemberSearch('');
      setError(null);
    },
    []
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSlug(null);
    setEditName('');
    setEditMembers([]);
    setEditMemberSearch('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingSlug || !editName.trim()) return;

    setError(null);
    try {
      const updated: TeamInfo = await put(`custom-teams/${editingSlug}` as any, {
        name: editName.trim(),
        memberLogins: editMembers,
      } as any);
      setCustomTeams((prev) => prev.map((t) => (t.slug === editingSlug ? updated : t)));
      setEditingSlug(null);
      setEditName('');
      setEditMembers([]);
      setEditMemberSearch('');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'error' in e ? (e as {error: string}).error : 'Failed to update team';
      setError(msg);
    }
  }, [editingSlug, editName, editMembers]);

  const handleDelete = useCallback(
    async (slug: string) => {
      if (!window.confirm('Are you sure you want to delete this team?')) return;

      setError(null);
      try {
        await del(`custom-teams/${slug}`);
        setCustomTeams((prev) => prev.filter((t) => t.slug !== slug));
        if (editingSlug === slug) {
          handleCancelEdit();
        }
      } catch {
        setError('Failed to delete team');
      }
    },
    [editingSlug, handleCancelEdit]
  );

  const toggleMember = useCallback(
    (login: string, members: string[], setMembers: (m: string[]) => void) => {
      if (members.includes(login)) {
        setMembers(members.filter((m) => m !== login));
      } else {
        setMembers([...members, login]);
      }
    },
    []
  );

  const filterUsers = useCallback(
    (search: string) => {
      if (!search.trim()) return allUsers;
      const lower = search.toLowerCase();
      return allUsers.filter(
        (u) =>
          u.displayName.toLowerCase().includes(lower) || u.id.toLowerCase().includes(lower)
      );
    },
    [allUsers]
  );

  if (isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="TeamsSettingsPage">
      <p className="TeamsSettingsPage__description">
        Create custom teams to group users for analysis. Custom teams appear alongside
        GitHub teams in all analysis views.
      </p>

      {error && <div className="TeamsSettingsPage__error">{error}</div>}

      {customTeams.length > 0 && (
        <div className="TeamsSettingsPage__list">
          {customTeams.map((team) => (
            <div key={team.slug} className="TeamsSettingsPage__team">
              <div className="TeamsSettingsPage__team-header">
                <div>
                  <div className="TeamsSettingsPage__team-name">{team.name}</div>
                  <div className="TeamsSettingsPage__team-members">
                    {team.memberLogins.length === 0
                      ? 'No members'
                      : `${team.memberLogins.length} member${team.memberLogins.length !== 1 ? 's' : ''}: ${team.memberLogins.join(', ')}`}
                  </div>
                </div>
                <div className="TeamsSettingsPage__team-actions">
                  {editingSlug !== team.slug && (
                    <>
                      <button
                        type="button"
                        className="TeamsSettingsPage__button TeamsSettingsPage__button--secondary"
                        onClick={() => handleStartEdit(team)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="TeamsSettingsPage__button TeamsSettingsPage__button--danger"
                        onClick={() => handleDelete(team.slug)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingSlug === team.slug && (
                <div className="TeamsSettingsPage__edit-form">
                  <div className="TeamsSettingsPage__field">
                    <label>Team Name</label>
                    <input
                      type="text"
                      className="TeamsSettingsPage__input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="TeamsSettingsPage__field">
                    <label>
                      Members ({editMembers.length} selected)
                    </label>
                    <input
                      type="text"
                      className="TeamsSettingsPage__member-search"
                      placeholder="Filter users..."
                      value={editMemberSearch}
                      onChange={(e) => setEditMemberSearch(e.target.value)}
                    />
                    <div className="TeamsSettingsPage__members-list">
                      {filterUsers(editMemberSearch).map((user) => (
                        <label key={user.id} className="TeamsSettingsPage__member-item">
                          <input
                            type="checkbox"
                            checked={editMembers.includes(user.id)}
                            onChange={() => toggleMember(user.id, editMembers, setEditMembers)}
                          />
                          <span>{user.displayName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="TeamsSettingsPage__form-actions">
                    <button
                      type="button"
                      className="TeamsSettingsPage__button TeamsSettingsPage__button--primary"
                      onClick={handleSaveEdit}
                      disabled={!editName.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="TeamsSettingsPage__button TeamsSettingsPage__button--secondary"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {customTeams.length === 0 && (
        <p className="TeamsSettingsPage__empty">No custom teams yet.</p>
      )}

      <button
        type="button"
        className="TeamsSettingsPage__button TeamsSettingsPage__button--primary"
        onClick={handleOpenCreate}
      >
        Create Team
      </button>

      <Modal show={isCreateOpen} onHide={handleCloseCreate}>
        <Modal.Header closeButton>
          <Modal.Title>Create Custom Team</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <div className="TeamsSettingsPage__error">{error}</div>}
          <div className="TeamsSettingsPage__field">
            <label>Team Name</label>
            <input
              type="text"
              className="TeamsSettingsPage__input"
              placeholder="e.g., Frontend"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="TeamsSettingsPage__field">
            <label>
              Members ({newMembers.length} selected)
            </label>
            <input
              type="text"
              className="TeamsSettingsPage__member-search"
              placeholder="Filter users..."
              value={newMemberSearch}
              onChange={(e) => setNewMemberSearch(e.target.value)}
            />
            <div className="TeamsSettingsPage__members-list">
              {filterUsers(newMemberSearch).map((user) => (
                <label key={user.id} className="TeamsSettingsPage__member-item">
                  <input
                    type="checkbox"
                    checked={newMembers.includes(user.id)}
                    onChange={() => toggleMember(user.id, newMembers, setNewMembers)}
                  />
                  <span>{user.displayName}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCreate}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>
            Create Team
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
TeamsSettingsPage.displayName = 'TeamsSettingsPage';

export default TeamsSettingsPage;
