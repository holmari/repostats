// The following URL has been used as a reference for some of the content here:
// https://github.com/octokit/openapi-types.ts/blob/main/generated/types.ts
// The above repo (@octokit/openapi-types) is not used as a dependency because it
// does not provide immutability.
//
// Other types are hand-written, based on the API.
//

export interface User {
  readonly login: string;
  readonly id: number;
  readonly node_id: string;
  readonly avatar_url: string;
  readonly gravatar_id: string | null;
  readonly url: string;
  readonly html_url: string;
  readonly followers_url: string;
  readonly following_url: string;
  readonly gists_url: string;
  readonly starred_url: string;
  readonly subscriptions_url: string;
  readonly organizations_url: string;
  readonly repos_url: string;
  readonly events_url: string;
  readonly received_events_url: string;
  readonly type: string;
  readonly site_admin: boolean;
  readonly starred_at?: string;
}

export interface Label {
  readonly id?: number;
  readonly node_id?: string;
  readonly url?: string;
  readonly name?: string;
  readonly description?: string;
  readonly color?: string;
  readonly default?: boolean;
}

export interface Milestone {
  readonly url: string;
  readonly html_url: string;
  readonly labels_url: string;
  readonly id: number;
  readonly node_id: string;
  readonly number: number;
  readonly state: 'open' | 'closed';
  readonly title: string;
  readonly description: string | null;
  readonly creator: User | null;
  readonly open_issues: number;
  readonly closed_issues: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
  readonly due_on: string | null;
}

export interface Team {
  readonly id: number;
  readonly node_id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly privacy?: string;
  readonly permission: string;
  readonly url: string;
  readonly html_url: string;
  readonly members_url: string;
  readonly repositories_url: string;
  readonly parent?: Team | null;
}

export interface License {
  readonly key: string;
  readonly name: string;
  readonly url: string | null;
  readonly spdx_id: string | null;
  readonly node_id: string;
  readonly html_url?: string;
}

export interface Link {
  readonly href: string;
}

