const { MendoClient } = require('../');
require('dotenv').config({ path: '../.env' });

const userClient = new MendoClient();

(async () => {
	try {
		await userClient.login({
			username: process.env.MENDO_USERNAME,
			password: process.env.MENDO_PASSWORD,
		}); // Login with username and password from enviorment variables

		// Iterate over tasks in competition with id 372
		const cptIds = [];
		for await (const cptT of userClient.tasksByCompetition(372)) {
			cptIds.push(cptT.info.id); // Append task id to array
		}

		// Iterate over tasks in category with id 1 (national tasks)
		for await (const ctgT of userClient.tasksByCategory(1)) {
			// See if competition tasks ids array includes the current task's id
			if (cptIds.includes(ctgT.info.id))
				console.log(await ctgT.extract(['stats'])); // Print task with extracted statistics from task
		}
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
