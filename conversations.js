import {Common} from './common.js';
import crypto from 'crypto';

export class Conversations extends Common {
	async fetchConversations() {
		const data = await this.helpscout.list('conversations', 'embed=threads&status=all');
		let i = 0;
		for (const row of data) {
			await this.writeConversation(row);
		}
	}

	async writeConversation(row) {
		await this.writeTags(row.tags);

		const conversation = {
			id: row.number,
			number: row.number,
			threads_count: row.threads,
			type: this.typeMap(row.type),
			folder_id: row.folderId,
			status: this.statusMap(row.status),
			state: this.stateMap(row.state),
			subject: row.subject,
			customer_email: row.primaryCustomer?.email || '',
			cc: JSON.stringify(row.cc),
			bcc: JSON.stringify(row.bcc),
			preview: row.preview,
			imported: 1,
			has_attachments: row._embedded.threads.some(thread => thread._embedded.attachments && thread._embedded.attachments.length > 0) ? 1 : 0,
			mailbox_id: row.mailboxId,
			user_id: this.getLastAssignedTo(row._embedded.threads),
			customer_id: row.primaryCustomer?.id || null,
			created_by_user_id: row.createdBy.type === 'user' ? row.createdBy.id : null,
			created_by_customer_id: row.createdBy.type === 'customer' ? row.createdBy.id : null,
			source_via: row.source?.via === 'customer' ? 1 : 2, // Assuming 1 for customer, 2 for user
			source_type: row.source?.type === 'email' ? 1 : 2, // Assuming 1 for email, 2 for other types
			closed_by_user_id: row.closedByUser?.id || null,
			closed_at: row.closedAt ? new Date(row.closedAt).toISOString()	: null,
			user_updated_at: row.userUpdatedAt ? new Date(row.userUpdatedAt).toISOString() : null,
			last_reply_at: row.customerWaitingSince?.time ? new Date(row.customerWaitingSince.time).toISOString() : null,

			last_reply_from: row._embedded.threads[0]?.source?.via === 'customer' ? 1 : 2, // Assuming 1 for customer, 2 for user

			read_by_user: row._embedded.threads.slice(-1)[0]?.readByUser ? 1 : 0,
			created_at: new Date(row.createdAt).toISOString(),
			updated_at: new Date(row.userUpdatedAt).toISOString(),
			channel: 0, // Default channel
			meta: '{}', // Default meta, can be updated later
			rpt_ready: 0 // Default rpt_ready status
		};
		await this.knex('conversations').insert(conversation).onConflict('id').merge();
		await this.writeThreads(row.number, row._embedded.threads);
		await this.writeConversationTags(row.number, row.tags);
	}

