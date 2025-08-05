import {Common} from './common.js';
export class Workflows extends Common {
    async fetchWorkflows() {
        const data = await this.helpscout.list('workflows');
        let i = 0;
        for (const row of data) {
            await this.writeWorkflow(row);
        }
    }

    async writeWorkflow(row) {
        const workflow = {
            id: row.id,
            mailbox_id: row.mailboxId,
            name: row.name,
            type: row.type === 'automatic' ? 1 : 2, // Assuming 1 for automatic, 2 for manual
            apply_to_prev: 0,
            complete: 1,
            active: 0,
            conditions: '[]',
            actions: '[]',
            sort_order: row.order || 1,
            created_at: new Date(row.createdAt).toISOString(),
            updated_at: new Date(row.modifiedAt).toISOString(),
        };

        await this.knex('workflows').insert(workflow).onConflict('id').ignore();
    }
}