const pool = require('../configs/db.config');

const HttpError = require('../models/http-error');
const sendLog = require('../configs/tracking-log.config');
const functionCommon = require('../common/function');
const validator = require('validator').default;
const {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
} = require('../common/validate');

const getMenu = async (req, res, next) => {
	const role = req.userData.role;

	let menu;
	try {
		const query = `SELECT function.function_id FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.flag = false and function.type = '0' and permission.is_permiss = true`;
		const param = [role];
		menu = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'permision.controller.js',
			'getMenu'
		);
		return next(error);
	}

	return res.status(200).json(menu.rows);
};

const getFunctions = async (req, res, next) => {
	const role = req.userData.role;

	let functions;
	try {
		const query = `SELECT function.function_id FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.flag = false and permission.is_permiss = true`;
		const param = [role];
		functions = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'permision.controller.js',
			'getFunctions'
		);
		return next(error);
	}

	return res.status(200).json(functions.rows);
};

const checkPermission = async (req, res, next) => {
	const role = req.userData.role;
	const functionCode = req.query.functionCode;

	let check;
	try {
		const query = `SELECT function.function_id FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.function_id = $2 and permission.is_permiss = true LIMIT 1`;
		const param = [role, functionCode];
		check = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'permision.controller.js',
			'checkPermission'
		);
		return next(error);
	}

	if (check.rowCount < 1) {
		const error = new HttpError('Not permission', 403);
		return next(error);
	}

	return res.status(200).json('1');
};

const updatePermission = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(
		role,
		'function_setting_permission'
	);
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const client = await pool.connect();
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	const { list_function_id, role_id } = req.body;
	let total_update = 0;
	try {
		await client.query('BEGIN');
		for (let i = 0; i < list_function_id.length; i++) {
			if (!validator.isBoolean(list_function_id[i].checked.toString())) {
				const error = new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				);
				return next(error);
			}

			const query = `
			UPDATE public.permission
			SET   
				is_permiss=$1,
				modified_by=$2, 
				modified_at=$3
			WHERE 
				role_id =$4 and 
				function_id=$5 ;
			`;
			const params = [
				!list_function_id[i].checked,
				userId,
				datetime,
				role_id,
				list_function_id[i].function_id,
			];
			const data = await client.query(query, params);

			total_update += data.rowCount;
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'permision.controller.js',
			'updatePermission'
		);
		return next(error);
	} finally {
		client.release();
	}
	if (total_update == list_function_id.length) {
		return res.status(200).json({
			message: 'Cập nhật thành công',
		});
	} else {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		return next(error);
	}
};

const checkMenuChange = async (req, res, next) => {
	const role = req.userData.role;
	const oldRole = req.body.local;

	let functions;
	try {
		const query = `SELECT function.function_id FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.flag = false and function.type = '0' and permission.is_permiss = true
		`;
		const param = [role];
		functions = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'permision.controller.js',
			'checkMenuChange'
		);
		return next(error);
	}
	if (JSON.stringify(oldRole) !== JSON.stringify(functions.rows)) {
		return res.status(200).json('1');
	}

	return res.status(200).json('0');
};

module.exports = {
	getMenu,
	getFunctions,
	checkPermission,
	updatePermission,
	checkMenuChange,
};
