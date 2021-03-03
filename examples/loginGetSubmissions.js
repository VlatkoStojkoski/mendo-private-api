const { MendoClient } = require('../');
require('dotenv').config({ path: '../.env' });
const fs = require('fs');

const userClient = new MendoClient();

(async () => {
	try {
		await userClient.login({
			username: process.env.MENDO_USERNAME,
			password: process.env.MENDO_PASSWORD,
		});

		const submissions = await userClient.getSubmissions(); // Get an array of sent submissions

		const JSONformatted = JSON.stringify(submissions, null, '\t');
		fs.writeFileSync('solved.json', JSONformatted); // Write array to file
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
