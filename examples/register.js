const Client = require('../lib/MendoClient');
const userClient = new Client();

(async () => {
	try {
		await userClient.register({
			username: 'username',
			fullName: 'Name Surname',
			email: 'email@email.com',
			password: 'password',
			city: 'Скопје',
			country: '102',
			profession: 'Ученик',
			institution: 'Средно Училиште',
		});
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
})();
