import { Common } from './common.js';
export class Customers extends Common {
	async fetchCustomers() {
		const data = await this.helpscout.list('customers');
		let i = 0;
		for (const row of data) {
			console.log(`Processing customer ${++i} of ${data.length}:`, row.id);
			await this.writeCustomer(row);
		}
	}

	async writeCustomer(row) {
		const customer = {
			id: row.id,
			first_name: row.firstName,
			last_name: row.lastName,
			company: row.organization,
			job_title: row.jobTitle,
			photo_type: row.photoType,
			photo_url: null, //row.photoUrl,
			phones: this.preparePhones(row._embedded.phones),
			websites: JSON.stringify(row._embedded.websites.map(website => website.value)),
			social_profiles: this.prepareSocialProfiles(row._embedded.social_profiles),
			notes: row.background,
			address: (row._embedded?.address?.lines || []).join('\n'),
			city: row._embedded?.address?.city || '',
			state: row._embedded?.address?.state || '',
			zip: row._embedded?.address?.postalCode || '',
			country: row._embedded?.address?.country || '',
			created_at: new Date(row.createdAt).toISOString(),
			updated_at: new Date(row.updatedAt).toISOString(),
			channel: 0, // Default channel
			channel_id: '',
			meta: '{}',
			enriched: 0, // Default enriched status
			spam_status: ''
		};

		await this.knex('customers').insert(customer).onConflict('id').merge();
		await this.writeEmails(row.id, row._embedded.emails);
	}

	async writeEmails(customer_id, emails) {
		for (const email of emails) {
			await this.knex('emails').insert({
				id: email.id,
				customer_id,
				email: email.value,
				type: 1, // Assuming 'work' type
			}).onConflict(['id']).merge();
		}
	}

	preparePhones(phones) {
		const typeMap = {
			'work': 1,
			'home': 2,
			'other': 3,
			'mobile': 4,
			'fax': 5,
			'pager': 6
		};
		return JSON.stringify(phones.map(phone => ({
			value: phone.value,
			type: typeMap[phone.type]
		})));
	}

	prepareSocialProfiles(social_profiles) {
		const typeMap = {
			'twitter': 1,
			'facebook': 2,
			'telegram': 14,
			'linkedin': 3,
			'aboutme': 4,
			'google': 5,
			'googleplus': 6,
			'tungleme': 7,
			'quora': 8,
			'foursquare': 9,
			'youtube': 10,
			'flickr': 11,
			'vk': 13,
			'other': 12
		};
		return JSON.stringify(social_profiles.map(profile => ({
			value: profile.value,
			type: typeMap[profile.type] || 12, // Default to 'other' if type not found
		})));
	}
}