export interface Repository {
  readonly id: number;
  readonly node_id: string;
  readonly name: string;
  readonly full_name: string;
  readonly license: License | null;
  readonly forks: number;
  readonly permissions?: {
    readonly admin: boolean;
    readonly pull: boolean;
    readonly triage?: boolean;
    readonly push: boolean;
    readonly maintain?: boolean;
  };
  readonly owner: User | null;
  /**
   * Whether the repository is private or public.
   */
  readonly private: boolean;
  readonly html_url: string;
  readonly description: string | null;
  readonly fork: boolean;
  readonly url: string;
  readonly archive_url: string;
  readonly assignees_url: string;
  readonly blobs_url: string;
  readonly branches_url: string;
  readonly collaborators_url: string;
  readonly comments_url: string;
  readonly commits_url: string;
  readonly compare_url: string;
  readonly contents_url: string;
  readonly contributors_url: string;
  readonly deployments_url: string;
  readonly downloads_url: string;
  readonly events_url: string;
  readonly forks_url: string;
  readonly git_commits_url: string;
  readonly git_refs_url: string;
  readonly git_tags_url: string;
  readonly git_url: string;
  readonly issue_comment_url: string;
  readonly issue_events_url: string;
  readonly issues_url: string;
  readonly keys_url: string;
  readonly labels_url: string;
  readonly languages_url: string;
  readonly merges_url: string;
  readonly milestones_url: string;
  readonly notifications_url: string;
  readonly pulls_url: string;
  readonly releases_url: string;
  readonly ssh_url: string;
  readonly stargazers_url: string;
  readonly statuses_url: string;
  readonly subscribers_url: string;
  readonly subscription_url: string;
  readonly tags_url: string;
  readonly teams_url: string;
  readonly trees_url: string;
  readonly clone_url: string;
  readonly mirror_url: string | null;
  readonly hooks_url: string;
  readonly svn_url: string;
  readonly homepage: string | null;
  readonly language: string | null;
  readonly forks_count: number;
  readonly stargazers_count: number;
  readonly watchers_count: number;
  readonly size: number;
  readonly default_branch: string;
  readonly open_issues_count: number;
  readonly is_template?: boolean;
  readonly topics?: string[];
  readonly has_issues: boolean;
  readonly has_projects: boolean;
  readonly has_wiki: boolean;
  readonly has_pages: boolean;
  readonly has_downloads: boolean;
  readonly archived: boolean;
  readonly disabled: boolean;
  readonly visibility?: string;
  readonly pushed_at: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly allow_rebase_merge?: boolean;
  readonly template_repository?: {
    readonly id?: number;
    readonly node_id?: string;
    readonly name?: string;
    readonly full_name?: string;
    readonly owner?: {
      readonly login?: string;
      readonly id?: number;
      readonly node_id?: string;
      readonly avatar_url?: string;
      readonly gravatar_id?: string;
      readonly url?: string;
      readonly html_url?: string;
      readonly followers_url?: string;
      readonly following_url?: string;
      readonly gists_url?: string;
      readonly starred_url?: string;
      readonly subscriptions_url?: string;
      readonly organizations_url?: string;
      readonly repos_url?: string;
      readonly events_url?: string;
      readonly received_events_url?: string;
      readonly type?: string;
      readonly site_admin?: boolean;
    };
    readonly private?: boolean;
    readonly html_url?: string;
    readonly description?: string;
    readonly fork?: boolean;
    readonly url?: string;
    readonly archive_url?: string;
    readonly assignees_url?: string;
    readonly blobs_url?: string;
    readonly branches_url?: string;
    readonly collaborators_url?: string;
    readonly comments_url?: string;
    readonly commits_url?: string;
    readonly compare_url?: string;
    readonly contents_url?: string;
    readonly contributors_url?: string;
    readonly deployments_url?: string;
    readonly downloads_url?: string;
    readonly events_url?: string;
    readonly forks_url?: string;
    readonly git_commits_url?: string;
    readonly git_refs_url?: string;
    readonly git_tags_url?: string;
    readonly git_url?: string;
    readonly issue_comment_url?: string;
    readonly issue_events_url?: string;
    readonly issues_url?: string;
    readonly keys_url?: string;
    readonly labels_url?: string;
    readonly languages_url?: string;
    readonly merges_url?: string;
    readonly milestones_url?: string;
    readonly notifications_url?: string;
    readonly pulls_url?: string;
    readonly releases_url?: string;
    readonly ssh_url?: string;
    readonly stargazers_url?: string;
    readonly statuses_url?: string;
    readonly subscribers_url?: string;
    readonly subscription_url?: string;
    readonly tags_url?: string;
    readonly teams_url?: string;
    readonly trees_url?: string;
    readonly clone_url?: string;
    readonly mirror_url?: string;
    readonly hooks_url?: string;
    readonly svn_url?: string;
    readonly homepage?: string;
    readonly language?: string;
    readonly forks_count?: number;
    readonly stargazers_count?: number;
    readonly watchers_count?: number;
    readonly size?: number;
    readonly default_branch?: string;
    readonly open_issues_count?: number;
    readonly is_template?: boolean;
    readonly topics?: string[];
    readonly has_issues?: boolean;
    readonly has_projects?: boolean;
    readonly has_wiki?: boolean;
    readonly has_pages?: boolean;
    readonly has_downloads?: boolean;
    readonly archived?: boolean;
    readonly disabled?: boolean;
    readonly visibility?: string;
    readonly pushed_at?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly permissions?: {admin?: boolean; push?: boolean; pull?: boolean};
    readonly allow_rebase_merge?: boolean;
    readonly template_repository?: string;
    readonly temp_clone_token?: string;
    readonly allow_squash_merge?: boolean;
    readonly delete_branch_on_merge?: boolean;
    readonly allow_merge_commit?: boolean;
    readonly subscribers_count?: number;
    readonly network_count?: number;
  } | null;
  readonly temp_clone_token?: string;
  readonly allow_squash_merge?: boolean;
  readonly delete_branch_on_merge?: boolean;
  readonly allow_merge_commit?: boolean;
  readonly subscribers_count?: number;
  readonly network_count?: number;
  readonly open_issues: number;
  readonly watchers: number;
  readonly master_branch?: string;
  readonly starred_at?: string;
}

