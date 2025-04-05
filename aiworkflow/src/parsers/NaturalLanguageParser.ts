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
        WHEN_USER_SAYS: /when\s+(?:@?(\w+)\s+)?(?:in\s+#?(\w+)\s+)?says?\s+"([^"]+)"/i,
        WHEN_MENTIONED: /when\s+(?:@?(\w+)\s+)?(?:in\s+#?(\w+)\s+)?(?:is\s+)?mentioned/i
    };

    private static readonly ACTION_PATTERNS = {
        SEND_MESSAGE: /(?:send|reply with)\s+(?:message\s+)?"([^"]+)"(?:\s+(?:to|in)\s+(?:@?#?(\w+)))?/i,
        SEND_DM: /(?:send|reply with)\s+(?:direct message|dm)\s+"([^"]+)"\s+to\s+@?(\w+)/i
    };

    public parseCommand(command: string): IWorkflowStep[] {
        const steps: IWorkflowStep[] = [];
        const parts = command.split(/\s*(?:then|and)\s+/i);

        for (let i = 0; i < parts.length - 1; i += 2) {
            const triggerPart = parts[i];
            const actionPart = parts[i + 1];

            if (!triggerPart || !actionPart) {
                continue;
            }

            const trigger = this.parseTrigger(triggerPart);
            const action = this.parseAction(actionPart);

            if (trigger && action) {
                steps.push({ trigger, action });
            }
        }

        return steps;
    }

    private parseTrigger(triggerText: string): IWorkflowStep['trigger'] | null {
        // Try to match "when X says Y" pattern
        let match = triggerText.match(NaturalLanguageParser.TRIGGER_PATTERNS.WHEN_USER_SAYS);
        if (match) {
            const [, user, room, pattern] = match;
            return {
                type: 'message',
                pattern,
                ...(user && { user }),
                ...(room && { room })
            };
        }

        // Try to match "when X is mentioned" pattern
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
        // Try to match "send message X to Y" pattern
        let match = actionText.match(NaturalLanguageParser.ACTION_PATTERNS.SEND_MESSAGE);
        if (match) {
            const [, content, target] = match;
            return {
                type: 'message',
                content,
                ...(target && { target })
            };
        }

        // Try to match "send DM X to Y" pattern
        match = actionText.match(NaturalLanguageParser.ACTION_PATTERNS.SEND_DM);
        if (match) {
            const [, content, target] = match;
            return {
                type: 'dm',
                content,
                target
            };
        }

        return null;
    }

    public static getExampleCommands(): string[] {
        return [
            'when @john says "hello" then send message "Hi John!" to #general',
            'when someone in #support says "help" then send dm "New support request" to @support-lead',
            'when @alice is mentioned then send message "Alice will get back to you soon"',
            'when someone says "deploy" in #dev then send message "Starting deployment..." and then send dm "New deployment requested" to @devops'
        ];
    }
} 