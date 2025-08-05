import HelpScout from 'helpscout-2.0';
import dotenv from 'dotenv';
import Knex from 'knex';

import {Customers} from './customers.js';
import {Conversations} from './conversations.js';
import {Folders} from './folders.js';
import {Workflows} from './workflows.js';

dotenv.config();
const env = process.env;

const knex = Knex({
	client: 'mysql',
	connection: {
		host: process.env.DB_HOST,
		user: env.DB_USER,
		password: env.DB_PASSWORD,
		database: env.DB_NAME
	}
});
const scout = new HelpScout({
	clientId: env.HELPSCOUT_CLIENT_ID,
	clientSecret: env.HELPSCOUT_CLIENT_SECRET,
});

const customers = new Customers(knex, scout);
await customers.fetchCustomers()

const workflows = new Workflows(knex, scout);
await workflows.fetchWorkflows();

const folders = new Folders(knex, scout);
await folders.fetchMailboxes();

const conversations = new Conversations(knex, scout);
await conversations.fetchConversations()

console.log('Complete');
process.exit(0);

