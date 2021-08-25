const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const { validPassword, generateHash } = require('../common/function');

const getUserById = async (req, res, next) => {
	const userId = req.userData.userId;

	let user;
	try {
		const query = `SELECT user_id, username, role_id, full_name, display_name, email, phone, address, created_at, avt_link, LOWER(gender) as gender FROM users WHERE user_id = $1`;
		const param = [userId];

		user = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'getUserById'
		);
		return next(error);
	}

	return res.status(200).json(user.rows[0]);
};

const getFunctionByRoleId = async (req, res, next) => {
	const roleId = req.userData.role;

	let functions;
	try {
		const query = `SELECT function.function_id, function.function_name from function INNER JOIN permission ON function.function_id = permission.function_id
		WHERE permission.role_id = $1 and permission.flag = false`;
		const param = [roleId];

		functions = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'getFunctionByRoleId'
		);
		return next(error);
	}

	return res.status(200).json(functions.rows);
};

const updateProfile = async (req, res, next) => {
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

	const { full_name, display_name, email, phone, address, gender } = req.body;

	if (email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [email, userId];

			check = await pool.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'user.controller.js',
				'updateProfile'
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
		const query = `UPDATE users	SET full_name=$1, display_name=$2, email=$3, phone=$4, address=$5, gender=$6, modified_by=$7, modified_at=$8							
			WHERE user_id = $9`;
		const params = [
			full_name,
			display_name,
			email,
			phone,
			address,
			gender,
			userId,
			new Date(),
			userId,
		];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'updateProfile'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const getAvatar = async (req, res, next) => {
	const userId = req.userData.userId;

	let avt;
	try {
		const query = `SELECT avt_link FROM users WHERE user_id = $1`;
		const params = [userId];

		avt = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'getAvatar'
		);
		return next(error);
	}

	return res.status(200).json({ avt: avt.rows[0].avt_link });
};

const changeAvatar = async (req, res, next) => {
	const userId = req.userData.userId;

	try {
		const query = `UPDATE users	SET avt_link=$1, modified_by=$2, modified_at=$3							
			WHERE user_id = $4`;
		const params = [req.file.location, userId, new Date(), userId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'changeAvatar'
		);
		return next(error);
	}

	return res.status(200).json({
		message: 'Thay đổi ảnh đại diện thành công',
		avt: req.file.location,
	});
};

const changeNewPassword = async (req, res, next) => {
	const userId = req.userData.userId;
	const { oldPassword, newPassword } = req.body;

	let user;
	try {
		const query = 'SELECT user_id, password FROM users WHERE user_id = $1';
		const params = [userId];

		user = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'changeNewPassword'
		);
		return next(error);
	}

	const checkPassword = await validPassword(oldPassword, user.rows[0].password);

	if (!checkPassword) {
		const error = new HttpError('Mật khẩu cũ không đúng', 401);
		return next(error);
	}

	const passwordHash = await generateHash(newPassword);

	try {
		const query = 'UPDATE users SET password = $1 WHERE user_id = $2';
		const params = [passwordHash, userId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'changeNewPassword'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
};

const checkRoleByUser = async (req, res, next) => {
	const role = req.userData.role;
	const userId = req.userData.userId;

	let check;
	try {
		const query = `SELECT role_id FROM users WHERE user_id = $1 AND role_id = $2`;
		const params = [userId, role];

		check = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'user.controller.js',
			'checkRoleByUser'
		);
		return next(error);
	}

	if (check.rowCount < 1) {
		const error = new HttpError('Không có quyền truy cập', 403);
		return next(error);
	}

	return res.status(200).json(check.rows[0].role_id);
};

module.exports = {
	getUserById,
	getFunctionByRoleId,
	updateProfile,
	getAvatar,
	changeAvatar,
	changeNewPassword,
	checkRoleByUser,
};
