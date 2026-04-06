ALTER TABLE `tasks` ADD COLUMN `handoff_agent_id` text REFERENCES `agents`(`id`) ON DELETE set null;
