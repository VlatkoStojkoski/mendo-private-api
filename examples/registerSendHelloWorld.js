const { MendoClient, Task } = require('../');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

const userClient = new MendoClient();

(async () => {
	try {
		// Register new user
		await userClient.register({
			username: 'mendoPrivateAPIacc26',
			fullName: 'Mendo Private API',
			email: 'test@mail26.com',
			password: 'password',
			city: 'Скопје',
			country: '102',
			profession: 'testing account',
			institution: 'Tests Inc.',
		});

		const task = new Task({ id: '341' }); // Get the Task object for task with id 341

		console.time('⏰');
		await userClient.sendSubmission({
			task,
			code: fs.createReadStream('helloWorld.cpp'), // Make a read stream from file 'helloWorld.cpp'
			interval: 250, // The interval between checking for test results
		});
		console.timeEnd('⏰'); // Print the time taken to send submission

		console.log(task.sentSubmissions);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