	async writeThreads(conversationId, threads) {
		const firstThreadId = threads.length > 0 ? Math.min(...threads.map(thread => thread.id)) : null;

		const writeData = await Promise.all(threads.map(async thread => {
			await this.writeEmbedded(thread);

			return {
				id: thread.id,
				conversation_id: conversationId,
				user_id: thread.createdBy.type === 'user' ? thread.createdBy.id : null,
				type: this.threadTypeMap(thread.type),
				subtype: null,

				status: this.statusMap(thread.status),
				state: this.threadStateMap(thread.state),
				action_type: this.threadActionTypeMap(thread.action?.type),
				action_data: thread.customer?.email || null,
				body: thread.body,
				headers: null,
				from: thread.customer?.email || null,
				to: JSON.stringify(thread.to),
				cc: JSON.stringify(thread.cc),
				bcc: JSON.stringify(thread.bcc),
				has_attachments: thread._embedded?.attachments && thread._embedded.attachments.length > 0 ? 1 : 0,
				message_id: null,
				source_via: thread.source?.via === 'customer' ? 1 : 2, // Assuming 1 for customer, 2 for user
				source_type: thread.source?.type === 'email' ? 1 : 2, // Assuming 1 for email, 2 for other types
				customer_id: thread.customer?.id || null,
				created_by_user_id: thread.createdBy.type === 'user' ? thread.createdBy.id : null,
				created_by_customer_id: thread.createdBy.type === 'customer' ? thread.createdBy.id : null,
				edited_by_user_id: null, // Assuming no edits
				edited_at: null, // Assuming no edits
				body_original: thread.body,
				first: thread.id === firstThreadId ? 1 : 0,
				saved_reply_id: thread.savedReplyId || null,
				send_status: null,
				send_status_data: null,
				opened_at: thread.openedAt ? new Date(thread.openedAt).toISOString() : null,

				created_at: new Date(thread.createdAt).toISOString(),
				updated_at: new Date(thread.createdAt).toISOString(),
				meta: this.threadMeta(thread), // Default meta, can be updated later
				imported: 1
			}
		}));

		if (writeData.length) await this.knex('threads').insert(writeData).onConflict('id').merge();
		for (const thread of threads) {
			await this.writeAttachments(thread);
		}
	}
	async writeAttachments(thread) {
		if (!thread._embedded.attachments || thread._embedded.attachments.length === 0) return;
		const attachmentData = thread._embedded.attachments.map(attachment => {
			const url = attachment._links.web.href;
			const urlParts = url.split('/');
			const fileName = urlParts[urlParts.length - 1];
			const fileDir = urlParts[urlParts.length - 2];
			const type = this.detectType(attachment.mimeType, fileName.split('.').pop());
			return {
				id: attachment.id,
				thread_id: thread.id,
				user_id: thread.createdBy.type === 'user' ? thread.createdBy.id : null,
				file_dir: fileDir.substring(0,3).split('').join('/') + '/',
				file_name: fileName,
				mime_type: attachment.mimeType || '',
				type, // Default attachment type
				size: attachment.size,
				embedded: (type === 5) ? 1 : 0, // Assuming embedded for multipart and message types
				public: 0,
				href: attachment._links.web.href || '',
			};
		});
		await this.knex('attachments').insert(attachmentData).onConflict(['id']).merge();
	}

	getLastAssignedTo(threads) {
		const filteredThreads = threads.filter(thread => thread.assignedTo && thread.assignedTo.id);
		if (filteredThreads.length === 0) return null;
		const lastThread = filteredThreads[0];
		if (!lastThread || !lastThread.assignedTo) return null;
		return lastThread.assignedTo.id;
	}

	async writeEmbedded(thread) {
		const embeddedRegex = /<img src="(https:\/\/.*cloudfront\.net.*?)"[^>]+>/g;

		let match = null
		while ((match = embeddedRegex.exec(thread.body)) !== null) {
			const url = match[1];
			const urlParts = url.split('/');
			const fileName = urlParts[urlParts.length - 1];
			const fileDir = urlParts[urlParts.length - 2].substring(0,3).split('').join('/') + '/';

			const type = this.detectType('image/jpeg', fileName.split('.').pop());

			const attachment = {
				id: null, // New attachment ID
				thread_id: thread.id,
				user_id: thread.createdBy.type === 'user' ? thread.createdBy.id : null,
				file_dir: fileDir,
				file_name: fileName,
				mime_type: 'image/jpeg',
				type, // Default attachment type
				size: 0, // Size unknown for embedded images
				embedded: 1, // Mark as embedded
				public: 0,
				href: url,
			};
			await this.knex('attachments').insert(attachment).onConflict(['thread_id', 'file_dir', 'file_name']).ignore();
			const attachmentId = await this.knex('attachments').where({thread_id: thread.id, file_dir: attachment.file_dir, file_name: attachment.file_name}).select('id').first();
			
			const token = crypto.createHash('md5').update(`${process.env.APP_KEY}${attachmentId.id}0`).digest('hex');

			thread.body = thread.body.replace(match[1], `/storage/attachment/${fileDir}${fileName}?id=${attachmentId.id}&token=${token}`);

			// Process each match
		}
	}

