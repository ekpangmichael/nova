ALTER TABLE `agents` ADD `runtime_state_path` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `agents` ADD `default_thinking_level` text NOT NULL DEFAULT 'medium';
--> statement-breakpoint
UPDATE `agents`
SET `runtime_state_path` = `agent_home_path` || '/.runtime-state'
WHERE `runtime_state_path` = '';
--> statement-breakpoint
DROP INDEX `agents_runtime_agent_id_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_runtime_runtime_agent_id_unique` ON `agents` (`runtime_kind`,`runtime_agent_id`);
