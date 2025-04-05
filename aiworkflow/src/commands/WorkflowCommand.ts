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
        const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());
        const workflows = await workflowStorage.getAll();

        if (workflows.length === 0) {
            await this.sendMessage(context, modify, 'No workflows found');
            return;
        }

        let message = 'Workflows:\n';
        for (const workflow of workflows) {
            message += `ID: ${workflow.id}\n`;
            message += `Status: ${workflow.enabled ? 'Enabled' : 'Disabled'}\n`;
            message += `Trigger: ${JSON.stringify(workflow.trigger)}\n`;
            message += `Actions: ${JSON.stringify(workflow.actions)}\n\n`;
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
        if (!command) {
            const examples = NaturalLanguageParser.getExampleCommands();
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(context.getRoom())
                .setText('Please provide a natural language command. Examples:\n' + examples.map(ex => `• \`${ex}\``).join('\n'));
            await modify.getCreator().finish(messageBuilder);
            return;
        }

        const parser = new NaturalLanguageParser();
        const steps = parser.parseCommand(command);

        if (steps.length === 0) {
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(context.getRoom())
                .setText('❌ Could not parse the command. Please check the syntax and try again.');
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
        const examples = NaturalLanguageParser.getExampleCommands();
        const text = [
            '**Available Commands**',
            '• `/workflow english "<natural language command>"` - Create a workflow using natural language',
            '',
            '**Example Commands**',
            ...examples.map(ex => `• \`/workflow english "${ex}"\``)
        ].join('\n');

        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setText(text);

        await modify.getCreator().finish(messageBuilder);
    }

    private async sendUsage(context: SlashCommandContext, modify: IModify, sender: any, room: any): Promise<void> {
        const usage = [
            'Usage:',
            '`/workflow create @user #room contains=text startsWith=text regex=pattern action=dm:@user="message"`',
            '`/workflow create action=delete`',
            '`/workflow create action=post:#room="message"`',
            '`/workflow english "<natural language command>"`',
            '`/workflow list`',
            '`/workflow delete [workflow_id]`',
            '`/workflow enable [workflow_id]`',
            '`/workflow disable [workflow_id]`'
        ].join('\n');

        await this.sendMessage(context, modify, usage);
    }

    private async sendMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setText(message);

        await modify.getCreator().finish(messageBuilder);
    }
} 