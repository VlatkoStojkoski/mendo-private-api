const Client = require('../lib/MendoClient');
const userClient = new Client();
require('dotenv').config();

(async () => {
	try {
		await userClient.login(
			process.env.MENDO_USERNAME,
			process.env.MENDO_PASSWORD
		);

		const solutions = await userClient.calcSolutions();

		console.log(solutions);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
