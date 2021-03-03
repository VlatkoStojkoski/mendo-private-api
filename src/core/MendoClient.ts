import cheerio from 'cheerio';
import axios from 'axios';
import qs from 'querystring';
import fs from 'fs';
import FormData from 'form-data';

import Task from './Task';
import {
	LoginCredentials,
	isLoginCredentials,
	RegisterCredentials,
	isRegisterCredentials,
	Submission,
	SubmissionError,
	SubmissionFeedback,
	SubmissionOptions,
	TaskInfoBase,
	CompetitionTaskInfo,
} from '../types';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

class MendoClient {
	constructor(cookie: string) {
		axios.defaults.baseURL = 'https://mendo.mk/';
		if (cookie) axios.defaults.headers.Cookie = cookie;
	}

	getCookie(): string {
		return axios.defaults.headers.Cookie;
	}

	async login(credentials: LoginCredentials): Promise<MendoClient> {
		if (!isLoginCredentials(credentials)) throw Error('Undefined credentials');

		await this.generateSession();

		const req = qs.stringify({ ...credentials });
		const res = await axios.post('Login.do', req, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const $ = cheerio.load(res.data);
		if ($('#username').length) throw Error('Invalid credentials: ' + req);

		return this;
	}
	async register(credentials: RegisterCredentials): Promise<MendoClient> {
		if (!isRegisterCredentials(credentials))
			throw Error('Undefined credentials');

		await this.generateSession();

		credentials.rpassword = credentials.password;

		const req = qs.stringify({ ...credentials });
		const res = await axios.post('SaveRegistration.do', req, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const $ = cheerio.load(res.data);
		const errorEl = $('.column1-unit > p');
		if (errorEl && errorEl.css('color') === 'red')
			throw Error(
				`${errorEl
					.html()
					.replace(/<br>/g, '\n')
					.replace(/&nbsp;/g, ' ')
					.trim()} (${req})`
			);

		return this;
	}

	async generateSession() {
		const { headers } = await axios.get('https://mendo.mk');

		const JSESSIONID = headers['set-cookie']
			.find((c) => c.startsWith('JSESSIONID'))
			.split(/(?<=;)/)[0];

		axios.defaults.headers.Cookie = JSESSIONID;

		return JSESSIONID;
	}

	async getSubmissions() {
		const uniquesubmissions = new Map();
		let currPage = 0;
		let pagesubmissions = 0;
		do {
			const { data } = await axios.get(
				`User_ListSubmissions.do?start=${currPage * 60}`
			);

			const $ = cheerio.load(data);

			pagesubmissions = 0;
			$('.training-content tr').each((i, elem) => {
				if (i == 0) return;

				const submission: Submission = {
					sentAt: $(elem).find('td:nth-child(3)').text().trim(),
					passedTests: $(elem).find('td:nth-child(4)').text().trim(),
					url:
						'https://mendo.mk' +
						$(elem).find('td:nth-child(5) > a').attr('href').slice(1),
				};

				const passedSides = submission.passedTests.split('/');
				const solved = +passedSides[0] == +passedSides[1];

				const taskName = $(elem)
					.find('td:nth-child(2) > a')
					.text()
					.slice(0, -2);

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

	async sendSubmission(options: SubmissionOptions) {
		const data = new FormData();
		data.append('taskId', options.taskId);
		data.append('solutionLanguage', options.language || -1);
		data.append('solutionFile', fs.createReadStream(options.submissionPath));

		const { request } = await axios.post('User_SubmitTask.do', data, {
			headers: {
				...data.getHeaders(),
			},
		});

		const resHeader = request.socket._httpMessage._header;
		const submissionURL =
			'https://mendo.mk' + resHeader.split('\n')[0].split(' ')[1];

		let $;
		do {
			const { data } = await axios.get(submissionURL);

			$ = cheerio.load(data);

			await sleep(options.interval || 500);
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

		const feedback: SubmissionFeedback = { tests, passedAll };

		const errorEl = $('#errorInfoMessage');
		if (errorEl.length) {
			const error: SubmissionError = {
				message: errorEl.text().trim(),
				error: $('table:nth-child(2) td > span:nth-child(6)')
					.html()
					.replace(/(&nbsp;)|(<\/?ioasdsadstream>)/g, '')
					.split('<br>')
					.map((l) => l.trim())
					.join('\n'),
			};

			feedback.error = error;
		}

		return feedback;
	}

	async *tasksByCategory(cid = 1) {
		const { data } = await axios.get(`Training.do?cid=${cid}`);
		const $ = cheerio.load(data);

		const trs = $('.main-content tbody > tr:nth-child(n+2)').toArray();
		for (const elem of trs) {
			if ($(elem).css('border') === '0') return;

			const basicInfo: TaskInfoBase = {
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
					yield new Task({
						...basicInfo,
						source: $('.main-content table > caption').text(),
						activity: $(elem).find('td:nth-child(3)').text(),
					});
					break;
				case 4:
					yield new Task({
						...basicInfo,
						source: $('.main-content table > caption').text(),
						activity: $(elem).find('td:nth-child(4)').text(),
					});
					break;
				default:
					yield new Task({
						...basicInfo,
						source: $(elem).find('td:nth-child(3)').text(),
						shortStats: $(elem).find('td:nth-child(5) > a').text(),
						statsUrl: $(elem)
							.find('td:nth-child(5) > a')
							.attr('href')
							.replace(/^\./, 'https://mendo.mk'),
					});
					break;
			}
		}
	}

	async *tasksByCompetition(id) {
		const { data } = await axios.get(`User_Competition.do?id=${id}`);
		const $ = cheerio.load(data);

		const trs = $('.main-content tbody > tr:nth-child(n+2)').toArray();
		for (const elem of trs) {
			const task: CompetitionTaskInfo = {
				order: parseInt($(elem).find('td:nth-child(1)').text()),
				name: $(elem).find('td:nth-child(2) > a').text(),
				url: $(elem)
					.find('td:nth-child(2) > a')
					.attr('href')
					.replace(/^\./, 'https://mendo.mk'),

				source: $('#maincompetitionpage.pagetitle').text(),
				totalPoints: parseInt($(elem).find('td:nth-child(3)').text()),
				testing: $(elem).find('td:nth-child(4)').text() !== 'НЕ',
				submission:
					$(elem).find('td:nth-child(5)').text().trim().length > 0
						? {
								points: parseInt(
									$(elem)
										.find('td:nth-child(5)')
										.text()
										.replace('поени', '')
										.trim()
								),
								url: $(elem).find('td:nth-child(5) > a').attr('href')
									? $(elem)
											.find('td:nth-child(5) > a')
											.attr('href')
											.replace(/^\./, 'https://mendo.mk')
									: '',
						  }
						: undefined,
			};

			task.solved =
				task.submission && task.submission.points === task.totalPoints;

			yield new Task(task);
		}
	}
}

export default MendoClient;
