/**
 * Prompt Section Builder Interface
 * Strategy Pattern for generating different sections of the system prompt
 */
export class BasePromptSectionBuilder {
    config;
    constructor(config = { enabled: true, priority: 5 }) {
        this.config = config;
    }
    getPriority() {
        return this.config.priority;
    }
    isRequired() {
        return this.config.enabled;
    }
    /**
     * 長さ制限の適用
     */
    truncateIfNeeded(content) {
        if (this.config.maxLength && content.length > this.config.maxLength) {
            return content.substring(0, this.config.maxLength) + '\n... (truncated)';
        }
        return content;
    }
}
