CREATE TABLE `task_comment_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `task_id` text NOT NULL,
  `task_comment_id` text NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text NOT NULL,
  `relative_storage_path` text NOT NULL,
  `sha256` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`task_comment_id`) REFERENCES `task_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_comment_attachments_comment_created_idx`
ON `task_comment_attachments` (`task_comment_id`,`created_at`);
