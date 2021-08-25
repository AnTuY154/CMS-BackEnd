require('dotenv').config();
const { generateHash } = require('../common/function');

const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const passport = require('passport');

const HttpError = require('../models/http-error');
const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const mail = require('../configs/mail.config');

const signin = async (req, res, next) => {
	passport.authenticate('local', async (err, user, info) => {
		try {
			if (err || !user) {
				const error = new HttpError(
					'Tài khoản hoặc mật khẩu không đúng, vui lòng kiểm tra lại.',
					401
				);
				return next(error);
			}

			req.login(user, { session: false }, async (error) => {
				if (error) return next(error);

				const userId = user.userId;
				const role = user.role;

				const accessToken = jwt.sign(
					{ userId, role },
					process.env.ACCESS_TOKEN_SERCRET_KEY,
					{
						expiresIn: '7d',
					}
				);

				res.cookie('access_token', accessToken, {
					maxAge: 24 * 60 * 60 * 7 * 1000,
					httpOnly: true,
				});

				res.cookie('c_user', userId, {
					maxAge: 24 * 60 * 60 * 7 * 1000,
				});

				res.cookie('c_role', role, {
					maxAge: 24 * 60 * 60 * 7 * 1000,
				});

				return res.status(200).json({ message: 'Đăng nhập thành công' });
			});
		} catch (error) {
			return next(error);
		}
	})(req, res, next);
};

const logout = (req, res) => {
	res.clearCookie('access_token');
	res.clearCookie('c_user');
	res.clearCookie('c_role');

	return res.status(200).json({
		logout: true,
	});
};

const forgotPassword = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	const { username } = req.body;
	let user;

	try {
		const query = `SELECT user_id, full_name FROM users WHERE email = $1 AND status='1' LIMIT 1`;
		const params = [username];

		user = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'forgotPassword'
		);
		return next(error);
	}

	if (user.rowCount === 0) {
		const error = new HttpError('Tài khoản không tồn tại', 404);
		return next(error);
	}

	const randomCode = Math.floor(Math.random() * (1000000 - 100000)) + 100000;

	try {
		const query =
			'INSERT INTO users_recover_code(code_id, code_value, user_id, expire_date) VALUES ($1, $2, $3, $4)';
		const params = [
			uuidv4(),
			randomCode,
			user.rows[0].user_id,
			new Date(new Date().getTime() + 180 * 1000),
		];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'forgotPassword'
		);
		return next(error);
	}

	const mailOptions = {
		from: 'Xoài Academy <vietokokbusiness@gmail.com>',
		to: username.toString(),
		subject: `${randomCode.toString()} là mã khôi phục tài khoản Xoài Academy của bạn`,
		text: '',
		html: `<html>
		<head>
			<style>
				p {
					font-family: Arial, Helvetica, sans-serif
				}
				div {
					font-family: Arial, Helvetica, sans-serif
				}
				.code {
					font-size: 2.5rem;
				}
			</style>
		</head>
		<body>
			<div>
				<p>Hi ${user.rows[0].full_name},<br/></p>
				<p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu Xoài Academy của bạn.<br/>Nhập mã đặt lại mật khẩu sau:</p>
				<div class="code">${randomCode.toString()}</div>
			</div>
		</body>
		</html>`,
	};

	try {
		await mail.sendMail(mailOptions);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		return next(error);
	} finally {
		mail.close();
	}

	return res.status(200).json({ userId: user.rows[0].user_id, username });
};

const checkRecoverCode = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}
	const userId = req.params.userId;
	const { code } = req.body;
	let user;

	try {
		const query = `SELECT user_id FROM users WHERE user_id = $1 AND status='1' LIMIT 1`;
		const params = [userId];

		user = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'checkRecoverCode'
		);
		return next(error);
	}

	if (user.rowCount === 0) {
		const error = new HttpError('Tài khoản không tồn tại', 404);
		return next(error);
	}

	let recoverCode;
	try {
		const query = `SELECT * FROM users_recover_code INNER JOIN users ON users.user_id = users_recover_code.user_id WHERE code_value = $1 AND users.user_id = $2 AND users.status = '1'`;
		const params = [code, userId];

		recoverCode = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'checkRecoverCode'
		);
		return next(error);
	}

	if (recoverCode.rowCount === 0) {
		const error = new HttpError('Bạn đã nhập sai mã, vui lòng nhập lại', 404);
		return next(error);
	}

	if (
		new Date(recoverCode.rows[0].expire_date).getTime() < new Date().getTime()
	) {
		const error = new HttpError('Mã của bạn đã hết hạn', 406);
		return next(error);
	}

	try {
		const query = 'UPDATE users SET is_reset = $1 WHERE user_id = $2';
		const params = [true, userId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'checkRecoverCode'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Successfully' });
};

const setNewPassword = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}
	const userId = req.params.userId;
	const { newpassword } = req.body;
	let user;

	try {
		const query = `SELECT user_id, is_reset FROM users WHERE user_id = $1 AND status='1' LIMIT 1`;
		const params = [userId];

		user = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'setNewPassword'
		);
		return next(error);
	}

	if (user.rowCount === 0) {
		const error = new HttpError('Tài khoản không tồn tại', 404);
		return next(error);
	}

	if (user.rows[0].is_reset === false) {
		const error = new HttpError('Bạn không có quyền cho API này.', 403);
		return next(error);
	}

	const passwordHash = await generateHash(newpassword);

	try {
		const query =
			'UPDATE users SET password = $1, is_reset = $2 WHERE user_id = $3';
		const params = [passwordHash, false, userId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'setNewPassword'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Thay đổi mật khẩu thành công !' });
};

const getListFunctionByRole = async (req, res, next) => {
	const { role_id } = req.query;
	try {
		const query = `
		SELECT function.function_id as id,function_name as text,is_permiss FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.flag = false 	order by function.function_id `;
		const params = [role_id];
		const data = await pool.query(query, params);
		const result = {
			data: data.rows,
		};
		return res.status(200).json(result);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'auth.controller.js',
			'getListFunctionByRole'
		);
		return next(error);
	}
};

module.exports = {
	signin,
	logout,
	forgotPassword,
	checkRecoverCode,
	setNewPassword,
	getListFunctionByRole,
};
