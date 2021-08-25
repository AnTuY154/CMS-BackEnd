const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const functionCommon = require('../common/function');

const getRegisterYear = async (req, res, next) => {
	try {
		const query = `
        Select 
            distinct to_char(created_at,'YYYY') as text,
		    to_char(created_at,'YYYY') as value 
        From register 
        order by text ASC`;
		response = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'register.controller.js',
			'getRegisterYear'
		);
		return next(error);
	}

	return res.status(200).json(response.rows);
};

const getRegisterList = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3 } = req.query;

	const offset = (page - 1) * limit;
	try {
		const query = `
		select distinct full_name,email,phone,register_status,
			created_at,
			string_agg(id,'-') as id,
			user_id  from (
				select 
							distinct full_name,email,phone,register.status as register_status,
							to_char(register.date,'YYYY/MM/DD') as created_at,
							LEFT(string_agg(register.register_id ,'-'),2) as id,
							user_id,
							class.class_id,
							course.course_id

						from 
							register
							left  join class on register.class_id=class.class_id
							left  join course on register.course_id=course.course_id
							where  
						(LOWER(phone) like LOWER($1) or  LOWER(full_name) like LOWER($2))
						and register.status ${filter1 === '' ? '!' : ''}= $3
						and to_char(register.date,'MM')${filter2 === '' ? '!' : ''}= $4 
						and to_char(register.date,'YYYY')${filter3 === '' ? '!' : ''}= $5
						Group by  full_name,email,phone,register.status,register.date,user_id,class.class_id,	course.course_id
				) a
		Group by  full_name,email,phone,register_status,created_at,user_id
		order by created_at DESC
		LIMIT $6 OFFSET $7
		`;
		const param = [
			'%' + q + '%',
			'%' + q + '%',
			filter1,
			filter2,
			filter3,
			limit,
			offset,
		];
		const data = await pool.query(query, param);

		const final_data = [];
		const tempData = data.rows;
		for (let i = 0; i < tempData.length; i++) {
			const list_regis_class = [];
			const list_regis_course = [];
			const object = {
				id: tempData[i].id,
				created_at: tempData[i].created_at,
				email: tempData[i].email,
				full_name: tempData[i].full_name,
				phone: tempData[i].phone,
				register_status: tempData[i].register_status,
				user_id: tempData[i].user_id,
			};
			const id = tempData[i].id.split('-');
			for (let j = 0; j < id.length; j++) {
				try {
					const query_1 = `
					select distinct
					register.status,class.class_id,class.class_name,course.course_id,course.title,register.note,register.register_id
				from 
					register
					left  join class on register.class_id=class.class_id
					left  join course on register.course_id=course.course_id
				where register_id = $1
					`;

					const params_1 = [id[j]];
					const list_class_course = await pool.query(query_1, params_1);

					if (list_class_course.rows[0].class_id != null) {
						list_regis_class.push(list_class_course.rows[0]);
					} else if (list_class_course.rows[0].course_id != null) {
						list_regis_course.push(list_class_course.rows[0]);
					}
				} catch (err) {
					const error = new HttpError(
						'Đã có lỗi xảy ra, vui lòng thử lại.',
						500
					);
					sendLog(
						err.stack,
						error.code,
						error.message,
						'post.controller.js',
						'getPostList'
					);
					return next(error);
				}
			}
			object['list_regis_class'] = list_regis_class;
			object['list_regis_course'] = list_regis_course;

			final_data.push(object);
		}
		const result = {
			data: final_data,
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
			'post.controller.js',
			'getPostList'
		);
		return next(error);
	}
};

const updateRegisStatus = async (req, res, next) => {
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
	const check = await functionCommon.checkRole(role, 'function_edit_register');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { regis_id, status } = req.body;
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		for (let i = 0; i < regis_id.length; i++) {
			const results = await client.query(
				`UPDATE public.register
				SET status=$4,
				modified_by=$1, modified_at=$2
				WHERE  register_id=$3;`,
				[userId, datetime, regis_id[i], status]
			);
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'updatePostFlag'
		);
		return next(error);
	} finally {
		client.release();
	}
	return res.json({
		message: 'Cập nhật thành công',
	});
};

const getTotalRegister = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;

	try {
		const query = `
		select 
		distinct full_name,email,phone,register.status as register_status,
		to_char(register.date,'YYYY/MM/DD') as created_at,
		string_agg(register.register_id ,'-') as id,
		user_id
			from 
			register
		where  
			(LOWER(phone) like LOWER($1) or  LOWER(full_name) like LOWER($2))
			and status ${filter1 === '' ? '!' : ''}= $3
			and to_char(created_at,'MM')${filter2 === '' ? '!' : ''}= $4 
			and to_char(created_at,'YYYY')${filter3 === '' ? '!' : ''}= $5
			Group by  full_name,email,phone,register.status,register.date,user_id

		`;
		const param = ['%' + q + '%', '%' + q + '%', filter1, filter2, filter3];
		const data = await pool.query(query, param);
		const result = {
			data: data.rowCount,
		};
		return res.status(200).json(result);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getTotalRegister'
		);
		return next(error);
	}
};

module.exports = {
	getRegisterYear,
	getRegisterList,
	updateRegisStatus,
	getTotalRegister,
};
