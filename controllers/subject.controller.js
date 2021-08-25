const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');

const getSubjects = async (req, res, next) => {
	let subjects;
	try {
		const query = `SELECT subject_id, subject_name,description FROM subject where subject.flag=false`;
		subjects = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'subject.controller.js',
			'getAllSubjects'
		);
		return next(error);
	}

	return res.status(200).json(subjects.rows);
};

const getSubjectsByTeacherId = async (req, res, next) => {
	const teacherId = req.params.teacherId;
	let subjects;
	try {
		const query = `SELECT teacher_id, teacher_subject.subject_id, subject.subject_name					
		FROM public.teacher_subject, public.subject				
		where subject.subject_id = teacher_subject.subject_id and teacher_id = $1`;
		const param = [teacherId];
		subjects = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'subject.controller.js',
			'getSubjectsByTeacherId'
		);
		return next(error);
	}

	return res.status(200).json(subjects.rows);
};

const updateSubject = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(
		role,
		'function_setting_subject_category'
	);
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { current_list, insert_list } = req.body;
	for (let i = 0; i < insert_list.length; i++) {
		try {
			await pool.query(
				`
					INSERT INTO public.subject(
						subject_id, 
						subject_name, 
						created_by,
						description)
						VALUES ( 
							nextval('subject_id'),
							$1, $2, $3);
					`,
				[insert_list[i].subject_name, userId, insert_list[i].description]
			);
		} catch (err) {
			const error = new HttpError(
				'Something went wrong, please try again',
				500
			);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'subject.controller.js',
				'updateSubject'
			);
			return next(error);
		}
	}

	for (let i = 0; i < current_list.length; i++) {
		try {
			await pool.query(
				`
					UPDATE public.subject
					SET  
						subject_name=$1,
						modified_by=$2,
						modified_at=$3, 
						description=$4
					WHERE subject_id=$5;
					`,
				[
					current_list[i].subject_name,
					userId,
					datetime,
					current_list[i].description,
					current_list[i].id,
				]
			);
		} catch (err) {
			const error = new HttpError(
				'Something went wrong, please try again',
				500
			);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'subject.controller.js',
				'updateSubject'
			);
			return next(error);
		}
	}

	return res.status(200).json({ message: 'Thêm môn học thành công' });
};

const updateSubjectFlagD = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(
		role,
		'function_setting_subject_category'
	);
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { subject_id } = req.body;
	try {
		await pool.query(
			`
			UPDATE public.subject
			SET  
				modified_by=$1, 
				modified_at=$2, 
				flag=true
			WHERE subject_id=$3
	`,
			[userId, datetime, subject_id]
		);
		res.json({ message: 'Delete successfully' });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'subject.controller.js',
			'updateSubjectFlagD'
		);
		return next(error);
	}
};

module.exports = {
	getSubjects,
	getSubjectsByTeacherId,
	updateSubject,
	updateSubjectFlagD,
};
