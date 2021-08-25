const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const {
	autoGenerateUsername,
	generateDefaultPassword,
	checkRole,
} = require('../common/function');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const validator = require('validator').default;
const { validateIsEmpty } = require('../common/validate');

const getTutors = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, q, status, subject } = req.query;

	const offset = (page - 1) * 10;

	let count;
	try {
		const query = `SELECT COUNT(user_id) as total FROM users WHERE role_id = '4'`;
		count = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'getTutors'
		);
		return next(error);
	}

	if (count.rowCount < 1) {
		return res.status(200).json({ message: 'Không tìm thấy dữ liệu' });
	}

	let tutors;
	try {
		const query = `select * from (													
            select users.created_at,users.user_id, users.avt_link, users.full_name,users.status,LOWER(users.gender) as gender,users.phone,string_agg(subject.subject_name , ',') as teacher_subject,string_agg(subject.subject_id , ',') as teacher_subject_id,users.address,users.flag from users													
            inner join teacher_subject on users.user_id =teacher_subject.teacher_id													
            inner join subject on teacher_subject.subject_id =subject.subject_id													
            where users.role_id = '4'													
            group by users.user_id													
            ) a													
            where  a.teacher_subject_id like LOWER($1) and a.status ${
							status === '' ? '!' : ''
						}=$2  and (LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4) )													
            order by a.created_at, a.status DESC OFFSET $5 LIMIT 10`;
		const param = [
			'%' + subject + '%',
			status,
			'%' + q + '%',
			'%' + q + '%',
			offset,
		];
		tutors = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'getTutors'
		);
		return next(error);
	}

	const result = {
		data: tutors.rows,
		pagination: {
			limit: 10,
			page: parseInt(page),
			totalRows: count.rows[0].total,
		},
	};
	return res.status(200).json(result);
};

const getTutorById = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const tutorId = req.params.tutorId;

	let tutor;
	try {
		const query = `Select users.user_id,users.full_name,users.display_name,users.last_login,					
		users.created_at,LOWER(users.gender) as gender,users.email,users.phone,users.address,users.flag,				
		users.avt_link,users.note, users.status from users where flag = false and user_id=$1 AND role_id='4' AND status = '1' LIMIT 1`;
		const params = [tutorId];

		tutor = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'getTutorById'
		);
		return next(error);
	}

	if (tutor.rowCount < 1) {
		const error = new HttpError('Không tìm thấy trợ giảng', 404);
		return next(error);
	}

	return res.status(200).json(tutor.rows[0]);
};

const createTutor = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_create_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const userId = req.userData.userId;
	const {
		full_name,
		display_name,
		email,
		phone,
		address,
		note,
		gender,
		subject,
	} = req.body;

	if (email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 LIMIT 1`;
			const params = [email];

			check = await pool.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'tutor.controller.js',
				'createTutor'
			);
			return next(error);
		}

		if (check.rowCount > 0) {
			const error = new HttpError(
				'Địa chị email đã tồn tại, vui lòng thử lại',
				422
			);
			return next(error);
		}
	}

	const defaultPassword = await generateDefaultPassword();
	const usercode = autoGenerateUsername(full_name);
	let tutor;
	try {
		const query = `INSERT INTO users(											
			user_id, username, password, role_id, full_name, display_name, email, phone, address, created_by, modified_by, note, gender, type, avt_link, status)										
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id`;

		const params = [
			usercode,
			usercode,
			defaultPassword,
			'4',
			full_name,
			display_name,
			email,
			phone,
			address,
			userId,
			userId,
			note,
			gender,
			'1',
			'https://i.pravatar.cc',
			'1',
		];

		tutor = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'createTutor'
		);
		return next(error);
	}

	if (subject.length > 0) {
		try {
			for (let i = 0; i < subject.length; i++) {
				const query = `INSERT INTO teacher_subject(						
					teacher_id, subject_id)					
					VALUES ($1, $2)`;
				const params = [tutor.rows[0].user_id, subject[i]];
				await pool.query(query, params);
			}
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'tutor.controller.js',
				'createTutor'
			);
			return next(error);
		}
	}

	return res
		.status(200)
		.json({ message: `Thêm mới trợ giảng thành công, tài khoản: ${usercode}` });
};

const updateTutor = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const userId = req.userData.userId;
	const tutorId = req.params.tutorId;
	const { profile, tutorsubject, defaultTutorSubject } = req.body;

	if (
		!validateIsEmpty(profile.full_name) ||
		!validateIsEmpty(profile.display_name) ||
		!validateIsEmpty(profile.email) ||
		!validateIsEmpty(profile.phone) ||
		!validateIsEmpty(profile.gender)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validator.matches(profile.phone, /^[0-9]+$/) ||
		!validator.isEmail(profile.email) ||
		(profile.gender.toLowerCase() !== 'male' &&
			profile.gender.toLowerCase() !== 'female')
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	for (let i = 0; i < defaultTutorSubject.length; i++) {
		if (!validateIsEmpty(defaultTutorSubject[i].subject_id)) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	for (let i = 0; i < tutorsubject.length; i++) {
		if (!validateIsEmpty(tutorsubject[i])) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	if (profile.email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [profile.email, tutorId];

			check = await pool.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'tutor.controller.js',
				'updateTutor'
			);
			return next(error);
		}

		if (check.rowCount > 0) {
			const error = new HttpError(
				'Địa chị email đã tồn tại, vui lòng thử lại',
				422
			);
			return next(error);
		}
	}

	try {
		const query = `UPDATE users	SET full_name=$1, display_name=$2, email=$3, phone=$4, address=$5, modified_by=$6, modified_at=$7, note= $8, gender=$9, status=$10								
			WHERE user_id = $11`;
		const params = [
			profile.full_name,
			profile.display_name,
			profile.email,
			profile.phone,
			profile.address,
			userId,
			new Date(),
			profile.note,
			profile.gender,
			profile.status,
			tutorId,
		];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'updateTutor'
		);
		return next(error);
	}

	try {
		for (let i = 0; i < defaultTutorSubject.length; i++) {
			const index = tutorsubject.findIndex(
				(ts) => ts === defaultTutorSubject[i].subject_id
			);
			if (index === -1) {
				const query = `DELETE FROM teacher_subject
                WHERE teacher_id = $1 and subject_id = $2`;
				const params = [tutorId, defaultTutorSubject[i].subject_id];

				await pool.query(query, params);
			} else {
				tutorsubject.splice(index, 1);
			}
		}

		if (tutorsubject.length > 0) {
			for (let j = 0; j < tutorsubject.length; j++) {
				const query = `INSERT INTO teacher_subject(						
                        teacher_id, subject_id)					
                        VALUES ($1, $2)`;
				const params = [tutorId, tutorsubject[j]];

				await pool.query(query, params);
			}
		}
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'updateTutor'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const deleteTutor = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const tutorId = req.params.tutorId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '0', tutorId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'deleteTutor'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreTutor = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const tutorId = req.params.tutorId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '1', tutorId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'tutor.controller.js',
			'restoreTutor'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

module.exports = {
	getTutors,
	getTutorById,
	createTutor,
	updateTutor,
	deleteTutor,
	restoreTutor,
};
