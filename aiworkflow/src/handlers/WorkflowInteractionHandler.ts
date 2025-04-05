import {
    IHttp,
    IModify,
    IPersistence,
    IRead
} from '@rocket.chat/apps-engine/definition/accessors';
import {
    IUIKitInteractionHandler,
    IUIKitResponse,
    UIKitBlockInteractionContext,
    UIKitViewSubmitInteractionContext,
    UIKitActionButtonInteractionContext,
    UIKitViewCloseInteractionContext
} from '@rocket.chat/apps-engine/definition/uikit';
import { IWorkflow } from '../models/Workflow';
import { WorkflowStorage } from '../storage/WorkflowStorage';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowInteractionHandler implements IUIKitInteractionHandler {
    public async executeViewSubmitHandler(
        context: UIKitViewSubmitInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        return {
            success: true
        };
    }

    public async executeViewCloseHandler(
        context: UIKitViewCloseInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        return {
            success: true
        };
    }

    public async executeBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const interactionData = context.getInteractionData();
        const { actionId, user, room } = interactionData;

        if (!user || !room) {
            return {
                success: false
            };
        }

        if (actionId === 'approve_workflow') {
            const steps = interactionData.value ? JSON.parse(interactionData.value) : [];
            if (steps.length === 0) {
                return {
                    success: false
                };
            }

            const workflowStorage = new WorkflowStorage(persistence, read.getPersistenceReader());

            // Create a workflow for each step
            for (const step of steps) {
                const workflow: IWorkflow = {
                    id: uuidv4(),
                    createdBy: user.id,
                    createdAt: new Date(),
                    enabled: true,
                    trigger: step.trigger,
                    actions: [step.action]
                };

                await workflowStorage.create(workflow);
            }

            // Send confirmation message
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(room)
                .setText(`✅ Created ${steps.length} workflow${steps.length > 1 ? 's' : ''} successfully!`);

            await modify.getCreator().finish(messageBuilder);
        } else if (actionId === 'cancel_workflow') {
            // Send cancellation message
            const messageBuilder = modify.getCreator().startMessage()
                .setRoom(room)
                .setText('❌ Workflow creation cancelled.');

            await modify.getCreator().finish(messageBuilder);
        }

        return {
            success: true
        };
    }

    public async executeActionButtonHandler(
        context: UIKitActionButtonInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        return {
            success: true
        };
    }
} 