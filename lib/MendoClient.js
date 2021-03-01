const axios = require('axios');
const qs = require('querystring');
const cheerio = require('cheerio');
const FormData = require('form-data');
const fs = require('fs');

const sleep = (time) => new Promise((res) => setTimeout(() => res(), time));

module.exports = class {
	async login(username, password) {
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

		if ($('#username').length) throw Error('Invalid credentials: ' + data);

		return res;
	}

	async register({
		username,
		fullName,
		email,
		password,
		city,
		country,
		profession,
		institution,
	}) {
		await this.generateSession();

		fullName = fullName.replace(' ', '+');
		const req =
			`username=${username}&fullName=${fullName}` +
			`&email=${email}&password=${password}&rpassword=${password}` +
			`&city=${city || 'Скопје'}&country=${country || '102'}&` +
			`profession=${profession || 'Ученик'}&institution=${
				institution || 'Училиште'
			}`;

		const config = {
			method: 'post',
			url: 'https://mendo.mk/SaveRegistration.do',
			headers: {
				Cookie: this.cookie,
			},
			data: req,
		};

		const res = await axios(config);

		const $ = cheerio.load(res.data);

		const errorEl = $('.column1-unit > p');
		if (errorEl && errorEl.css('color') === 'red')
			throw Error(
				errorEl
					.html()
					.replace(/<br>/g, '\n')
					.replace(/&nbsp;/g, ' ')
					.trim()
			);

		return res;
	}

	async generateSession() {
		const { headers } = await axios.get('https://mendo.mk');

		const JSESSIONID = headers['set-cookie']
			.find((c) => c.startsWith('JSESSIONID'))
			.split(/(?<=;)/)[0];

		this.cookie = JSESSIONID;

		return JSESSIONID;
	}

	async getSubmissions() {
		const baseUrl = 'https://mendo.mk/User_ListSubmissions.do?start=';
		let currPage = 0;

		const uniquesubmissions = new Map();
		let pagesubmissions = 0;
		do {
			const { data } = await axios.get(baseUrl + currPage * 60, {
				headers: { Cookie: this.cookie },
			});
			const $ = cheerio.load(data);

			pagesubmissions = 0;
			$('.training-content tr').each((i, elem) => {
				if (i == 0) return;

				const submission = {};
				submission.sentAt = $(elem).find('td:nth-child(3)').text().trim();
				submission.passedTests = $(elem).find('td:nth-child(4)').text().trim();
				submission.url =
					'https://mendo.mk' +
					$(elem).find('td:nth-child(5) > a').attr('href').slice(1);

				const taskName = $(elem)
					.find('td:nth-child(2) > a')
					.text()
					.slice(0, -2);
				const passedSides = submission.passedTests.split('/');
				const solved = +passedSides[0] == +passedSides[1];

				if (uniquesubmissions.has(taskName)) {
					const curr = uniquesubmissions.get(taskName);
					uniquesubmissions.set(taskName, {
						submissions: [...curr.submissions, submission],
						solved: curr.solved ? true : solved,
					});
				} else {
					uniquesubmissions.set(taskName, {
						submissions: [submission],
						solved,
					});
				}

				pagesubmissions++;
			});

			currPage++;
		} while (pagesubmissions == 60);

		const submissions = [];
		for (const [taskName, info] of uniquesubmissions.entries()) {
			submissions.push({ taskName, ...info });
		}

		return submissions;
	}

	async sendSubmission(taskId, solutionPath, language = '-1') {
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
	}

	async tasksByCategory(cid = 1) {
		const url = `https://mendo.mk/Training.do?cid=${cid}`;

		const { data } = await axios.get(url, {
			headers: { Cookie: this.cookie },
		});
		const $ = cheerio.load(data);

		const submissions = [];
		$('.main-content tbody > tr:nth-child(n+2)').each((i, elem) => {
			if ($(elem).css('border') === '0') return;

			const obj = {
				order: parseInt($(elem).find('td:nth-child(1)').text()),
				name: $(elem).find('td:nth-child(2) > a').text(),
				url: $(elem)
					.find('td:nth-child(2) > a')
					.attr('href')
					.replace(/^\./, 'https://mendo.mk'),
				solved: $(elem).find('td:nth-child(1)').hasClass('solved'),
			};

			switch ($(elem).find('td').length) {
				case 3:
					obj.type = $(elem).find('td:nth-child(3)').text();
					break;
				case 4:
					obj.source = $(elem).find('td:nth-child(3)').text();
					obj.type = $(elem).find('td:nth-child(4)').text();
					break;
				default:
					obj.source = $(elem).find('td:nth-child(3)').text();
					obj.stats = $(elem).find('td:nth-child(5) > a').text();
					obj.statsUrl = $(elem)
						.find('td:nth-child(5) > a')
						.attr('href')
						.replace(/^\./, 'https://mendo.mk');
					break;
			}

			submissions.push(obj);
		});

		return submissions;
	}

	async tasksByCompetition(id) {
		const url = `https://mendo.mk/User_Competition.do?id=${id}`;

		const { data } = await axios.get(url, {
			headers: { Cookie: this.cookie },
		});
		const $ = cheerio.load(data);

		const submissions = [];
		$('.main-content tbody > tr:nth-child(n+2)').each((i, elem) => {
			submissions.push({
				order: parseInt($(elem).find('td:nth-child(1)').text()),
				name: $(elem).find('td:nth-child(2) > a').text(),
				url: $(elem)
					.find('td:nth-child(2) > a')
					.attr('href')
					.replace(/^\./, 'https://mendo.mk'),
				totalPoints: $(elem).find('td:nth-child(3)').text(),
				testing: $(elem).find('td:nth-child(4)').text(),
				submissionPoints: $(elem)
					.find('td:nth-child(5)')
					.text()
					.replace('поени', '')
					.trim(),
				submissionUrl: $(elem).find('td:nth-child(5) > a').attr('href')
					? $(elem)
							.find('td:nth-child(5) > a')
							.attr('href')
							.replace(/^\./, 'https://mendo.mk')
					: '',
			});
		});

		return submissions;
	}

	get getSession() {
		return this.cookie;
	}
};
