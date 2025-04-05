import {
    IHttp,
    IModify,
    IPersistence,
    IRead
} from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IWorkflowAction, WorkflowActionType } from '../models/Workflow';

export class ActionExecutor {
    constructor(
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly http: IHttp,
        private readonly persistence: IPersistence
    ) { }

    public async executeAction(action: IWorkflowAction, message: IMessage, sender: IUser, room: IRoom): Promise<void> {
        switch (action.type) {
            case WorkflowActionType.DM:
                await this.executeDM(action, message, sender);
                break;
            case WorkflowActionType.DeleteMessage:
                await this.executeDeleteMessage(message);
                break;
            case WorkflowActionType.PostMessage:
                await this.executePostMessage(action, message, sender);
                break;
            default:
                throw new Error(`Unsupported action type: ${action.type}`);
        }
    }

    public async executeActions(actions: Array<IWorkflowAction>, message: IMessage, sender: IUser, room: IRoom): Promise<void> {
        for (const action of actions) {
            await this.executeAction(action, message, sender, room);
        }
    }

    private async executeDM(action: IWorkflowAction, message: IMessage, sender: IUser): Promise<void> {
        if (!action.target || !action.text) {
            return;
        }

        try {
            const targetUser = await this.getUserByUsername(action.target);
            if (!targetUser) {
                return;
            }

            const roomBuilder = this.modify.getCreator().startRoom();
            roomBuilder.setType(RoomType.DIRECT_MESSAGE);
            roomBuilder.setCreator(sender);
            roomBuilder.setMembersToBeAddedByUsernames([targetUser.username]);
            
            const roomId = await this.modify.getCreator().finish(roomBuilder);
            const room = await this.read.getRoomReader().getById(roomId);
            
            if (!room) {
                return;
            }

            const messageBuilder = this.modify.getCreator().startMessage()
                .setRoom(room)
                .setSender(sender)
                .setText(action.text);

            await this.modify.getCreator().finish(messageBuilder);
        } catch (error) {
            // Silently handle errors
        }
    }

    private async executeDeleteMessage(message: IMessage): Promise<void> {
        try {
            await this.modify.getNotifier().notifyUser(message.sender, message);
        } catch (error) {
            // Silently handle errors
        }
    }

    private async executePostMessage(action: IWorkflowAction, message: IMessage, sender: IUser): Promise<void> {
        if (!action.target || !action.text) {
            return;
        }

        let targetRoom: IRoom | undefined;

        try {
            // Check if target is a room name (starting with #)
            if (action.target.startsWith('#')) {
                const roomName = action.target.substring(1);
                targetRoom = await this.getRoomByName(roomName);
            } else if (action.target === 'channel') {
                // If target is 'channel', use the same room as the trigger
                targetRoom = message.room;
            } else {
                targetRoom = await this.getRoomById(action.target);
            }

            if (!targetRoom) {
                return;
            }

            const messageBuilder = this.modify.getCreator().startMessage()
                .setRoom(targetRoom)
                .setSender(sender)
                .setText(action.text);

            await this.modify.getCreator().finish(messageBuilder);
        } catch (error) {
            // Silently handle errors
        }
    }

    private async getUserByUsername(username: string): Promise<IUser | undefined> {
        // Remove @ if present
        if (username.startsWith('@')) {
            username = username.substring(1);
        }

        // Try by username first
        return await this.read.getUserReader().getByUsername(username);
    }

    private async getRoomByName(name: string): Promise<IRoom | undefined> {
        return await this.read.getRoomReader().getByName(name);
    }

    private async getRoomById(id: string): Promise<IRoom | undefined> {
        return await this.read.getRoomReader().getById(id);
    }
} 