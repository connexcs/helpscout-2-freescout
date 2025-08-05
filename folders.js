import {Common} from './common.js';
export class Folders extends Common {
	async fetchMailboxes() {
		const data = await this.helpscout.list('mailboxes', `_embed=folders`);
		let i = 0;
		for (const row of data) {
			console.log(`Processing mailbox ${++i} of ${data.length}:`, row.id);
			await this.writeMailbox(row);
			await this.fetchFolders(row.id);
		}
	}

	async fetchFolders(mailboxId) {
		const data = await this.helpscout.list(`folders`, '', 'mailboxes', mailboxId);
		let i = 0;
		for (const row of data) {
			console.log(`Processing folder ${++i} of ${data.length}:`, row.id);
			await this.writeFolder(mailboxId, row);
		}
	}

	async writeFolder(mailboxId, row) {
		const folder = {
			id: row.id,
			mailbox_id: mailboxId,
			user_id: row.userId || null, 
			type: this.folderMap(row.type) || 0,
			total_count: row.totalCount || 0, // Default to 0 if totalCount is not present
			active_count: row.activeCount || 0, // Default to 0 if activeCount is not present
		};
		await this.knex('folders').insert(folder).onConflict('id').merge();
	}

	async writeMailbox(row) {
		const mailbox = {
		    id: row.id,
		    name: row.name,
		    email: row.email,
		    created_at: new Date(row.createdAt).toISOString(),
		    updated_at: new Date(row.updatedAt).toISOString(),
		};

		await this.knex('mailboxes').insert(mailbox).onConflict('id').merge();
	}

	folderMap(name) {
		console.log('Mapping folder type:', name);
		const map = {
			'unassigned': 1,
			'open': 1,
			'mine': 20,
			'mytickets': 20,
			'starred': 25,
			'drafts': 30,
			'assigned': 40,
			'closed': 60,
			'deleted': 70,
			'spam': 80
		}
		if (!map[name]){
			console.warn(`Folder type "${name}" not found in map. Defaulting to 0.`);
		}

		return map[name] || 0; // Default to 0 if not found
	}
}