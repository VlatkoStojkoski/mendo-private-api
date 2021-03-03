const { MendoClient } = require('../');
require('dotenv').config({ path: '../.env' });

const userClient = new MendoClient();

(async () => {
	try {
		await userClient.register({
			username: 'mendoPrivateAPIacc21',
			fullName: 'Mendo Private API',
			email: 'test@mail21.com',
			password: 'password',
			city: 'Скопје',
			country: '102',
			profession: 'testing account',
			institution: 'Tests Inc.',
		});

		console.time('⏰');

		const taskSolution = await userClient.sendSubmission({
			taskId: '341',
			submissionPath: 'helloWorld.cpp',
		});
		console.log(taskSolution);

		console.timeEnd('⏰'); // Print the time taken to send submission
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
