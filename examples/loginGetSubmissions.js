const { MendoClient } = require('../');
require('dotenv').config({ path: '../.env' });
const fs = require('fs');

const userClient = new MendoClient();

(async () => {
	try {
		await userClient.login({
			username: process.env.MENDO_USERNAME,
			password: process.env.MENDO_PASSWORD,
		}); // Login with username and password from enviorment variables

		console.time('⏰');
		const allSubmissions = [];

		// Iterate over paginated data
		for await (const pageSubmissions of userClient.getSubmissions()) {
			// Get general information from all tasks on paage
			allSubmissions.push(
				...pageSubmissions.map(({ submissions, info }) => ({
					...info,
					submissions,
				}))
			);
		}
		console.timeEnd('⏰'); // Print the time taken to get submissions

		console.log(allSubmissions.length); // Print number of submissions

		const JSONformatted = JSON.stringify(allSubmissions, null, '\t'); // Format array as string
		fs.writeFileSync('solved.json', JSONformatted); // Write formatted array to file
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
