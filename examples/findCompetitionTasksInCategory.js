const Client = require('../lib/MendoClient');
const userClient = new Client();
require('dotenv').config({ path: '../.env' });

const fs = require('fs');

(async () => {
	try {
		await userClient.login(
			process.env.MENDO_USERNAME,
			process.env.MENDO_PASSWORD
		);

		const categoryTasks = await userClient.tasksByCategory(1);
		const competitionTasks = await userClient.tasksByCompetition(372);

		fs.writeFileSync('ctg.json', JSON.stringify(categoryTasks, null, '\t'));
		fs.writeFileSync('cpt.json', JSON.stringify(competitionTasks, null, '\t'));

		console.log(
			categoryTasks.filter(
				(ctgT) =>
					competitionTasks.filter((cptT) => cptT.name === ctgT.name).length > 0
			)
		);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
