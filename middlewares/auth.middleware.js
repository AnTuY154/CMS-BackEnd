require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../configs/db.config');

const HttpError = require('../models/http-error');

const authMiddleware = async (req, res, next) => {
	if (req.method === 'OPTIONS') {
		return next();
	}

	try {
		const token = req.cookies['access_token'];
		const cUser = req.cookies['c_user'];
		const cRole = req.cookies['c_role'];

		if (!cUser || !token || !cRole) {
			res.clearCookie('access_token');
			res.clearCookie('c_user');
			res.clearCookie('c_role');

			const error = new HttpError('Đăng nhập thất bại!', 403);
			return next(error);
		}

		jwt.verify(token, process.env.ACCESS_TOKEN_SERCRET_KEY, (err, decoded) => {
			if (
				err ||
				cUser !== decoded.userId.toString() ||
				cRole !== decoded.role.toString()
			) {
				res.clearCookie('access_token');
				res.clearCookie('c_user');
				res.clearCookie('c_role');

				const error = new HttpError('Đăng nhập thất bại!', 403);
				return next(error);
			}

			req.userData = { userId: decoded.userId, role: decoded.role };
		});
		let isTrue = false;

		const query = `SELECT users.user_id FROM users WHERE user_id = $1 AND role_id = $2 AND status = '1' AND is_confirm = true`;
		const params = [cUser, cRole];
		const results = await pool.query(query, params);
		if (results.rowCount < 1) {
			isTrue = true;
		}

		if (isTrue === true) {
			res.clearCookie('access_token');
			res.clearCookie('c_user');
			res.clearCookie('c_role');

			const error = new HttpError('Đăng nhập thất bại!', 403);
			return next(error);
		}

		next();
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		return next(error);
	}
};

module.exports = authMiddleware;
