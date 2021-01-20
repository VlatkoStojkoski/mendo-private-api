const axios = require('axios');
const qs = require('querystring');
const cheerio = require('cheerio');

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

	get getCookie() {
		return this.cookie;
	}

	get getSolutions() {
		return this.solutions;
	}
};
