const Client = require('../lib/MendoClient');
const userClient = new Client();
require('dotenv').config({ path: '../.env' });

(async () => {
	try {
		await userClient.login(
			process.env.MENDO_USERNAME,
			process.env.MENDO_PASSWORD
		);

		const taskSolution = await userClient.submitSolution('341', 'example.cpp');

		console.log(taskSolution);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
