ALTER TABLE tasks ADD use_git_worktree integer NOT NULL DEFAULT 0;
UPDATE tasks
SET use_git_worktree = 1
WHERE git_worktree_path IS NOT NULL
  AND trim(coalesce(git_worktree_path, '')) <> '';
