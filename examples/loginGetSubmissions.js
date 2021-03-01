const MendoClient = require('../');
const fs = require('fs');

const client = new MendoClient();
require('dotenv').config({ path: '../.env' });

(async () => {
	try {
		await client.login(process.env.MENDO_USERNAME, process.env.MENDO_PASSWORD); // Use username and password from enviorment variable

		const submissions = await client.getSubmissions(); // Get an array of sent submissions

		const JSONformatted = JSON.stringify(submissions, null, '\t');
		fs.writeFileSync('solved.json', JSONformatted); // Write array to file
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
