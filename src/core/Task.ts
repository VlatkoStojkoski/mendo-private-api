import axios from 'axios';
import * as cheerio from 'cheerio';

import {
	TaskStatistics,
	TaskInfo,
	TaskContent,
	TaskConstraints,
	Submission,
	ExtractData,
} from '../types';

/** Class representing general information, statistics, content and submissions of a task */
class Task {
	/** General information on the task. */
	info: TaskInfo;
	/** Task statistics. */
	stats: TaskStatistics;
	/** Task content (from task page). */
	content: TaskContent;
	/** An array containing previously sent submissions. */
	submissions: Array<Submission> = [];
	/** An array containing the submissions sent now (from the API). */
	sentSubmissions: Array<Submission> = [];

	/**
	 * Create a task from partial or all general information.
	 * @param {TaskInfo} info General information about the task. Either task url or id is required.
	 * @example ```javascript
	 * new Task({ id: '341' }); // Get task from id
	 * ```
	 */
	constructor(info: TaskInfo) {
		const id =
			info.id ||
			(info.url &&
				info.url.match(/id=\d+/) &&
				info.url.match(/(?<=id=)\d+/)[0]);

		const url = info.url || (info.id && `https://mendo.mk/Task.do?id=${id}`);

		if (!id || !url) throw Error('No task id or url defined in parameters');

		info.id = id;
		info.url = url;

		info.statsUrl =
			info.statsUrl || `https://mendo.mk/TaskStatistics.do?id=${info.id}`;

		this.info = info;
	}

	/**
	 * Extract information from task, and place it in a public field inside the task object.
	 * @param {Array<string>} extractData An array containing the information to extract. (refer to the ExtractData type)
	 * @returns {Promise<Task>} The promise resolves with the modified task object.
	 * @example ```javascript
	 * const task = new Task({ id: '341' });
	 * await task.extract(['stats', 'content']);
	 * console.log({ statistics: task.stats, content: task.content });
	 * ```
	 */
	async extract(extractData: ExtractData): Promise<Task> {
		await Promise.all(
			extractData.map(async (v, i) => {
				switch (v) {
					case 'statistics':
					case 'stats':
						await this.getStats();
						break;
					case 'content':
					case 'name':
					case 'description':
					case 'input':
					case 'output':
					case 'constraints':
					case 'examples':
						await this.getContent();
						break;
				}
			})
		);

		return this;
	}

	/**
	 * Get task statistics, and place them inside the `Task.stats` public field.
	 * @private
	 * @returns {Promise<Task>}
	 */
	private async getStats(): Promise<Task> {
		const { data } = await axios.get(this.info.statsUrl);

		const $ = cheerio.load(data);

		const s: TaskStatistics = {
			sentSubmissions: +$('tr:nth-child(1) > td:nth-child(2)').text(),
			usersTried: +$('tr:nth-child(2) > td:nth-child(2)').text(),
			usersSolved: +$('tr:nth-child(3) > td:nth-child(2)').text(),
			solutions: +$('tr:nth-child(4) > td:nth-child(2)').text(),
			incorrectSubmissions: +$('tr:nth-child(5) > td:nth-child(2)').text(),
			compilerErrors: +$('tr:nth-child(6) > td:nth-child(2)').text(),
			runtimeErrors: +$('tr:nth-child(7) > td:nth-child(2)').text(),
			overLimit: +$('tr:nth-child(8) > td:nth-child(2)').text(),
		};

		this.stats = s;

		return this;
	}

	/**
	 * Get task content, and place them inside the `Task.content` public field.
	 * @private
	 * @returns {Promise<Task>}
	 */
	private async getContent(): Promise<Task> {
		const { data } = await axios.get(this.info.url);

		const $ = cheerio.load(data);

		let c: TaskContent = {
			name: $('.pagetitle').text(),
			description: '',
			input: '',
			output: '',
			constraints: {
				time: '',
				memory: '',
			},
			examples: [],
		};

		let lastImportant = '';
		let limitCounter = 0;
		$('.column1-unit')
			.children()
			.map((i, elem) => {
				const elText = $(elem).text().trim();

				const important = [
					'Влез',
					'Input',
					'Излез',
					'Output',
					'Ограничувања',
					'Constraints',
					'Примери',
					'Examples',
				];

				if (important.includes(elText)) {
					lastImportant = $(elem).text().trim();
					return;
				}

				switch (lastImportant) {
					case 'Влез':
					case 'Input':
						c.input += elText;
						break;
					case 'Излез':
					case 'Output':
						c.output += elText;
						break;
					case 'Ограничувања':
					case 'Constraints':
						if (limitCounter == 0) {
							const limitMatch = elText.match(/\d+ [^Ѐ-ЯA-Z]+/g);
							const limits: TaskConstraints = {
								time: limitMatch[0],
								memory: limitMatch[1],
							};
							c.constraints = limits;
						}
						limitCounter++;
						break;
					case 'Примери':
					case 'Examples':
						$(elem)
							.find('tr')
							.each((i, el) =>
								c.examples.push({
									input: $(el).find('td:nth-child(1) > pre').text(),
									output: $(el).find('td:nth-child(2) > pre').text(),
								})
							);
						break;
					default:
						c.description += elText;
						break;
				}
			});

		this.content = c;

		return this;
	}
}
export default Task;
