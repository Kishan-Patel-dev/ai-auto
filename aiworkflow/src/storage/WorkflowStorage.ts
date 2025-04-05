import { IPersistence, IPersistenceRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IWorkflow, Workflow } from '../models/Workflow';

export class WorkflowStorage {
    constructor(
        private readonly persistence: IPersistence,
        private readonly persistenceRead: IPersistenceRead
    ) { }

    public async create(workflow: IWorkflow): Promise<void> {
        const workflowObj = new Workflow(workflow);
        const association = workflowObj.getAssociation();
        const allWorkflowsAssociation = Workflow.getAssociationForAllWorkflows();

        await this.persistence.createWithAssociations(workflowObj, [association, allWorkflowsAssociation]);
    }

    public async getById(id: string): Promise<Workflow | undefined> {
        const association = Workflow.getAssociationByWorkflowId(id);
        const [result] = await this.persistenceRead.readByAssociation(association) as Array<IWorkflow>;

        return result ? new Workflow(result) : undefined;
    }

    public async getAll(): Promise<Array<Workflow>> {
        const association = Workflow.getAssociationForAllWorkflows();
        const results = await this.persistenceRead.readByAssociation(association) as Array<IWorkflow>;

        return results ? results.map((result) => new Workflow(result)) : [];
    }

    public async update(workflow: IWorkflow): Promise<void> {
        const workflowObj = new Workflow(workflow);
        const association = workflowObj.getAssociation();
        const allWorkflowsAssociation = Workflow.getAssociationForAllWorkflows();

        await this.persistence.updateByAssociations([association], workflowObj, true);
    }

    public async delete(id: string): Promise<void> {
        const association = Workflow.getAssociationByWorkflowId(id);
        await this.persistence.removeByAssociations([association]);
    }
} 