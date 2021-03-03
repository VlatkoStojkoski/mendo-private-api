const { Task } = require('../');

const fs = require('fs');

(async () => {
	try {
		const task = new Task({ id: '192' });

		await task.extract(['stats', 'content']);

		fs.writeFileSync('taskExtracted.json', JSON.stringify(task, null, '\t'));
	} catch (error) {
		console.log(error);
		process.exit(1);
	}
})();
