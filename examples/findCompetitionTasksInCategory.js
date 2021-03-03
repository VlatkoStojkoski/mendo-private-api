const { MendoClient } = require('../');
require('dotenv').config({ path: '../.env' });

const userClient = new MendoClient();

(async () => {
	try {
		await userClient.login({
			username: process.env.MENDO_USERNAME,
			password: process.env.MENDO_PASSWORD,
		});

		const competitionTasksIterator = userClient.tasksByCompetition(372);
		const competitionTasksIds = [];
		for await (const cptT of competitionTasksIterator) {
			competitionTasksIds.push(cptT.info.id);
		}

		const categoryTasks = userClient.tasksByCategory(1);
		for await (const ctgT of categoryTasks) {
			if (competitionTasksIds.includes(ctgT.info.id))
				console.log(await ctgT.extract(['stats']));
		}
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
