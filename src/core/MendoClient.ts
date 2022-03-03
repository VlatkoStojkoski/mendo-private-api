import * as cheerio from 'cheerio';
import axios from 'axios';
import * as qs from 'querystring';
import * as FormData from 'form-data';

import Task from './Task';
import {
	LoginCredentials,
	isLoginCredentials,
	RegisterCredentials,
	isRegisterCredentials,
	Submission,
	SubmissionError,
	SubmissionOptions,
	TaskInfoBase,
	CompetitionTaskInfo,
} from '../types';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/** Class representing the API client used for making different requests */
class MendoClient {
	/**
	 * Create a client from given session cookie, or have the login/register function generate a session afterwards.
	 * @param {string} cookie A session cookie to use instead of generating a new cookie.
	 */
	constructor(cookie: string) {
		axios.defaults.baseURL = 'https://mendo.mk/';
		if (cookie) axios.defaults.headers.Cookie = cookie;
	}

	/**
	 * Get session cookie to use instead of logging in/registering every time.
	 * @returns {string} Returns session cookie.
	 * @example ```javascript
	 * // Get the cookie
	 * console.log(client.getCookie())
	 *
	 * // Use the cookie afterwards
	 * const client = new MendoClient('{insert cookie here}')
	 * ```
	 */
	getCookie(): string {
		return axios.defaults.headers.Cookie;
	}

