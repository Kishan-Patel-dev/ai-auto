import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export enum WorkflowTriggerType {
    Message = 'message',
}

export enum WorkflowActionType {
    DM = 'dm',
    DeleteMessage = 'delete',
    PostMessage = 'post',
}

export interface IWorkflowTrigger {
    type: WorkflowTriggerType;
    room?: string; // Room ID or name
    user?: string; // User ID or username
    contains?: string; // Text that message should contain
    startsWith?: string; // Text that message should start with
    regex?: string; // Regex pattern to match against message
}

export interface IWorkflowAction {
    type: WorkflowActionType;
    target?: string; // User or room ID/name for DM or post actions
    text?: string; // Text to send in DM or post
}

export interface IWorkflow {
    id: string;
    name?: string;
    createdBy: string; // User ID
    createdAt: Date;
    enabled: boolean;
    trigger: IWorkflowTrigger;
    actions: Array<IWorkflowAction>;
}

export class Workflow implements IWorkflow {
    public id: string;
    public name?: string;
    public createdBy: string;
    public createdAt: Date;
    public enabled: boolean;
    public trigger: IWorkflowTrigger;
    public actions: Array<IWorkflowAction>;

    constructor(workflow: IWorkflow) {
        this.id = workflow.id;
        this.name = workflow.name;
        this.createdBy = workflow.createdBy;
        this.createdAt = workflow.createdAt || new Date();
        this.enabled = workflow.enabled !== undefined ? workflow.enabled : true;
        this.trigger = workflow.trigger;
        this.actions = workflow.actions || [];
    }

    public getAssociation(): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.MISC,
            `workflow:${this.id}`
        );
    }

    public static getAssociationByWorkflowId(workflowId: string): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.MISC,
            `workflow:${workflowId}`
        );
    }

    public static getAssociationForAllWorkflows(): RocketChatAssociationRecord {
        return new RocketChatAssociationRecord(
            RocketChatAssociationModel.MISC,
            'workflows'
        );
    }
} 