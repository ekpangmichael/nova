ALTER TABLE `task_comments` ADD `task_run_id` text;
--> statement-breakpoint
ALTER TABLE `task_comments` ADD `source` text NOT NULL DEFAULT 'ticket_user';
--> statement-breakpoint
ALTER TABLE `task_comments` ADD `external_message_id` text;
--> statement-breakpoint
UPDATE `task_comments`
SET `source` = CASE
  WHEN `author_type` = 'agent' THEN 'agent_mirror'
  WHEN `author_type` = 'system' THEN 'system'
  ELSE 'ticket_user'
END;
--> statement-breakpoint
CREATE INDEX `task_comments_task_created_idx` ON `task_comments` (`task_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_comments_run_source_external_unique` ON `task_comments` (`task_run_id`,`source`,`external_message_id`);
--> statement-breakpoint
ALTER TABLE `run_artifacts` ADD `label` text;
--> statement-breakpoint
ALTER TABLE `run_artifacts` ADD `summary` text;
