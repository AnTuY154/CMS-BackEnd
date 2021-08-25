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

const getTeachers = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_teacher');
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
		const query = `SELECT COUNT(user_id) as total FROM users WHERE role_id = '3'`;
		count = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'getTeachers'
		);
		return next(error);
	}

	if (count.rowCount < 1) {
		return res.status(200).json({ message: 'Không tìm thấy dữ liệu' });
	}

	let teachers;
	try {
		const query = `select * from (													
            select users.created_at,users.user_id, users.avt_link, users.full_name,users.status,LOWER(users.gender) as gender,users.phone,string_agg(subject.subject_name , ',') as teacher_subject,string_agg(subject.subject_id , ',') as teacher_subject_id,users.address,users.flag from users													
            inner join teacher_subject on users.user_id =teacher_subject.teacher_id													
            inner join subject on teacher_subject.subject_id =subject.subject_id													
            where users.role_id = '3'													
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
		teachers = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'getTeachers'
		);
		return next(error);
	}

	const result = {
		data: teachers.rows,
		pagination: {
			limit: 10,
			page: parseInt(page),
			totalRows: count.rows[0].total,
		},
	};
	return res.status(200).json(result);
};

const getTeacherById = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_teacher');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const teacherId = req.params.teacherId;

	let teacher;
	try {
		const query = `Select users.user_id,users.full_name,users.display_name,users.last_login,					
		users.created_at,LOWER(users.gender) as gender,users.email,users.phone,users.address,users.flag,				
		users.avt_link,users.note, users.status, users.short_description from users where flag = false and user_id=$1 AND role_id='3' AND status = '1' LIMIT 1 `;
		const params = [teacherId];

		teacher = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'getTeacherById'
		);
		return next(error);
	}

	if (teacher.rowCount < 1) {
		const error = new HttpError('Không tìm thấy giáo viên', 404);
		return next(error);
	}

	return res.status(200).json(teacher.rows[0]);
};

const createTeacher = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_create_teacher');
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
		des,
	} = req.body;

	const client = await pool.connect();
	await client.query('BEGIN');

	if (email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 LIMIT 1`;
			const params = [email];

			check = await client.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'teacher.controller.js',
				'createTeacher'
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
	let teacher;
	try {
		const query = `INSERT INTO users(											
			user_id, username, password, role_id, full_name, display_name, email, phone, address, created_by, modified_by, note, gender, type, avt_link, status, short_description)										
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING user_id`;

		const params = [
			usercode,
			usercode,
			defaultPassword,
			'3',
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
			des,
		];

		teacher = await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'createTeacher'
		);
		return next(error);
	}

	if (subject.length > 0) {
		try {
			for (let i = 0; i < subject.length; i++) {
				const query = `INSERT INTO teacher_subject(						
					teacher_id, subject_id)					
					VALUES ($1, $2)`;
				const params = [teacher.rows[0].user_id, subject[i]];
				await client.query(query, params);
			}
		} catch (err) {
			await client.query('ROLLBACK');
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'teacher.controller.js',
				'createTeacher'
			);
			return next(error);
		}
	}

	await client.query('COMMIT');
	client.release();

	return res
		.status(200)
		.json({ message: `Thêm mới giáo viên thành công, tài khoản: ${usercode}` });
};

const updateTeacher = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_teacher');
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
	const teacherId = req.params.teacherId;
	const { profile, teachersubject, defaultTeacherSubject } = req.body;

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

	for (let i = 0; i < defaultTeacherSubject.length; i++) {
		if (!validateIsEmpty(defaultTeacherSubject[i].subject_id)) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	for (let i = 0; i < teachersubject.length; i++) {
		if (!validateIsEmpty(teachersubject[i])) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	if (profile.email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [profile.email, teacherId];

			check = await pool.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'teacher.controller.js',
				'updateTeacher'
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
		const query = `UPDATE users	SET full_name=$1, display_name=$2, email=$3, phone=$4, address=$5, modified_by=$6, modified_at=$7, note= $8, gender=$9, status=$10, short_description=$11								
			WHERE user_id = $12`;
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
			profile.short_description,
			teacherId,
		];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'updateTeacher'
		);
		return next(error);
	}

	try {
		for (let i = 0; i < defaultTeacherSubject.length; i++) {
			const index = teachersubject.findIndex(
				(ts) => ts === defaultTeacherSubject[i].subject_id
			);
			if (index === -1) {
				const query = `DELETE FROM teacher_subject
                WHERE teacher_id = $1 and subject_id = $2`;
				const params = [teacherId, defaultTeacherSubject[i].subject_id];

				await pool.query(query, params);
			} else {
				teachersubject.splice(index, 1);
			}
		}

		if (teachersubject.length > 0) {
			for (let j = 0; j < teachersubject.length; j++) {
				const query = `INSERT INTO teacher_subject(						
                        teacher_id, subject_id)					
                        VALUES ($1, $2)`;
				const params = [teacherId, teachersubject[j]];

				await pool.query(query, params);
			}
		}
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'updateTeacher'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const deleteTeacher = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_teacher');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const teacherId = req.params.teacherId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '0', teacherId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'deleteTeacher'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreTeacher = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_teacher');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const teacherId = req.params.teacherId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '1', teacherId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'teacher.controller.js',
			'restoreTeacher'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

module.exports = {
	getTeachers,
	getTeacherById,
	createTeacher,
	updateTeacher,
	deleteTeacher,
	restoreTeacher,
};
