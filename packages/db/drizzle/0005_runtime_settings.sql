ALTER TABLE `settings` ADD `runtime_mode` text NOT NULL DEFAULT 'mock';
--> statement-breakpoint
ALTER TABLE `settings` ADD `openclaw_config_path` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD `openclaw_state_dir` text NOT NULL DEFAULT '';
