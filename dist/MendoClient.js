"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cheerio_1 = __importDefault(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
const querystring_1 = __importDefault(require("querystring"));
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const Task_1 = __importDefault(require("./Task"));
const types_1 = require("./types");
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
class default_1 {
    constructor(cookie) {
        axios_1.default.defaults.baseURL = 'https://mendo.mk/';
        if (cookie)
            axios_1.default.defaults.headers.Cookie = cookie;
    }
    getCookie() {
        return axios_1.default.defaults.headers.Cookie;
    }
    login(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!types_1.isLoginCredentials(credentials))
                throw Error('Undefined credentials');
            yield this.generateSession();
            const req = querystring_1.default.stringify(Object.assign({}, credentials));
            const res = yield axios_1.default.post('Login.do', req, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const $ = cheerio_1.default.load(res.data);
            if ($('#username').length)
                throw Error('Invalid credentials: ' + req);
            return res;
        });
    }
    register(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!types_1.isRegisterCredentials(credentials))
                throw Error('Undefined credentials');
            yield this.generateSession();
            credentials.rpassword = credentials.password;
            const req = querystring_1.default.stringify(Object.assign({}, credentials));
            const res = yield axios_1.default.post('SaveRegistration.do', req, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const $ = cheerio_1.default.load(res.data);
            const errorEl = $('.column1-unit > p');
            if (errorEl && errorEl.css('color') === 'red')
                throw Error(`${errorEl
                    .html()
                    .replace(/<br>/g, '\n')
                    .replace(/&nbsp;/g, ' ')
                    .trim()} (${req})`);
            return res;
        });
    }
    generateSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const { headers } = yield axios_1.default.get('https://mendo.mk');
            const JSESSIONID = headers['set-cookie']
                .find((c) => c.startsWith('JSESSIONID'))
                .split(/(?<=;)/)[0];
            axios_1.default.defaults.headers.Cookie = JSESSIONID;
            return JSESSIONID;
        });
    }
    getSubmissions() {
        return __awaiter(this, void 0, void 0, function* () {
            const uniquesubmissions = new Map();
            let currPage = 0;
            let pagesubmissions = 0;
            do {
                const { data } = yield axios_1.default.get(`User_ListSubmissions.do?start=${currPage * 60}`);
                const $ = cheerio_1.default.load(data);
                pagesubmissions = 0;
                $('.training-content tr').each((i, elem) => {
                    if (i == 0)
                        return;
                    const submission = {
                        sentAt: $(elem).find('td:nth-child(3)').text().trim(),
                        passedTests: $(elem).find('td:nth-child(4)').text().trim(),
                        url: 'https://mendo.mk' +
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
                    }
                    else {
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
                submissions.push(Object.assign({ taskName }, info));
            }
            return submissions;
        });
    }
    sendSubmission(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = new form_data_1.default();
            data.append('taskId', options.taskId);
            data.append('solutionLanguage', options.language || -1);
            data.append('solutionFile', fs_1.default.createReadStream(options.submissionPath));
            const { request } = yield axios_1.default.post('User_SubmitTask.do', data, {
                headers: Object.assign({}, data.getHeaders()),
            });
            const resHeader = request.socket._httpMessage._header;
            const submissionURL = 'https://mendo.mk' + resHeader.split('\n')[0].split(' ')[1];
            let $;
            do {
                const { data } = yield axios_1.default.get(submissionURL);
                $ = cheerio_1.default.load(data);
                yield sleep(options.interval || 500);
            } while ($('#ajaxdiv').length);
            const tests = [];
            let passedAll = true;
            $('table:nth-child(6) tr td:nth-child(2)').each((i, elem) => {
                const passed = $(elem).attr('class') == 'correct';
                if (!passed)
                    passedAll = false;
                tests.push({
                    passed,
                    message: $(elem).text().trim(),
                });
            });
            const feedback = { tests, passedAll };
            const errorEl = $('#errorInfoMessage');
            if (errorEl.length) {
                const error = {
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
        });
    }
    tasksByCategory(cid = 1) {
        return __asyncGenerator(this, arguments, function* tasksByCategory_1() {
            const { data } = yield __await(axios_1.default.get(`Training.do?cid=${cid}`));
            const $ = cheerio_1.default.load(data);
            const trs = $('.main-content tbody > tr:nth-child(n+2)').toArray();
            for (const elem of trs) {
                if ($(elem).css('border') === '0')
                    return yield __await(void 0);
                const basicInfo = {
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
                        yield yield __await(new Task_1.default(Object.assign(Object.assign({}, basicInfo), { source: $('.main-content table > caption').text(), activity: $(elem).find('td:nth-child(3)').text() })));
                        break;
                    case 4:
                        yield yield __await(new Task_1.default(Object.assign(Object.assign({}, basicInfo), { source: $('.main-content table > caption').text(), activity: $(elem).find('td:nth-child(4)').text() })));
                        break;
                    default:
                        yield yield __await(new Task_1.default(Object.assign(Object.assign({}, basicInfo), { source: $(elem).find('td:nth-child(3)').text(), shortStats: $(elem).find('td:nth-child(5) > a').text(), statsUrl: $(elem)
                                .find('td:nth-child(5) > a')
                                .attr('href')
                                .replace(/^\./, 'https://mendo.mk') })));
                        break;
                }
            }
        });
    }
    tasksByCompetition(id) {
        return __asyncGenerator(this, arguments, function* tasksByCompetition_1() {
            const { data } = yield __await(axios_1.default.get(`User_Competition.do?id=${id}`));
            const $ = cheerio_1.default.load(data);
            const trs = $('.main-content tbody > tr:nth-child(n+2)').toArray();
            for (const elem of trs) {
                const task = {
                    order: parseInt($(elem).find('td:nth-child(1)').text()),
                    name: $(elem).find('td:nth-child(2) > a').text(),
                    url: $(elem)
                        .find('td:nth-child(2) > a')
                        .attr('href')
                        .replace(/^\./, 'https://mendo.mk'),
                    source: $('#maincompetitionpage.pagetitle').text(),
                    totalPoints: parseInt($(elem).find('td:nth-child(3)').text()),
                    testing: $(elem).find('td:nth-child(4)').text() !== 'НЕ',
                    submission: $(elem).find('td:nth-child(5)').text().trim().length > 0
                        ? {
                            points: parseInt($(elem)
                                .find('td:nth-child(5)')
                                .text()
                                .replace('поени', '')
                                .trim()),
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
                yield yield __await(new Task_1.default(task));
            }
        });
    }
}
exports.default = default_1;
