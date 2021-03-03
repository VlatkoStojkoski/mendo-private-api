import axios from 'axios';
import cheerio from 'cheerio';

import { TaskStatistics, TaskInfo, TaskContent, TaskLimits } from '../types';

class Task {
	info: TaskInfo;
	stats: TaskStatistics;
	content: TaskContent;

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

	async extract(extractData: Array<string>) {
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
					case 'limits':
					case 'examples':
						await this.getContent();
						break;
				}
			})
		);

		return this;
	}

	async getStats() {
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

	async getContent() {
		const { data } = await axios.get(this.info.url);

		const $ = cheerio.load(data);

		let c: TaskContent = {
			name: $('.pagetitle').text(),
			description: '',
			input: '',
			output: '',
			limits: {
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
							const limits: TaskLimits = {
								time: limitMatch[0],
								memory: limitMatch[1],
							};
							c.limits = limits;
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