	/**
	 * Generates a new session cookie, and authenticates cookie with a login request.
	 * @param {LoginCredentials} credentials Credentials used for logging in.
	 * @returns {Promise<MendoClient>} Returns client object with authenticated cookie.
	 * @example ```javascript
	 * await userClient.login({
	 * 	username: '{username here}',
	 * 	password: '{password here}',
	 * });
	 * ```
	 */
	async login(credentials: LoginCredentials): Promise<MendoClient> {
		if (!isLoginCredentials(credentials)) throw Error('Undefined credentials');

		await this.generateSession();

		const req = qs.stringify({ ...credentials });
		const res = await axios.post('Login.do', { ...req, rememberMe: 'on'}, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const $ = cheerio.load(res.data);
		if ($('#username').length) throw Error('Invalid credentials: ' + req);

		return this;
	}

	/**
	 * Generates a new session cookie, and authenticates cookie with a register request.
	 * @param {RegisterCredentials} credentials Credentials used for registering.
	 * @returns {Promise<MendoClient>} Returns client object with authenticated cookie.
	 * @example ```javascript
	 * await userClient.register({
	 * 	username: '{username here}',
	 * 	fullName: '{full name here}',
	 * 	email: '{email here}',
	 * 	password: '{password here}',
	 * 	city: '{city here}',
	 * 	country: {country number here}, // See #country options at https://mendo.mk/Register.do
	 * 	profession: '{profession here}',
	 * 	institution: '{institution here}',
	 * });
	 * ```
	 */
	async register(credentials: RegisterCredentials): Promise<MendoClient> {
		if (!isRegisterCredentials(credentials))
			throw Error('Undefined credentials');

		await this.generateSession();

		credentials.rpassword = credentials.password;

		const req = qs.stringify({ ...credentials });
		const res = await axios.post('SaveRegistration.do', { ...req, rememberMe: 'on'}, {
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

	/**
	 * Generates a new session cookie from the server.
	 * @returns {Promise<string>} Returned promise resolves with cookie string starting with "JSESSIONID=..."
	 */
	private async generateSession(): Promise<string> {
		const { headers } = await axios.get('https://mendo.mk');

		const JSESSIONID = headers['set-cookie']
			.find((c) => c.startsWith('JSESSIONID'))
			.split(/(?<=;)/)[0];

		axios.defaults.headers.Cookie = JSESSIONID;

		return JSESSIONID;
	}

	/**
	 * Sends submission and returns task object containing the test results.
	 * @param {SubmissionOptions} submissionOptions Object containing the task, language, code and checking interval.
	 * @returns {Promise<Task>} Returns task object containing the test results inside the public field `Task.sentSubmissions`.
	 * @example ```javascript
	 * await userClient.sendSubmission({
	 * 	task,
	 * 	code: fs.createReadStream('helloWorld.cpp'), // Make a read stream from file 'helloWorld.cpp'
	 * 	interval: 250, // The interval between checking for test results
	 * });
	 * ```
	 */
	async sendSubmission({
		task,
		language,
		code,
		interval,
	}: SubmissionOptions): Promise<Task> {
		const data = new FormData();
		data.append('taskId', task.info.id);
		data.append('solutionLanguage', language || -1);
		data.append('solutionFile', code);

		const { request } = await axios.post('User_SubmitTask.do', data, {
			headers: {
				...data.getHeaders(),
			},
		});

		const date = new Date(),
			dateFormatted = `${[
				date.getDate(),
				date.getMonth() + 1,
				date.getFullYear(),
			].join('/')} ${[date.getHours(), date.getMinutes()].join(':')}`;

		const resHeader = request.socket._httpMessage._header;
		const submissionUrl =
			'https://mendo.mk' + resHeader.split('\n')[0].split(' ')[1];

		let $;
		do {
			const { data } = await axios.get(submissionUrl);

			$ = cheerio.load(data);

			await sleep(interval || 500);
		} while ($('#ajaxdiv').length);

		const tests = [];
		let passedCount = 0;
		$('table:nth-child(6) tr td:nth-child(2)').each((i, elem) => {
			const passed = $(elem).attr('class') == 'correct';
			if (passed) passedCount++;
			tests.push({
				passed,
				message: $(elem).text().trim(),
			});
		});

		const errorEl = $('#errorInfoMessage');
		let error: SubmissionError = errorEl.length && {
			message: errorEl.text().trim(),
			error: $('table:nth-child(2) td > span:nth-child(6)')
				.html()
				.replace(/(&nbsp;)|(<\/?ioasdsadstream>)/g, '')
				.split('<br>')
				.map((l) => l.trim())
				.join('\n'),
		};

		const submission: Submission = {
			tests,
			passedTests: error ? 'СЕ/СЕ' : `${passedCount}/${tests.length}`,
			sentAt: dateFormatted,
			url: submissionUrl,
		};
		if (error) submission.error = error;

		task.sentSubmissions.push(submission);

		return task;
	}

	/**
	 * Get submsissions as children of corresponding tasks.
	 * @returns {Promise<Array<any>>} Returned promise contains an array of objects with the task name and previously sent submsisions.
	 */
	async getUniqueSubmissions(): Promise<Array<any>> {
		const uniqueSubmissions = new Map();
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

				if (uniqueSubmissions.has(taskName)) {
					const curr = uniqueSubmissions.get(taskName);
					uniqueSubmissions.set(taskName, {
						submissions: [...curr.submissions, submission],
						solved: curr.solved ? true : solved,
					});
				} else {
					uniqueSubmissions.set(taskName, {
						submissions: [submission],
						solved,
					});
				}

				pagesubmissions++;
			});

			currPage++;
		} while (pagesubmissions == 60);

		const submissions = [];
		for (const [taskName, info] of uniqueSubmissions.entries()) {
			submissions.push({ taskName, ...info });
		}

		return submissions;
	}

	/**
	 * Get sent submissions as iterable pages (arrays of task object).
	 * @returns {AsyncIterableIterator<Array<Task>>} Returns an async iterator containing page tasks.
	 */
	async *getSubmissions(): AsyncIterableIterator<Array<Task>> {
		let currPage = 0,
			pageSubmissions = 0;
		do {
			pageSubmissions = 0;
			const { data } = await axios.get(
				`User_ListSubmissions.do?start=${currPage * 60}`
			);
			const $ = cheerio.load(data);

			const tasks: Array<Task> = [];
			$('.training-content tr').each((i, elem) => {
				if (i == 0) return;

				const t: Task = new Task({
					name: $(elem).find('td:nth-child(2) > a').text().slice(0, -2),
					id: $(elem)
						.find('td:nth-child(2) > a')
						.attr('href')
						.match(/(?<=id=)\d+/)[0],
				});

				const submission: Submission = {
					sentAt: $(elem).find('td:nth-child(3)').text().trim(),
					passedTests: $(elem).find('td:nth-child(4)').text().trim(),
					url:
						'https://mendo.mk' +
						$(elem).find('td:nth-child(5) > a').attr('href').slice(1),
				};

				t.submissions.push(submission);
				tasks.push(t);
				pageSubmissions++;
			});

			yield tasks;

			currPage++;
		} while (pageSubmissions == 60);
	}

	/**
	 * Get tasks from category as async iterator.
	 * @param {number} cid Category id to get tasks from.
	 * @returns {AsyncIterableIterator<Task>} Returns an async iterator containing category tasks.
	 */
	async *tasksByCategory(cid = 1): AsyncIterableIterator<Task> {
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

	/**
	 * Get tasks from competition as async iterator.
	 * @param {number} id Competition id to get tasks from.
	 * @returns {AsyncIterableIterator<Task>} Returns an async iterator containing competition tasks.
	 */
	async *tasksByCompetition(id): AsyncIterableIterator<Task> {
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
