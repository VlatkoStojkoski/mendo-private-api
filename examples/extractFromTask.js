const { Task } = require('../');

const fs = require('fs');

(async () => {
	try {
		const task = new Task({ id: '630' }); // Get Task object for id 630

		await task.extract(['stats', 'content']); // Extract the statistics and content from task

		fs.writeFileSync('taskExtracted.json', JSON.stringify(task, null, '\t'));
	} catch (error) {
		console.log(error);
		process.exit(1);
	}
})();