	async writeTags(tags) {
		if (!tags || tags.length === 0) return;

		const tagData = tags.map(tag => ({
			id: tag.id,
			color: 0,
			name: tag.tag
		}));

		await this.knex('tags').insert(tagData).onConflict(['id']).merge();
	}
	async writeConversationTags(conversationId, tags) {
		if (!tags || tags.length === 0) return;
		const tagIds = tags.map(tag => tag.id);
		const tagData = tagIds.map(tagId => ({
			conversation_id: conversationId,
			tag_id: tagId
		}));
		await this.knex('conversation_tag').insert(tagData).onConflict(['conversation_id', 'tag_id']).merge();
	}


	typeMap(type) {
		const map = {
			'email': 1,
			'phone': 2,
			'chat': 3,
			'custom': 4
		};
		return map[type] || 0; // Default to 0 if not found
	}

	statusMap(status) {
		const map = {
			'active': 1,
			'pending': 2,
			'closed': 3,
			'spam': 4
		};
		if (!map[status]) {
			console.warn(`Status "${status}" not found in map. Defaulting to 1.`);
		}
		return map[status] || 1; // Default to 1 if not found
	}

	stateMap(state) {
		const map = {
			'draft': 1,
			'published': 2,
			'deleted': 3
		};
		if (!map[state]) {
			console.warn(`State "${state}" not found in map. Defaulting to 2.`);
		}
		return map[state] || 2; // Default to 2 if not found
	}

	threadTypeMap(type) {
		const map = {
			'customer': 1,
			'message': 2,
			'note': 3,
			'lineitem': 4
		};
		if (!map[type]){
			console.warn(`Thread type "${type}" not found in map. Defaulting to 0.`);
		}
		return map[type] || 0; // Default to 0 if not found
	}

	threadActionTypeMap(actionType) {
		const map = {
			'changed-ticket-status': 1,
			'changed-ticket-assignee': 2,
			'moved-from-mailbox': 3,
			'merged': 4,
			'imported': 5,
			'manual-workflow': 202,
			'automatic-workflow': 201,
			'imported-external': 8,
			'changed-ticket-customer': 9,
			'deleted-ticket': 10,
			'restore-ticket': 11
		};
		return map[actionType] || 0; // Default to 0 if not found
	}

	threadStateMap(type) {
		const map = {
			'draft': 1,
			'published': 2,
			'hidden': 3,
			'review': 4
		};
		if (!map[type]) {
			console.warn(`Thread state "${type}" not found in map. Defaulting to 2.`);
		}
		return map[type] || 2; // Default to 2 if not found
	}

	threadMeta(thread) {
		if (!thread?.action?.associatedEntities?.workflow) return '';
		return JSON.stringify({
			workflow_id: thread.action.associatedEntities.workflow,
		});
	}


	detectType(mimeType, extension = '') {
		const TYPE_TEXT = 0;
		const TYPE_MULTIPART = 1;
		const TYPE_MESSAGE = 2;
		const TYPE_APPLICATION = 3;
		const TYPE_AUDIO = 4;
		const TYPE_IMAGE = 5;
		const TYPE_VIDEO = 6;
		const TYPE_MODEL = 7;
		const TYPE_OTHER = 8;
		const typeExtensions = {
			[TYPE_VIDEO]: ['flv', 'mp4', 'm3u8', 'ts', '3gp', 'mov', 'avi', 'wmv']
		};

		if (/^text\//.test(mimeType)) {
			return TYPE_TEXT;
		} else if (/^message\//.test(mimeType)) {
			return TYPE_MESSAGE;
		} else if (/^application\//.test(mimeType)) {
			// This is tricky mime type.
			// For .mp4 mime type can be application/octet-stream
			if (extension && typeExtensions[TYPE_VIDEO].includes(extension.toLowerCase())) {
				return TYPE_VIDEO;
			}
			return TYPE_APPLICATION;
		} else if (/^audio\//.test(mimeType)) {
			return TYPE_AUDIO;
		} else if (/^image\//.test(mimeType)) {
			return TYPE_IMAGE;
		} else if (/^video\//.test(mimeType)) {
			return TYPE_VIDEO;
		} else if (/^model\//.test(mimeType)) {
			return TYPE_MODEL;
		} else {
			return TYPE_OTHER;
		}
	}
}