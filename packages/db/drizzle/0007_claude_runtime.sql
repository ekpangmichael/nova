ALTER TABLE `settings` ADD `claude_binary_path` text NOT NULL DEFAULT 'claude';
--> statement-breakpoint
ALTER TABLE `settings` ADD `claude_config_path` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD `claude_state_dir` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD `claude_default_model` text;
