import {
    IHttp,
    IModify,
    IPersistence,
    IRead
} from '@rocket.chat/apps-engine/definition/accessors';
import {
    ISlashCommand,
    SlashCommandContext
} from '@rocket.chat/apps-engine/definition/slashcommands';
import { IWorkflow, IWorkflowAction, IWorkflowTrigger, Workflow, WorkflowActionType, WorkflowTriggerType } from '../models/Workflow';
import { WorkflowStorage } from '../storage/WorkflowStorage';
import { v4 as uuidv4 } from 'uuid';
import { NaturalLanguageParser } from '../parsers/NaturalLanguageParser';
import { IBlock, ISectionBlock, IActionsBlock, IButtonElement } from '@rocket.chat/apps-engine/definition/uikit';
import { BlockBuilder } from '@rocket.chat/apps-engine/definition/uikit';
import { BlockType, BlockElementType, TextObjectType, ButtonStyle } from '@rocket.chat/apps-engine/definition/uikit';
import { UserType } from '@rocket.chat/apps-engine/definition/users';

export class WorkflowCommand implements ISlashCommand {
    public command = 'workflow';
    public i18nDescription = 'Create and manage chat workflows';
    public providesPreview = false;
    public i18nParamsExample = 'english "<natural language command>"';

    constructor(
        private readonly app: any
    ) { }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persistence: IPersistence
    ): Promise<void> {
        const [subcommand, ...args] = context.getArguments();

        if (!subcommand) {
            await this.showHelp(context, modify);
            return;
        }

        switch (subcommand.toLowerCase()) {
            case 'create':
                await this.createWorkflow(args, context, read, modify, persistence);
                break;
            case 'list':
                await this.listWorkflows(context, read, modify, persistence);
                break;
            case 'delete':
                await this.deleteWorkflow(args, context, read, modify, persistence);
                break;
            case 'enable':
                await this.enableWorkflow(args, context, read, modify, persistence, true);
                break;
            case 'disable':
                await this.enableWorkflow(args, context, read, modify, persistence, false);
                break;
            case 'english':
                await this.handleEnglishCommand(context, args.join(' '), read, modify, persistence);
                break;
            default:
                await this.showHelp(context, modify);
        }
    }

    private async createWorkflow(
        args: Array<string>,
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        persistence: IPersistence
    ): Promise<void> {
        const sender = context.getSender();
        const room = context.getRoom();

        // Check if user is admin
        const isAdmin = sender.roles?.includes('admin') || sender.type === UserType.BOT;
        
        if (!isAdmin) {
            await this.sendMessage(
                context,
                modify,
                '❌ Only administrators can create workflows.'
            );
            return;
        }

        if (args.length === 0) {
            await this.sendUsage(context, modify, sender, room);
            return;
        }

        const workflowId = uuidv4();
        const trigger: IWorkflowTrigger = { type: WorkflowTriggerType.Message };
        const actions: Array<IWorkflowAction> = [];

        // Parse arguments for trigger conditions and actions
        for (const arg of args) {
            if (arg.startsWith('@')) {
                // User condition
                trigger.user = arg;
            } else if (arg.startsWith('#')) {
                // Room condition
                trigger.room = arg;
            } else if (arg.startsWith('contains=')) {
                // Contains text condition
                trigger.contains = arg.substring('contains='.length);
            } else if (arg.startsWith('startsWith=')) {
                // Starts with text condition
                trigger.startsWith = arg.substring('startsWith='.length);
            } else if (arg.startsWith('regex=')) {
                // Regex pattern condition
                trigger.regex = arg.substring('regex='.length);
            } else if (arg.startsWith('action=')) {
                // Parse action
                const actionSpec = arg.substring('action='.length);
                const action = this.parseAction(actionSpec);
                if (action) {
                    actions.push(action);
                }
            }
        }

        if (actions.length === 0) {
            await this.sendMessage(context, modify, 'Error: At least one action must be specified');
            return;
        }

        const workflow: IWorkflow = {
            id: workflowId,
            createdBy: sender.id,
            createdAt: new Date(),
            enabled: true,
            trigger,
            actions
        };

        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        await workflowStorage.create(workflow);

        await this.sendMessage(
            context,
            modify,
            `Workflow created with ID: ${workflowId}\nTrigger: ${JSON.stringify(trigger)}\nActions: ${JSON.stringify(actions)}`
        );
    }

    private async listWorkflows(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        persistence: IPersistence
    ): Promise<void> {
        const sender = context.getSender();
        
        // Check if user is admin
        const isAdmin = sender.roles?.includes('admin') || sender.type === UserType.BOT;
        
        if (!isAdmin) {
            await this.sendMessage(
                context,
                modify,
                '❌ Only administrators can view workflows.'
            );
            return;
        }

        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        const workflows = await workflowStorage.getAll();

        if (workflows.length === 0) {
            await this.sendMessage(context, modify, 'No workflows found');
            return;
        }

        let message = '🔒 *Workflows (Admin View)*:\n\n';
        for (const workflow of workflows) {
            message += `📋 ID: ${workflow.id}\n`;
            message += `📍 Status: ${workflow.enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
            message += `🎯 Trigger: When someone`;
            if (workflow.trigger.user) message += ` (@${workflow.trigger.user})`;
            if (workflow.trigger.room) message += ` in ${workflow.trigger.room}`;
            if (workflow.trigger.contains) message += ` says "${workflow.trigger.contains}"`;
            message += '\n';
            message += `🎬 Actions:\n`;
            workflow.actions.forEach((action, index) => {
                message += `  ${index + 1}. `;
                if (action.type === 'dm') message += `Send DM to ${action.target}: "${action.text}"`;
                if (action.type === 'post') message += `Send message to ${action.target}: "${action.text}"`;
                if (action.type === 'delete') message += `Delete message`;
                message += '\n';
            });
            message += '\n';
        }

        await this.sendMessage(context, modify, message);
    }

    private async deleteWorkflow(
        args: Array<string>,
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        persistence: IPersistence
    ): Promise<void> {
        const sender = context.getSender();

        // Check if user is admin
        const isAdmin = sender.roles?.includes('admin') || sender.type === UserType.BOT;
        
        if (!isAdmin) {
            await this.sendMessage(
                context,
                modify,
                '❌ Only administrators can delete workflows.'
            );
            return;
        }

        if (args.length === 0) {
            await this.sendUsage(context, modify, context.getSender(), context.getRoom());
            return;
        }

        const workflowId = args[0];
        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        const workflow = await workflowStorage.getById(workflowId);

        if (!workflow) {
            await this.sendMessage(context, modify, `Workflow with ID ${workflowId} not found`);
            return;
        }

        await workflowStorage.delete(workflowId);
        await this.sendMessage(context, modify, `Workflow ${workflowId} deleted`);
    }

    private async enableWorkflow(
        args: Array<string>,
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        persistence: IPersistence,
        enabled: boolean
    ): Promise<void> {
        const sender = context.getSender();

        // Check if user is admin
        const isAdmin = sender.roles?.includes('admin') || sender.type === UserType.BOT;
        
        if (!isAdmin) {
            await this.sendMessage(
                context,
                modify,
                `❌ Only administrators can ${enabled ? 'enable' : 'disable'} workflows.`
            );
            return;
        }

        if (args.length === 0) {
            await this.sendUsage(context, modify, context.getSender(), context.getRoom());
            return;
        }

        const workflowId = args[0];
        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        const workflow = await workflowStorage.getById(workflowId);

        if (!workflow) {
            await this.sendMessage(context, modify, `Workflow with ID ${workflowId} not found`);
            return;
        }

        workflow.enabled = enabled;
        await workflowStorage.update(workflow);
        await this.sendMessage(context, modify, `Workflow ${workflowId} ${enabled ? 'enabled' : 'disabled'}`);
    }

    private parseAction(actionSpec: string): IWorkflowAction | undefined {
        const parts = actionSpec.split(':');
        if (parts.length < 2) {
            return undefined;
        }

        const actionType = parts[0].toLowerCase();
        const actionValue = parts.slice(1).join(':');

        switch (actionType) {
            case 'dm':
                const dmParts = actionValue.split('=');
                if (dmParts.length !== 2) {
                    return undefined;
                }
                return {
                    type: WorkflowActionType.DM,
                    target: dmParts[0],
                    text: dmParts[1].replace(/^["'](.*)["']$/, '$1') // Remove quotes if present
                };
            case 'delete':
                return {
                    type: WorkflowActionType.DeleteMessage
                };
            case 'post':
                const postParts = actionValue.split('=');
                if (postParts.length !== 2) {
                    return undefined;
                }
                return {
                    type: WorkflowActionType.PostMessage,
                    target: postParts[0],
                    text: postParts[1].replace(/^["'](.*)["']$/, '$1') // Remove quotes if present
                };
            default:
                return undefined;
        }
    }

    private async handleEnglishCommand(
        context: SlashCommandContext,
        command: string,
        read: IRead,
        modify: IModify,
        persistence: IPersistence
    ): Promise<void> {
        const sender = context.getSender();

        // Check if user is admin
        const isAdmin = sender.roles?.includes('admin') || sender.type === UserType.BOT;
        
        if (!isAdmin) {
            await this.sendMessage(
                context,
                modify,
                'Only administrators can create workflows using natural language.'
            );
            return;
        }

        if (!command) {
            const examples = NaturalLanguageParser.getExampleCommands();
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(context.getRoom())
                .setText('Here are some example commands you can use:\n' + examples.map(ex => `• \`${ex}\``).join('\n'));
            await modify.getCreator().finish(messageBuilder);
            return;
        }

        const parser = new NaturalLanguageParser();
        const steps = parser.parseCommand(command);

        if (steps.length === 0) {
            const examples = NaturalLanguageParser.getExampleCommands();
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(context.getRoom())
                .setText('I couldn\'t understand that command. Try using one of these formats:\n' + 
                    examples.map(ex => `• \`${ex}\``).join('\n'));
            await modify.getCreator().finish(messageBuilder);
            return;
        }

        // Create a message with workflow details and confirmation buttons
        const block = modify.getCreator().getBlockBuilder();

        block.addSectionBlock({
            text: block.newMarkdownTextObject('*Workflow Preview*\nHere\'s what I understood from your command:')
        });

        // Add workflow steps preview
        for (const [index, step] of steps.entries()) {
            const triggerText = step.trigger.type === 'message' 
                ? `When ${step.trigger.user ? `@${step.trigger.user}` : 'someone'} says "${step.trigger.pattern}"${step.trigger.room ? ` in #${step.trigger.room}` : ''}`
                : `When ${step.trigger.user ? `@${step.trigger.user}` : 'someone'} is mentioned${step.trigger.room ? ` in #${step.trigger.room}` : ''}`;

            const actionText = step.action.type === 'message'
                ? `send message "${step.action.content}"${step.action.target ? ` to ${step.action.target}` : ''}`
                : `send DM "${step.action.content}" to @${step.action.target}`;

            block.addSectionBlock({
                text: block.newMarkdownTextObject(`*Step ${index + 1}*:\n${triggerText}\n➡️ ${actionText}`)
            });
        }

        block.addDividerBlock();

        // Add confirmation buttons
        block.addActionsBlock({
            elements: [
                block.newButtonElement({
                    text: block.newPlainTextObject('✅ Create Workflow'),
                    value: JSON.stringify(steps),
                    actionId: 'approve_workflow',
                    style: ButtonStyle.PRIMARY
                }),
                block.newButtonElement({
                    text: block.newPlainTextObject('❌ Cancel'),
                    actionId: 'cancel_workflow',
                    style: ButtonStyle.DANGER
                })
            ]
        });

        // Send the message
        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setBlocks(block);

        await modify.getCreator().finish(messageBuilder);
    }

    private async showHelp(context: SlashCommandContext, modify: IModify): Promise<void> {
        const text = [
            '🤖 **AI Workflow Bot Commands**',
            '',
            '📋 **Core Commands**',
            '• `/workflow list` - View all existing workflows',
            '• `/workflow create` - Create a new workflow using technical syntax',
            '• `/workflow delete [workflow_id]` - Delete a specific workflow',
            '• `/workflow enable [workflow_id]` - Enable a specific workflow',
            '• `/workflow disable [workflow_id]` - Disable a specific workflow',
            '• `/workflow english "<command>"` - Create workflow using natural language',
            '',
            '💡 **Usage Examples**',
            '1. Create workflow with technical syntax:',
            '```',
            '/workflow create @user #room contains=hello action=post:#general="Hello there!"',
            '/workflow create contains=help action=dm:@support="New help request"',
            '```',
            '',
            '2. Create workflow with natural language:',
            '```',
            '/workflow english "when someone says hello in #general send Hello there! to the channel"',
            '/workflow english "when @john mentions me send him a DM saying I will help you"',
            '```',
            '',
            '3. Manage workflows:',
            '```',
            '/workflow list',
            '/workflow enable ID',
            '/workflow disable ID',
            '/workflow delete ID',
            '```',
            '',
            '⚠️ Note: Workflow management commands are restricted to administrators only.'
        ].join('\n');

        await this.sendMessage(context, modify, text);
    }

    private async sendUsage(context: SlashCommandContext, modify: IModify, sender: any, room: any): Promise<void> {
        const usage = [
            'Here are some example commands you can use:',
            '',
            '1. Create a simple workflow:',
            '`/workflow create contains=hello action=post:channel="Hello there!"`',
            '',
            '2. Create a workflow for a specific user:',
            '`/workflow create @user contains=help action=dm:@support="New help request"`',
            '',
            '3. Create a workflow using natural language:',
            '`/workflow english "when someone says hello in #general send Hello there! to the channel"`',
            '',
            '4. Manage workflows:',
            '`/workflow list` - View all workflows',
            '`/workflow delete [workflow_id]` - Delete a workflow',
            '`/workflow enable [workflow_id]` - Enable a workflow',
            '`/workflow disable [workflow_id]` - Disable a workflow'
        ].join('\n');

        await this.sendMessage(context, modify, usage);
    }

    private async sendMessage(
        context: SlashCommandContext,
        modify: IModify,
        message: string
    ): Promise<void> {
        const sender = context.getSender();
        const room = context.getRoom();

        // Create direct message to the sender
        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(room)
            .setText(message)
            .setSender(sender)
            .setUsernameAlias('Workflow Bot')
            .setEmojiAvatar(':gear:');

        // Create the message
        await modify.getNotifier().notifyUser(sender, messageBuilder.getMessage());
    }
} 