export interface PullRequest {
  readonly url: string;
  readonly id: number;
  readonly node_id: string;
  readonly html_url: string;
  readonly diff_url: string;
  readonly patch_url: string;
  readonly issue_url: string;
  readonly commits_url: string;
  readonly review_comments_url: string;
  readonly review_comment_url: string;
  readonly comments_url: string;
  readonly statuses_url: string;
  readonly number: number;
  readonly state: string;
  readonly locked: boolean;
  readonly title: string;
  readonly user: User | null;
  readonly body: string | null;
  readonly labels: ReadonlyArray<Label>;
  readonly milestone: Milestone | null;
  readonly active_lock_reason?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
  readonly merged_at: string | null;
  readonly merge_commit_sha: string | null;
  readonly assignee: User | null;
  readonly assignees?: ReadonlyArray<User> | null;
  readonly requested_reviewers?: ReadonlyArray<User> | null;
  readonly requested_teams?: ReadonlyArray<Team> | null;
  readonly head: {
    readonly label: string;
    readonly ref: string;
    readonly repo: Repository;
    readonly sha: string;
    readonly user: User | null;
  };
  readonly base: {
    readonly label: string;
    readonly ref: string;
    readonly repo: Repository;
    readonly sha: string;
    readonly user: User | null;
  };
  readonly _links: {
    readonly comments: Link;
    readonly commits: Link;
    readonly statuses: Link;
    readonly html: Link;
    readonly issue: Link;
    readonly review_comments: Link;
    readonly review_comment: Link;
    readonly self: Link;
  };
  readonly author_association: string;
  readonly draft?: boolean;
}

export interface Comment {
  readonly url: string;
  readonly pull_request_review_id: unknown | null;
  readonly id: number;
  readonly node_id: string;
  readonly diff_hunk: string;
  readonly path: string;
  readonly position: unknown | null;
  readonly original_position: number;
  readonly commit_id: string;
  readonly original_commit_id: string;
  readonly user: User | null;
  readonly body: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly html_url: string;
  readonly pull_request_url: string;
  readonly author_association: 'NONE' | 'OWNER';
  readonly _links: {
    readonly self: Link;
    readonly html: Link;
    readonly pull_request: Link;
  };
  readonly start_line: unknown | null;
  readonly original_start_line: unknown | null;
  readonly start_side: unknown | null;
  readonly line: number | null;
  readonly original_line: number | null;
  readonly side: 'LEFT' | 'RIGHT' | unknown;
  readonly in_reply_to_id?: number;
}

export interface Review {
  readonly id: number;
  readonly node_id: string;
  readonly user: User;
  readonly body: string;
  readonly state: 'APPROVED' | 'COMMENTED' | 'CHANGES_REQUESTED' | 'DISMISSED';
  readonly html_url: string;
  readonly pull_request_url: string;
  readonly _links: {
    readonly html: Link;
    readonly pull_request: Link;
  };
  readonly submitted_at: string;
  readonly commit_id: string;
  readonly author_association: 'OWNER' | 'CONTRIBUTOR';
}

export interface Commit {
  readonly url: string;
  readonly sha: string;
  readonly node_id: string;
  readonly html_url: string;
  readonly comments_url: string;
  readonly commit: {
    readonly url: string;
    readonly author: {
      readonly name: string;
      readonly email: string;
      readonly date: string;
    };
    readonly committer: {
      readonly name: string;
      readonly email: string;
      readonly date: string;
    };
    readonly message: string;
    readonly tree: {
      readonly url: string;
      readonly sha: string;
    };
    readonly comment_count: number;
    readonly verification: {
      readonly verified: boolean;
      readonly reason: string;
      readonly signature: unknown | null;
      readonly payload: unknown | null;
    };
  } | null;
  readonly author: User | null;
  readonly committer: User | null;
  readonly parents: ReadonlyArray<{
    readonly url: string;
    readonly sha: string;
  }>;
}

export interface RateLimit {
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
  readonly reset: number;
}
