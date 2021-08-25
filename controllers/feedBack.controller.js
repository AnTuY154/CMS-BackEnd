const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');
const { validationResult } = require('express-validator');

const getFeedBackClass = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			feedback.feedback_id as id, users.full_name ,a.class_name,a.teacher_name,feedback.status as feedback_status,
			feedback.feedback,to_char(feedback.created_at,'YYYY-MM-dd') as date from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select class_id,class_name,users.full_name as teacher_name 
			from class inner join users on users.user_id = class.teacher_id
			where class.teacher_id  ${filter2 === '' ? '!' : ''}= $1
			and class.class_id ${filter1 === '' ? '!' : ''}= $2
			) a
			on a.class_id = feedback.class_id
        order by feedback.status ASC, feedback.created_at DESC LIMIT $3 OFFSET $4
		`;
		const param = [filter2, filter1, limit, offset];
		const data = await pool.query(query, param);
		const result = {
			data: data.rows,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
			},
		};
		return res.status(200).json(result);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getCountFeedBackClass = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			count(feedback.feedback_id)
		from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select class_id,class_name,users.full_name as teacher_name 
			from class inner join users on users.user_id = class.teacher_id
			where class.teacher_id  ${filter1 === '' ? '!' : ''}= $1
			and class.class_id ${filter2 === '' ? '!' : ''}= $2
			) a
			on a.class_id = feedback.class_id
		`;
		const param = [filter1, filter2];
		const results = await pool.query(query, param);
		return res.status(200).json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getClassesSelect = async (req, res, next) => {
	let classes;
	try {
		const query = `SELECT class_id as value, class_name as text FROM class where flag =false`;
		classes = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassesSelect'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

const updateFeedBackStatus = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { feedback_id, status } = req.body;

	try {
		const results = await pool.query(
			`
			UPDATE public.feedback
			SET   	modified_by=$1,
					modified_at=$2, 
					status=$4
			WHERE feedback.feedback_id=$3;
		`,
			[userId, datetime, feedback_id, status]
		);
		if (results.rowCount == 0) {
			const error = new HttpError('Không tồn tại feed back id', 404);
			return next(error);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'updateCourseFlag'
		);
		return next(error);
	}
	res.json({ message: 'Cập nhật thành công' });
};

const getFeedBackCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			feedback.feedback_id as id, users.full_name ,a.course_name as class_name,a.teacher_name,feedback.status as feedback_status,
			feedback.feedback,to_char(feedback.created_at,'YYYY-MM-dd') as date from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select course_id,course_name,users.full_name as teacher_name 
			from course inner join users on users.user_id = course.created_by
			where course.created_by  ${filter2 === '' ? '!' : ''}= $1
			and course.course_id ${filter1 === '' ? '!' : ''}= $2
			) a
			on a.course_id = feedback.course_id
        order by feedback.status ASC, date DESC LIMIT $3 OFFSET $4
		`;
		const param = [filter2, filter1, limit, offset];
		const data = await pool.query(query, param);
		const result = {
			data: data.rows,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
			},
		};
		return res.status(200).json(result);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getCountFeedBackCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			count(feedback.feedback_id)
			from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select course_id,course_name,users.full_name as teacher_name 
			from course inner join users on users.user_id = course.created_by
			where course.created_by  ${filter2 === '' ? '!' : ''}= $1
			and course.course_id ${filter1 === '' ? '!' : ''}= $2
			) a
			on a.course_id = feedback.course_id
		`;
		const param = [filter1, filter2];
		const results = await pool.query(query, param);
		return res.status(200).json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getCourseSelect = async (req, res, next) => {
	let classes;
	try {
		const query = `SELECT course_id as value, title as text FROM course where flag =false AND status='1'`;
		classes = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassesSelect'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

const sendFeedback = async (req, res, next) => {
	const userId = req.userData.userId;
	const role = req.userData.role;
	const { classId, feedback } = req.body;

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	if (role !== '5') {
		const error = new HttpError('Bạn không có quyền truy cập trang này.', 403);
		return next(error);
	}

	let checkPermiss;
	try {
		const query = `SELECT class_id FROM class_student WHERE class_id = $1 AND student_id = $2`;
		const params = [classId, userId];

		checkPermiss = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'sendFeedback'
		);
		return next(error);
	}

	if (checkPermiss.rowCount < 1) {
		const error = new HttpError('Bạn không có quyền truy cập trang này', 403);
		return next(error);
	}

	try {
		const query = `INSERT INTO feedback(
			feedback_id, writer_id, class_id, feedback, status)
			VALUES (nextval('feedback_id'), $1, $2, $3, $4)`;
		const params = [userId, classId, feedback, '0'];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'sendFeedback'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Gửi phản hồi thành công' });
};

module.exports = {
	getCountFeedBackCourse,
	getCourseSelect,
	getFeedBackCourse,
	updateFeedBackStatus,
	getFeedBackClass,
	getCountFeedBackClass,
	getClassesSelect,
	sendFeedback,
};
