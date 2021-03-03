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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = __importDefault(require("cheerio"));
class Task {
    constructor(info) {
        const id = info.id ||
            (info.url &&
                info.url.match(/id=\d+/) &&
                info.url.match(/(?<=id=)\d+/)[0]);
        const url = info.url || (info.id && `https://mendo.mk/Task.do?id=${id}`);
        if (!id || !url)
            throw Error('No task id or url defined in parameters');
        info.id = id;
        info.url = url;
        info.statsUrl =
            info.statsUrl || `https://mendo.mk/TaskStatistics.do?id=${info.id}`;
        this.info = info;
    }
    extract(extractData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(extractData.map((v, i) => __awaiter(this, void 0, void 0, function* () {
                switch (v) {
                    case 'statistics':
                    case 'stats':
                        yield this.getStats();
                        break;
                    case 'content':
                    case 'name':
                    case 'description':
                    case 'input':
                    case 'output':
                    case 'limits':
                    case 'examples':
                        yield this.getContent();
                        break;
                }
            })));
            return this;
        });
    }
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.get(this.info.statsUrl);
            const $ = cheerio_1.default.load(data);
            const s = {
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
        });
    }
    getContent() {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield axios_1.default.get(this.info.url);
            const $ = cheerio_1.default.load(data);
            let c = {
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
                            const limits = {
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
                            .each((i, el) => c.examples.push({
                            input: $(el).find('td:nth-child(1) > pre').text(),
                            output: $(el).find('td:nth-child(2) > pre').text(),
                        }));
                        break;
                    default:
                        c.description += elText;
                        break;
                }
            });
            this.content = c;
            return this;
        });
    }
}
exports.default = Task;
