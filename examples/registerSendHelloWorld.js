const Client = require('../lib/MendoClient');
const userClient = new Client();

(async () => {
	try {
		await userClient.register({
			username: 'mendoPrivateAPIacc10',
			fullName: 'Mendo Private API',
			email: 'test@mail10.com',
			password: 'password',
			city: 'Скопје',
			country: '102',
			profession: 'testing account',
			institution: 'Tests Inc.',
		});

		const taskSolution = await userClient.sendSubmission(
			'341',
			'helloWorld.cpp'
		);

		console.log(taskSolution);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
