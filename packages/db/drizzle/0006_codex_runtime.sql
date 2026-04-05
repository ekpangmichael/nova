ALTER TABLE `settings` ADD `codex_binary_path` text NOT NULL DEFAULT 'codex';
--> statement-breakpoint
ALTER TABLE `settings` ADD `codex_config_path` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD `codex_state_dir` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `settings` ADD `codex_default_model` text;
