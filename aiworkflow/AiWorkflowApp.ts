import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { ActionExecutor } from './src/actions/ActionExecutor';
import { WorkflowCommand } from './src/commands/WorkflowCommand';
import { IWorkflow, IWorkflowTrigger, WorkflowTriggerType } from './src/models/Workflow';
import { WorkflowStorage } from './src/storage/WorkflowStorage';

export class AiWorkflowApp extends App implements IPostMessageSent {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    /**
     * Initialize the app
     */
    public async initialize(
        configurationExtend: IConfigurationExtend,
        environmentRead: IEnvironmentRead,
    ): Promise<void> {
        await this.extendConfiguration(configurationExtend);
        this.getLogger().debug('AI Workflow App initialized');
    }

    /**
     * Extend app configuration
     */
    protected async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        // Register the workflow slash command
        const workflowCommand = new WorkflowCommand(this);
        await configuration.slashCommands.provideSlashCommand(workflowCommand);
    }

    /**
     * Handle when a message is sent
     */
    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<void> {
        // Skip messages from the app itself to prevent loops
        const appUser = await read.getUserReader().getAppUser();
        if (!appUser || message.sender.id === appUser.id) {
            return;
        }

        const sender = message.sender;
        const room = message.room;
        const text = message.text || '';

        // Get all workflows
        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        const workflows = await workflowStorage.getAll();

        // Find workflows that match this message
        const matchingWorkflows = this.findMatchingWorkflows(workflows, message, sender, room);
        
        if (matchingWorkflows.length === 0) {
            return;
        }

        // Execute actions for matching workflows
        const actionExecutor = new ActionExecutor(read, modify, http, persistence);
        
        for (const workflow of matchingWorkflows) {
            try {
                await actionExecutor.executeActions(workflow.actions, message, sender, room);
            } catch (error) {
                this.getLogger().error(`Error executing workflow ${workflow.id}: ${error}`);
            }
        }
    }

    private findMatchingWorkflows(workflows: Array<IWorkflow>, message: IMessage, sender: IUser, room: IRoom): Array<IWorkflow> {
        const matchingWorkflows: Array<IWorkflow> = [];
        const text = message.text || '';

        for (const workflow of workflows) {
            if (!workflow.enabled) {
                continue;
            }

            if (workflow.trigger.type !== WorkflowTriggerType.Message) {
                continue;
            }

            if (this.matchesTrigger(workflow.trigger, message, sender, room)) {
                matchingWorkflows.push(workflow);
            }
        }

        return matchingWorkflows;
    }

    private matchesTrigger(trigger: IWorkflowTrigger, message: IMessage, sender: IUser, room: IRoom): boolean {
        const text = message.text || '';
        let hasAnyCondition = false;

        // Check room if specified
        if (trigger.room) {
            hasAnyCondition = true;
            const roomName = room.slugifiedName || room.displayName || '';
            const triggerRoom = trigger.room.startsWith('#') ? trigger.room.substring(1) : trigger.room;
            
            if (room.id !== triggerRoom && roomName !== triggerRoom) {
                return false;
            }
        }

        // Check user if specified
        if (trigger.user) {
            hasAnyCondition = true;
            const username = sender.username;
            const triggerUser = trigger.user.startsWith('@') ? trigger.user.substring(1) : trigger.user;
            
            if (sender.id !== triggerUser && username !== triggerUser) {
                return false;
            }
        }

        // Check message content conditions
        if (trigger.contains) {
            hasAnyCondition = true;
            if (!text.toLowerCase().includes(trigger.contains.toLowerCase())) {
                return false;
            }
        }

        if (trigger.startsWith) {
            hasAnyCondition = true;
            if (!text.toLowerCase().startsWith(trigger.startsWith.toLowerCase())) {
                return false;
            }
        }

        if (trigger.regex) {
            hasAnyCondition = true;
            try {
                const regex = new RegExp(trigger.regex, 'i');
                if (!regex.test(text)) {
                    return false;
                }
            } catch (error) {
                this.getLogger().error(`Invalid regex in workflow trigger: ${trigger.regex}`);
                return false;
            }
        }

        // If no conditions were specified, don't match
        if (!hasAnyCondition) {
            return false;
        }

        return true;
    }
}
