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

const getMaketings = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_maketing');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, q, status } = req.query;

	const offset = (page - 1) * 10;

	let count;
	try {
		const query = `SELECT COUNT(user_id) as total FROM users WHERE role_id = '6'`;
		count = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'getMaketings'
		);

		return next(error);
	}

	if (count.rowCount < 1) {
		return res.status(200).json({ message: 'Không tìm thấy dữ liệu' });
	}

	let maketings;
	try {
		const query = `select distinct user_id,count(post_id),users.created_at,users.full_name,users.gender, users.email, users.phone,users.address,users.flag, users.status, users.avt_link, users.created_at from users								
		left join							
		(select * from post where post.status = '0') a on a.created_by = users.user_id							
		where  users.role_id = '6'	and users.flag =false and users.status ${
			status === '' ? '!' : ''
		}=$1 and (LOWER(users.full_name) like LOWER($2) or LOWER(users.user_id) like LOWER($3))						
		group by users.user_id order by users.created_at  DESC OFFSET $4 LIMIT 10`;
		const param = [status, '%' + q + '%', '%' + q + '%', offset];
		maketings = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'getMaketings'
		);
		return next(error);
	}

	const result = {
		data: maketings.rows,
		pagination: {
			limit: 10,
			page: parseInt(page),
			totalRows: count.rows[0].total,
		},
	};
	return res.status(200).json(result);
};

const getMaketingById = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_maketing');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const maketingId = req.params.maketingId;

	let maketing;
	try {
		const query = `Select users.user_id,users.full_name,users.display_name,users.last_login,					
		users.created_at,LOWER(users.gender) as gender,users.email,users.phone,users.address,users.flag,				
		users.avt_link,users.note, users.status from users where flag = false and user_id=$1 AND role_id='6' AND status = '1' LIMIT 1`;
		const params = [maketingId];

		maketing = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'getMaketingById'
		);
		return next(error);
	}

	if (maketing.rowCount < 1) {
		const error = new HttpError('Không tìm thấy marketer', 404);
		return next(error);
	}

	return res.status(200).json(maketing.rows[0]);
};

const createMaketing = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_create_maketing');
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
	const { full_name, display_name, email, phone, address, note, gender } =
		req.body;

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
				'maketing.controller.js',
				'createMaketing'
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
	try {
		const query = `INSERT INTO users(											
			user_id, username, password, role_id, full_name, display_name, email, phone, address, created_by, modified_by, note, gender, type, avt_link, status)										
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id`;
		const usercode = autoGenerateUsername(full_name);
		const params = [
			usercode,
			usercode,
			defaultPassword,
			'6',
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

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'createMaketing'
		);
		return next(error);
	}

	return res
		.status(200)
		.json({ message: `Thêm mới maketing thành công, tài khoản: ${usercode}` });
};

const updateMaketing = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_maketing');
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
	const maketingId = req.params.maketingId;
	const { profile } = req.body;

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

	let checkUser;
	try {
		const query = `SELECT user_id FROM users WHERE user_id = $1 AND role_id = '6'`;
		const params = [maketingId];

		checkUser = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'updateMaketing'
		);
		return next(error);
	}

	if (checkUser.rowCount < 1) {
		const error = new HttpError('Không tìm thấy người dùng.', 404);
		return next(error);
	}

	if (profile.email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [profile.email, maketingId];

			check = await pool.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'maketing.controller.js',
				'updateMaketing'
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
			maketingId,
		];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'updateMaketing'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const deleteMaketing = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_maketing');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const maketingId = req.params.maketingId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '0', maketingId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'deleteMaketing'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreMaketing = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_maketing');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const maketingId = req.params.maketingId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '1', maketingId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'maketing.controller.js',
			'restoreMaketing'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

module.exports = {
	getMaketings,
	getMaketingById,
	createMaketing,
	updateMaketing,
	deleteMaketing,
	restoreMaketing,
};
