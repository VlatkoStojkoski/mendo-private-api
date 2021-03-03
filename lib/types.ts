import { ReadStream } from 'fs';

export interface TaskStatistics {
	sentSubmissions: number;
	usersTried: number;
	usersSolved: number;
	solutions: number;
	incorrectSubmissions: number;
	compilerErrors: number;
	runtimeErrors: number;
	overLimit: number;
}

export interface TaskInfoBase {
	id?: string;
	url?: string;
	order?: number;
	name?: string;
	solved?: boolean;
	source?: string;
	statsUrl?: string;
}

interface CompetitionSubmission {
	points: number;
	url: string;
}

export interface CompetitionTaskInfo extends TaskInfoBase {
	totalPoints: number;
	testing: boolean;
	submission: CompetitionSubmission;
}

export interface CategoryTaskInfo extends TaskInfoBase {
	shortStats: string;
}

export interface TeachingCategoryTaskInfo extends TaskInfoBase {
	activity: string;
}

export type TaskInfo =
	| TaskInfoBase
	| CompetitionTaskInfo
	| CategoryTaskInfo
	| TeachingCategoryTaskInfo;

export interface ExampleCase {
	input: string;
	output: string;
}

export interface TaskLimits {
	time: string;
	memory: string;
}

export interface TaskContent {
	name: string;
	description: string;
	input: string;
	output: string;
	examples: Array<ExampleCase>;
	limits: TaskLimits;
}

export interface MendoUserClient {
	cookie: string;
}

export interface LoginCredentials {
	username: string;
	password: string;
}

export function isLoginCredentials(
	credentials: LoginCredentials
): credentials is LoginCredentials {
	const mustDefined = ['username', 'password'];

	return (
		mustDefined.filter(
			(v) => (credentials as LoginCredentials)[v] === undefined
		).length === 0
	);
}

export interface RegisterCredentials {
	username: string;
	password: string;
	rpassword?: string;
	email: string;
	fullName: string;
	city: string;
	country: string;
	profession: string;
	institution: string;
}

export function isRegisterCredentials(
	credentials: RegisterCredentials
): credentials is RegisterCredentials {
	const mustDefined = [
		'username',
		'password',
		'email',
		'fullName',
		'city',
		'country',
		'profession',
		'institution',
	];

	return (
		mustDefined.filter(
			(v) => (credentials as RegisterCredentials)[v] === undefined
		).length === 0
	);
}

export interface Submission {
	sentAt: string;
	passedTests: string;
	url: string;
}

interface SubmissionOptionsBasics {
	taskId: string;
	language?: number;
	interval?: number;
}

export interface SubmissionOptionsWithPath extends SubmissionOptionsBasics {
	submissionPath: string;
	submissionStream: undefined;
}

export interface SubmissionOptionsWithStream extends SubmissionOptionsBasics {
	submissionStream: ReadStream;
	submissionPath: undefined;
}

export type SubmissionOptions =
	| SubmissionOptionsWithPath
	| SubmissionOptionsWithStream;

export interface SubmissionError {
	message: string;
	error: string;
}

interface SubmissionTest {
	passed: boolean;
	message: string;
}

export interface SubmissionFeedback {
	tests: Array<SubmissionTest>;
	passedAll: boolean;
	error?: SubmissionError;
}
