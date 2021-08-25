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

const getManagers = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_manager');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, q, status, shift } = req.query;
	const offset = (page - 1) * 10;

	let count;
	try {
		const query = `SELECT COUNT(user_id) as total FROM users WHERE role_id = '2' OR role_id = '7'`;
		count = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'getManagers'
		);
		return next(error);
	}

	if (count.rows[0].total == '0') {
		return res.status(200).json({
			data: [],
			pagination: {
				limit: 10,
				page: 1,
				totalRows: 0,
			},
		});
	}

	let managers;
	try {
		const query = `select * from (														
            select string_agg(concat_ws('- ', slot.slot_name, slot.start_time,slot.end_time) , ',') as slot_info,string_agg(slot.slot_id,',') as slot_id_info,users.created_at,users.role_id, users.user_id,users.full_name,users.gender,users.phone, users.email, users.address, users.avt_link, users.flag, users.status from users														
            inner join manager_shift on manager_shift.manager_id=users.user_id														
            inner join slot on manager_shift.slot_id=slot.slot_id and slot.type='1'														
            where (users.role_id = '2' or users.role_id = '7') and slot.slot_id 														
            ${shift === '' ? 'not' : ''} in ($1)													
            group by users.user_id														
            ) a														
            where a.flag=false and a.status${
							status === '' ? '!' : ''
						}=$2  and (LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4))														
            order by a.created_at  DESC OFFSET $5 LIMIT 10`;
		const param = [shift, status, '%' + q + '%', '%' + q + '%', offset];
		managers = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'getManagers'
		);
		return next(error);
	}

	const result = {
		data: managers.rows,
		pagination: {
			limit: 10,
			page: parseInt(page),
			totalRows: count.rows[0].total,
		},
	};
	return res.status(200).json(result);
};

const getManagerById = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_manager');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const managerId = req.params.managerId;

	let manager;
	try {
		const query = `Select users.user_id,users.full_name,users.display_name,users.last_login, users.role_id,					
		users.created_at,LOWER(users.gender) as gender,users.email,users.phone,users.address,users.flag,				
		users.avt_link,users.note, users.status from users where flag = false and user_id=$1 AND (role_id='2' OR role_id = '7') AND status = '1' LIMIT 1`;
		const params = [managerId];

		manager = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'getManagerById'
		);
		return next(error);
	}

	if (manager.rowCount < 1) {
		const error = new HttpError('Không tìm thấy quản lý', 404);
		return next(error);
	}

	return res.status(200).json(manager.rows[0]);
};

const createManager = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_create_manager');
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
		shift,
		managerType,
	} = req.body;

	for (let i = 0; i < shift.length; i++) {
		if (!validateIsEmpty(shift[i])) {
			return next(
				new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				)
			);
		}
	}

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
				'manager.controller.js',
				'createManager'
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
	let manager;
	try {
		const query = `INSERT INTO users(											
			user_id, username, password, role_id, full_name, display_name, email, phone, address, created_by, modified_by, note, gender, type, avt_link, status)										
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id`;

		const params = [
			usercode,
			usercode,
			defaultPassword,
			managerType,
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

		manager = await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'createManager'
		);
		return next(error);
	}

	if (shift.length > 0) {
		try {
			for (let i = 0; i < shift.length; i++) {
				const query = `INSERT INTO manager_shift(						
					manager_id, slot_id, created_by, modified_by)					
					VALUES ($1, $2, $3, $4)`;
				const params = [manager.rows[0].user_id, shift[i], userId, userId];
				await client.query(query, params);
			}
		} catch (err) {
			await client.query('ROLLBACK');
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'manager.controller.js',
				'createManager'
			);
			return next(error);
		}
	}

	await client.query('COMMIT');
	client.release();

	return res
		.status(200)
		.json({ message: `Thêm mới quản lý thành công, tài khoản: ${usercode}` });
};

const updateManager = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_manager');
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
	const managerId = req.params.managerId;
	const { profile, managerShift, defaultManagerShift } = req.body;

	if (
		!validateIsEmpty(profile.full_name) ||
		!validateIsEmpty(profile.display_name) ||
		!validateIsEmpty(profile.email) ||
		!validateIsEmpty(profile.phone) ||
		!validateIsEmpty(profile.gender) ||
		!validateIsEmpty(profile.role_id)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validator.matches(profile.phone, /^[0-9]+$/) ||
		!validator.isEmail(profile.email) ||
		(profile.gender.toLowerCase() !== 'male' &&
			profile.gender.toLowerCase() !== 'female') ||
		!validator.matches(profile.role_id, /^(2|7)$/)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	for (let i = 0; i < defaultManagerShift.length; i++) {
		if (!validateIsEmpty(defaultManagerShift[i].slot_id)) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	for (let i = 0; i < managerShift.length; i++) {
		if (!validateIsEmpty(managerShift[i])) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	const client = await pool.connect();
	await client.query('BEGIN');

	if (profile.email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [profile.email, managerId];

			check = await client.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'manager.controller.js',
				'updateManager'
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
		const query = `UPDATE users	SET full_name=$1, display_name=$2, email=$3, phone=$4, address=$5, modified_by=$6, modified_at=$7, note= $8, gender=$9, status=$10, role_id = $11								
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
			profile.role_id,
			managerId,
		];

		await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'updateManager'
		);
		return next(error);
	}

	try {
		for (let i = 0; i < defaultManagerShift.length; i++) {
			const index = managerShift.findIndex(
				(ts) => ts === defaultManagerShift[i].slot_id
			);
			if (index === -1) {
				const query = `DELETE FROM manager_shift
                WHERE manager_id = $1 and slot_id = $2`;
				const params = [managerId, defaultManagerShift[i].slot_id];

				await client.query(query, params);
			} else {
				managerShift.splice(index, 1);
			}
		}

		if (managerShift.length > 0) {
			for (let j = 0; j < managerShift.length; j++) {
				const query = `INSERT INTO manager_shift(						
                        manager_id, slot_id, created_by, modified_by)					
                        VALUES ($1, $2, $3, $4)`;
				const params = [managerId, managerShift[j], userId, userId];

				await client.query(query, params);
			}
		}
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'updateManager'
		);
		return next(error);
	}

	await client.query('COMMIT');
	client.release();

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const deleteManager = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_manager');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const managerId = req.params.managerId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '0', managerId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'deleteManager'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreManager = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_manager');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const managerId = req.params.managerId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '1', managerId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'deleteManager'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

module.exports = {
	getManagers,
	getManagerById,
	createManager,
	updateManager,
	deleteManager,
	restoreManager,
};
