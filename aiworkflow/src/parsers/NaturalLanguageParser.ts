import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';

export interface IWorkflowStep {
    trigger: {
        type: 'message' | 'mention';
        pattern: string;
        user?: string;
        room?: string;
    };
    action: {
        type: 'message' | 'dm';
        content: string;
        target?: string;
    };
}

export class NaturalLanguageParser {
    private static readonly TRIGGER_PATTERNS = {
        WHEN_USER_SAYS: /when\s+(?:@?(\w+)\s+)?(?:says|posts?)\s+(?:"([^"]+)"|'([^']+)')\s*(?:in\s+#?(\w+))?/i,
        WHEN_SAYS_IN: /when\s+(?:someone|anybody|anyone)\s+(?:says|posts?)\s+(?:"([^"]+)"|'([^']+)')\s+in\s+#?(\w+)/i,
        WHEN_MENTIONED: /when\s+(?:@?(\w+)\s+)?(?:in\s+#?(\w+)\s+)?(?:is\s+)?mentioned/i
    };

    private static readonly ACTION_PATTERNS = {
        SEND_MESSAGE: /(?:send|reply with)\s+(?:"([^"]+)"|'([^']+)')\s+(?:to|in)\s+(?:the\s+)?(?:channel|#?(\w+))/i,
        SEND_DM: /(?:send|reply with)\s+(?:direct message|dm)\s+(?:"([^"]+)"|'([^']+)')\s+to\s+@?(\w+)/i,
        NOTIFY: /notify\s+@?(\w+)/i
    };

    public parseCommand(command: string): IWorkflowStep[] {
        // First, normalize the command by replacing smart quotes and handling emojis
        command = command
            .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
            .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
            .replace(/\\"/g, '"') // Handle escaped quotes
            .replace(/\\'/g, "'"); // Handle escaped single quotes

        const steps: IWorkflowStep[] = [];
        const parts = command.split(/\s*(?:then|and)\s+/i);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Try to parse as trigger if it's the first part
            if (i === 0) {
                const trigger = this.parseTrigger(part);
                const action = this.parseAction(parts[i + 1] || '');
                
                if (trigger && action) {
                    steps.push({ trigger, action });
                    i++; // Skip the next part as we've used it for action
                }
            } else {
                // Try to parse as action
                const action = this.parseAction(part);
                if (action && steps.length > 0) {
                    // Add action to the last step
                    steps[steps.length - 1].action = action;
                }
            }
        }

        return steps;
    }

    private parseTrigger(triggerText: string): IWorkflowStep['trigger'] | null {
        // Try "when someone says X in #channel" pattern
        let match = triggerText.match(NaturalLanguageParser.TRIGGER_PATTERNS.WHEN_SAYS_IN);
        if (match) {
            const [, content1, content2, room] = match;
            return {
                type: 'message',
                pattern: content1 || content2 || '',
                room: room
            };
        }

        // Try "when X says Y" pattern
        match = triggerText.match(NaturalLanguageParser.TRIGGER_PATTERNS.WHEN_USER_SAYS);
        if (match) {
            const [, user, content1, content2, room] = match;
            return {
                type: 'message',
                pattern: content1 || content2 || '',
                ...(user && { user }),
                ...(room && { room })
            };
        }

        // Try "when X is mentioned" pattern
        match = triggerText.match(NaturalLanguageParser.TRIGGER_PATTERNS.WHEN_MENTIONED);
        if (match) {
            const [, user, room] = match;
            return {
                type: 'mention',
                pattern: '',
                ...(user && { user }),
                ...(room && { room })
            };
        }

        return null;
    }

    private parseAction(actionText: string): IWorkflowStep['action'] | null {
        // Try "send X to channel" pattern
        let match = actionText.match(NaturalLanguageParser.ACTION_PATTERNS.SEND_MESSAGE);
        if (match) {
            const [, content1, content2, target] = match;
            return {
                type: 'message',
                content: content1 || content2 || '',
                target: target || 'channel'
            };
        }

        // Try "send DM X to Y" pattern
        match = actionText.match(NaturalLanguageParser.ACTION_PATTERNS.SEND_DM);
        if (match) {
            const [, content1, content2, target] = match;
            return {
                type: 'dm',
                content: content1 || content2 || '',
                target: target
            };
        }

        // Try "notify X" pattern
        match = actionText.match(NaturalLanguageParser.ACTION_PATTERNS.NOTIFY);
        if (match) {
            const [, target] = match;
            return {
                type: 'dm',
                content: 'You have been notified',
                target: target
            };
        }

        return null;
    }

    public static getExampleCommands(): string[] {
        return [
            'when someone says "hello" in #general send "Hello there! 👋" to the channel',
            'when @john says "help" then send "Help is on the way!" to #support',
            'when someone says "urgent" in #support notify @team-lead',
            'when @alice is mentioned then send "Alice will get back to you soon" to the channel',
            'when someone says "deploy" in #dev send "Starting deployment..." to #announcements'
        ];
    }
} 