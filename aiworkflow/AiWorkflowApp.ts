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
        if (message.sender.username === 'ai.workflow.bot') {
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
                console.log(`Executing workflow ${workflow.id} for message: ${text}`);
                await actionExecutor.executeActions(workflow.actions, message, sender, room);
            } catch (error) {
                console.error(`Error executing workflow ${workflow.id}: ${error}`);
            }
        }
    }

    private findMatchingWorkflows(workflows: Array<IWorkflow>, message: IMessage, sender: IUser, room: IRoom): Array<IWorkflow> {
        const matchingWorkflows: Array<IWorkflow> = [];
        const text = message.text || '';

        for (const workflow of workflows) {
            if (!workflow.enabled) {
                console.log(`Workflow ${workflow.id} is disabled`);
                continue;
            }

            if (workflow.trigger.type !== WorkflowTriggerType.Message) {
                console.log(`Workflow ${workflow.id} is not a message trigger`);
                continue;
            }

            if (this.matchesTrigger(workflow.trigger, message, sender, room)) {
                console.log(`Workflow ${workflow.id} matches trigger`);
                matchingWorkflows.push(workflow);
            }
        }

        return matchingWorkflows;
    }

    private matchesTrigger(trigger: IWorkflowTrigger, message: IMessage, sender: IUser, room: IRoom): boolean {
        const text = message.text || '';

        // Check room if specified
        if (trigger.room) {
            const roomName = room.slugifiedName || room.displayName || '';
            const triggerRoom = trigger.room.startsWith('#') ? trigger.room.substring(1) : trigger.room;
            
            if (room.id !== triggerRoom && roomName !== triggerRoom) {
                console.log(`Room mismatch: ${roomName} != ${triggerRoom}`);
                return false;
            }
        }

        // Check user if specified
        if (trigger.user) {
            const username = sender.username;
            const triggerUser = trigger.user.startsWith('@') ? trigger.user.substring(1) : trigger.user;
            
            if (sender.id !== triggerUser && username !== triggerUser) {
                console.log(`User mismatch: ${username} != ${triggerUser}`);
                return false;
            }
        }

        // Check message content conditions
        if (trigger.contains && !text.includes(trigger.contains)) {
            console.log(`Text does not contain: ${trigger.contains}`);
            return false;
        }

        if (trigger.startsWith && !text.startsWith(trigger.startsWith)) {
            console.log(`Text does not start with: ${trigger.startsWith}`);
            return false;
        }

        if (trigger.regex) {
            try {
                const regex = new RegExp(trigger.regex);
                if (!regex.test(text)) {
                    console.log(`Text does not match regex: ${trigger.regex}`);
                    return false;
                }
            } catch (error) {
                console.error(`Invalid regex in workflow trigger: ${trigger.regex}`);
                return false;
            }
        }

        console.log(`All trigger conditions matched`);
        return true;
    }
}
