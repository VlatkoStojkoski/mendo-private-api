const axios = require('axios');
const qs = require('querystring');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');

const sleep = (time) => new Promise((res) => setTimeout(() => res(), time));

module.exports = class {
	async login(username, password) {
		try {
			await this.generateSession();

			const data = qs.stringify({ username, password });

			const config = {
				method: 'post',
				url: 'https://mendo.mk/Login.do',
				headers: {
					Cookie: this.cookie,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				data,
			};

			const res = await axios(config);

			const $ = cheerio.load(res.data);

			if ($('#username').length)
				throw new Error('Invalid credentials: ' + data);

			return res;
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}

	async generateSession() {
		try {
			const { headers } = await axios.get('https://mendo.mk');

			const JSESSIONID = headers['set-cookie']
				.find((c) => c.startsWith('JSESSIONID'))
				.split(/(?<=;)/)[0];

			this.cookie = JSESSIONID;

			return JSESSIONID;
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}

	async calcSolutions() {
		try {
			const baseUrl = 'https://mendo.mk/User_ListSubmissions.do?start=';
			let currPage = 0;

			const uniqueSolutions = new Map();
			let pageSolutions = 0;
			do {
				const { data } = await axios.get(baseUrl + currPage * 60, {
					headers: { Cookie: this.cookie },
				});
				const $ = cheerio.load(data);

				pageSolutions = 0;
				$('.training-content tr').each((i, elem) => {
					if (i == 0) return;

					const solution = {};
					solution.sentAt = $(elem).find('td:nth-child(3)').text().trim();
					solution.passedTests = $(elem).find('td:nth-child(4)').text().trim();
					solution.url =
						'https://mendo.mk' +
						$(elem).find('td:nth-child(5) > a').attr('href').slice(1);

					const taskName = $(elem)
						.find('td:nth-child(2) > a')
						.text()
						.slice(0, -2);
					const passedSides = solution.passedTests.split('/');
					const solved = +passedSides[0] == +passedSides[1];

					if (uniqueSolutions.has(taskName)) {
						const curr = uniqueSolutions.get(taskName);
						uniqueSolutions.set(taskName, {
							solutions: [...curr.solutions, solution],
							solved: curr.solved ? true : solved,
						});
					} else {
						uniqueSolutions.set(taskName, { solutions: [solution], solved });
					}

					pageSolutions++;
				});

				currPage++;
			} while (pageSolutions == 60);

			const solutions = [];
			for (const [taskName, info] of uniqueSolutions.entries()) {
				solutions.push({ taskName, ...info });
			}

			this.solutions = solutions;

			return solutions;
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}

	async submitSolution(taskId, solutionPath, language = '-1') {
		try {
			const data = new FormData();
			data.append('taskId', taskId);
			data.append('solutionLanguage', language);
			data.append('solutionFile', fs.createReadStream(solutionPath));

			const config = {
				method: 'post',
				url: 'https://mendo.mk/User_SubmitTask.do',
				headers: {
					Cookie: this.cookie,
					...data.getHeaders(),
				},
				data,
			};

			const { request } = await axios(config);

			const resHeader = request.socket._httpMessage._header;
			const submissionURL =
				'https://mendo.mk' + resHeader.split('\n')[0].split(' ')[1];

			let $;
			do {
				const { data } = await axios.get(submissionURL, {
					headers: {
						Cookie: this.cookie,
					},
				});

				$ = cheerio.load(data);

				await sleep(3000);
			} while ($('#ajaxdiv').length);

			const tests = [];
			let passedAll = true;
			$('table:nth-child(6) tr td:nth-child(2)').each((i, elem) => {
				const passed = $(elem).attr('class') == 'correct';
				if (!passed) passedAll = false;
				tests.push({
					passed,
					message: $(elem).text().trim(),
				});
			});

			const feedback = { tests, passedAll };

			const errorEl = $('#errorInfoMessage');
			if (errorEl.length) {
				const error = {};
				error.message = errorEl.text().trim();
				error.error = $('table:nth-child(2) td > span:nth-child(6)')
					.html()
					.replace(/(&nbsp;)|(<\/?ioasdsadstream>)/g, '')
					.split('<br>')
					.map((l) => l.trim())
					.join('\n');
				feedback.error = error;
			}

			return feedback;
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}

	get getCookie() {
		return this.cookie;
	}

	get getSolutions() {
		return this.solutions;
	}
};
