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

const getStudents = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_student');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, q, status, classroom, course } = req.query;

	const offset = (page - 1) * 10;

	try {
		let query = `				
					select string_agg(a.class_id , ',') as class_id,								
			a.user_id,							
			a.full_name,							
			a.gender,							
			a.phone,							
			a.display_name,							
			a.email,							
			a.address,
			a.created_at,
			a.status,
			a.avt_link									
		from (								
			Select distinct  class_student.class_id,	
				course_student.course_id,						
				users.user_id,						
				users.full_name,						
				users.gender,						
				users.phone,						
				users.display_name,						
				users.email,						
				users.address,		
				users.status,					
				users.created_at,
				users.avt_link,
				users.role_id						
			from users							
			left join class_student on class_student.student_id = users.user_id	
			left join course_student on course_student.student_id = users.user_id							
			WHERE users.role_id = '5'
		`;

		let tail_query = `
			group by users.user_id,class_student.class_id,course_student.course_id							
			order by class_id						
			) a						
			where	
			a.status ${status === '' ? '!' : ''}=$1 AND			
			(LOWER(a.full_name) like LOWER($2) or LOWER(a.user_id) like LOWER($3) )						
			group by a.user_id,a.full_name,a.gender,a.phone,a.display_name,a.email,a.address,a.created_at, a.status, a.avt_link						
			order by a.created_at  DESC 
		`;

		let params = [status, '%' + q + '%', '%' + q + '%'];

		let current_params = 3;
		if (classroom) {
			current_params++;
			query += ` and class_student.class_id =$${current_params} `;
			params.push(classroom);
		}
		if (course) {
			current_params++;
			query += ` and course_student.course_id =$${current_params} `;
			params.push(course);
		}
		current_params++;
		let offset_limit = `OFFSET $${current_params} LIMIT 10`;

		const count_students_query = query + tail_query;
		const count_student = await pool.query(count_students_query, params);

		let get_students_query = query + tail_query + offset_limit;
		params.push(offset);
		const list_student = await pool.query(get_students_query, params);

		const result = {
			data: list_student.rows,
			pagination: {
				limit: 10,
				page: parseInt(page),
				totalRows: count_student.rowCount,
			},
		};

		return res.status(200).json(result);

		// const list_student = await pool.query(get_student_query, params);

		// return res.status(200).json(result);

		// 	let count;
		// 	let countQuery;
		// 	let countParams;

		// 	let students;
		// 	let studentsQuery;
		// 	let studentsParams;

		// 	if (classroom === '') {
		// 		countQuery = `select a.user_id
		// 		from (
		// 			Select distinct
		// 				users.user_id,
		// 				users.full_name,
		// 				users.gender,
		// 				users.phone,
		// 				users.display_name,
		// 				users.email,
		// 				users.address,
		// 				users.status,
		// 				users.created_at,
		// 				users.avt_link,
		// 				users.role_id
		// 			from users
		// 			left join class_student on class_student.student_id = users.user_id
		// 			WHERE users.role_id = '5'
		// 			) a
		// 			where
		// 			a.status ${status === '' ? '!' : ''}=$1 AND
		// 			(LOWER(a.full_name) like LOWER($2) or LOWER(a.user_id) like LOWER($3))
		// 			`;
		// 		countParams = [status, '%' + q + '%', '%' + q + '%'];

		// 		studentsQuery = `select string_agg(a.class_id , ',') as class_id,
		// 	a.user_id,
		// 	a.full_name,
		// 	a.gender,
		// 	a.phone,
		// 	a.display_name,
		// 	a.email,
		// 	a.address,
		// 	a.created_at,
		// 	a.status,
		// 	a.avt_link
		// from (
		// 	Select distinct  class_student.class_id,
		// 		users.user_id,
		// 		users.full_name,
		// 		users.gender,
		// 		users.phone,
		// 		users.display_name,
		// 		users.email,
		// 		users.address,
		// 		users.status,
		// 		users.created_at,
		// 		users.avt_link,
		// 		users.role_id
		// 	from users
		// 	left join class_student on class_student.student_id = users.user_id
		// 	WHERE users.role_id = '5'
		// 	group by users.user_id,class_student.class_id
		// 	order by class_id
		// 	) a
		// 	where
		// 	a.status ${status === '' ? '!' : ''}=$1 AND
		// 	(LOWER(a.full_name) like LOWER($2) or LOWER(a.user_id) like LOWER($3) )
		// 	group by a.user_id,a.full_name,a.gender,a.phone,a.display_name,a.email,a.address,a.created_at, a.status, a.avt_link
		// 	order by a.created_at  DESC  OFFSET $4 LIMIT 10`;
		// 		studentsParams = [status, '%' + q + '%', '%' + q + '%', offset];
		// 	} else {
		// 		countQuery = `select a.user_id
		// 		from (
		// 			Select distinct
		// 				users.user_id,
		// 				users.full_name,
		// 				users.gender,
		// 				users.phone,
		// 				users.display_name,
		// 				users.email,
		// 				users.address,
		// 				users.status,
		// 				users.created_at,
		// 				users.avt_link,
		// 				users.role_id
		// 			from users
		// 			left join class_student on class_student.student_id = users.user_id
		// 			WHERE users.role_id = '5' AND class_student.class_id ${
		// 				classroom === '' ? '!' : ''
		// 			}=$1
		// 			) a
		// 			where
		// 			a.status ${status === '' ? '!' : ''}=$2 AND
		// 			(LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4))
		// 			`;
		// 		countParams = [classroom, status, '%' + q + '%', '%' + q + '%'];

		// 		studentsQuery = `select string_agg(a.class_id , ',') as class_id,
		// 	a.user_id,
		// 	a.full_name,
		// 	a.gender,
		// 	a.phone,
		// 	a.display_name,
		// 	a.email,
		// 	a.address,
		// 	a.created_at,
		// 	a.status,
		// 	a.avt_link
		// from (
		// 	Select distinct  class_student.class_id,
		// 		users.user_id,
		// 		users.full_name,
		// 		users.gender,
		// 		users.phone,
		// 		users.display_name,
		// 		users.email,
		// 		users.address,
		// 		users.status,
		// 		users.created_at,
		// 		users.avt_link,
		// 		users.role_id
		// 	from users
		// 	left join class_student on class_student.student_id = users.user_id

		// 	where class_student.class_id ${
		// 		classroom === '' ? '!' : ''
		// 	}=$1 and users.role_id = '5'
		// 	group by users.user_id,class_student.class_id
		// 	order by class_id
		// 	) a
		// 	where
		// 	a.status ${status === '' ? '!' : ''}=$2 AND
		// 	(LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4) )
		// 	group by a.user_id,a.full_name,a.gender,a.phone,a.display_name,a.email,a.address,a.created_at, a.status, a.avt_link
		// 	order by a.created_at  DESC  OFFSET $5 LIMIT 10`;
		// 		studentsParams = [
		// 			classroom,
		// 			status,
		// 			'%' + q + '%',
		// 			'%' + q + '%',
		// 			offset,
		// 		];
		// 	}

		// 	count = await pool.query(countQuery, countParams);
		// 	students = await pool.query(studentsQuery, studentsParams);

		// 	const result = {
		// 		data: students.rows,
		// 		pagination: {
		// 			limit: 10,
		// 			page: parseInt(page),
		// 			totalRows: count.rowCount,
		// 		},
		// 	};

		// return res.status(200).json(result);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'getStudents'
		);
		return next(error);
	}
};

const getStudentById = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_student');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const studentId = req.params.studentId;

	let student;
	try {
		const query = `Select users.user_id,users.full_name,users.display_name,users.last_login,					
		users.created_at,LOWER(users.gender) as gender,users.email,users.phone,users.address,users.flag,				
		users.avt_link,users.note, users.status from users where flag = false and user_id=$1 AND role_id='5' AND status = '1' LIMIT 1`;
		const params = [studentId];

		student = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'getStudentById'
		);
		return next(error);
	}

	if (student.rowCount < 1) {
		const error = new HttpError('Không tìm thấy học sinh', 404);
		return next(error);
	}

	return res
		.status(200)
		.json({ count: student.rowCount, data: student.rows[0] });
};

const getStudentsByClassId = async (req, res, next) => {
	const classId = req.params.classId;

	let students;
	try {
		const query = `SELECT users.avt_link, users.user_id, users.full_name, class_student.flag FROM users
		INNER JOIN class_student ON class_student.student_id = users.user_id
		WHERE class_student.class_id = $1 AND users.status = '1'`;
		const params = [classId];
		students = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'getStudentsByClassId'
		);
		return next(error);
	}

	return res.status(200).json(students.rows);
};

const createStudent = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_create_student');
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
		classroom,
		register,
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
				'student.controller.js',
				'createStudent'
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
	let student;
	try {
		const query = `INSERT INTO users(											
			user_id, username, password, role_id, full_name, display_name, email, phone, address, created_by, modified_by, note, gender, type, status, avt_link)										
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id`;

		const params = [
			usercode,
			usercode,
			defaultPassword,
			'5',
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
			'1',
			'https://i.pravatar.cc',
		];

		student = await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'createStudent'
		);
		return next(error);
	}

	if (register !== '') {
		const registerArray = register.split('-');
		for (let i = 0; i < registerArray.length; i++) {
			try {
				const query = `UPDATE register
				SET user_id= $1, status= $2, modified_by= $3, modified_at=$4
				WHERE register_id = $5`;

				const params = [
					student.rows[0].user_id,
					'1',
					userId,
					new Date(),
					registerArray[i],
				];

				await client.query(query, params);
			} catch (err) {
				await client.query('ROLLBACK');
				const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
				sendLog(
					err.stack,
					error.code,
					error.message,
					'student.controller.js',
					'createStudent'
				);
				return next(error);
			}
		}
	}

	const parseDate =
		new Date().getFullYear() +
		'-' +
		('0' + (new Date().getMonth() + 1)).slice(-2) +
		'-' +
		('0' + new Date().getDate()).slice(-2);

	const month = ('0' + (new Date().getMonth() + 1)).slice(-2);

	if (classroom.length > 0) {
		try {
			for (let i = 0; i < classroom.length; i++) {
				const query = `INSERT INTO class_student(
					class_id, student_id, created_by, modified_by)
					VALUES ($1, $2,$3, $4);`;
				const params = [classroom[i], student.rows[0].user_id, userId, userId];

				await client.query(query, params);
			}
		} catch (err) {
			await client.query('ROLLBACK');
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'student.controller.js',
				'createStudent'
			);
			return next(error);
		}

		for (let i = 0; i < classroom.length; i++) {
			try {
				let totalLessonInMonth;
				const totalLessonInMonthQuery = `select schedule_id from schedule where class_id =$1 and date >= $2 and to_char(schedule.date,'MM') =$3`;
				const totalLessonInMonthParams = [classroom[i], parseDate, month];

				totalLessonInMonth = await client.query(
					totalLessonInMonthQuery,
					totalLessonInMonthParams
				);

				const query = `select schedule_id from schedule where class_id =$1 and date >= $2`;
				const params = [classroom[i], parseDate];

				const schedules = await client.query(query, params);

				for (let j = 0; j < schedules.rowCount; j++) {
					try {
						const query = `INSERT INTO attendance(					
								attendance_id, schedule_id, user_id, is_active, created_by, modified_by)				
								VALUES (nextval('attendance_id'), $1, $2, $3, $4, $5)`;
						const params = [
							schedules.rows[j].schedule_id,
							student.rows[0].user_id,
							'0',
							userId,
							userId,
						];
						await client.query(query, params);
					} catch (err) {
						await client.query('ROLLBACK');
						const error = new HttpError(
							'Đã xảy ra lỗi, vui lòng thử lại.',
							500
						);
						sendLog(
							err.stack,
							error.code,
							error.message,
							'student.controller.js',
							'createStudent'
						);
						return next(error);
					}
				}

				let price;
				try {
					const query = `select price from class where class_id =$1`;
					const params = [classroom[i]];
					price = await client.query(query, params);
				} catch (err) {
					const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
					sendLog(
						err.stack,
						error.code,
						error.message,
						'student.controller.js',
						'createStudent'
					);
					return next(error);
				}

				const amount = parseFloat(
					price.rows[0].price * totalLessonInMonth.rowCount
				);

				try {
					const query = `INSERT INTO payment(									
							payment_id, class_id, student_id, status, amount, created_by, modified_by, month, year, class_price, total_lesson_in_month, additional_charges, residual_fee)								
							VALUES (nextval('payment_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
					const params = [
						classroom[i],
						student.rows[0].user_id,
						'0',
						amount,
						userId,
						userId,
						new Date().getMonth() + 1,
						new Date().getFullYear(),
						price.rows[0].price,
						totalLessonInMonth.rowCount,
						0,
						0,
					];
					await client.query(query, params);
				} catch (err) {
					await client.query('ROLLBACK');
					const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
					sendLog(
						err.stack,
						error.code,
						error.message,
						'student.controller.js',
						'createStudent'
					);
					return next(error);
				}
			} catch (err) {
				const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
				sendLog(
					err.stack,
					error.code,
					error.message,
					'student.controller.js',
					'createStudent'
				);
				return next(error);
			}
		}
	}

	await client.query('COMMIT');
	client.release();

	return res
		.status(200)
		.json({ message: `Thêm mới học sinh thành công, tài khoản: ${usercode}` });
};

const updateStudent = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_student');
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
	const studentId = req.params.studentId;
	const { profile, listClass, listCourse } = req.body;

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

	if (listClass.length > 0) {
		for (let i = 0; i < listClass.length; i++) {
			if (
				!validateIsEmpty(listClass[i].payment_id) ||
				!validator.matches(listClass[i].status, /^(0|1)$/)
			) {
				return next(
					new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
				);
			}
		}
	}
	if (listCourse.length > 0) {
		for (let i = 0; i < listCourse.length; i++) {
			if (!validateIsEmpty(listCourse[i].course_id)) {
				return next(
					new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
				);
			}

			if (validateIsEmpty(listCourse[i].join_date)) {
				if (
					!validator.isDate(
						new Date(listCourse[i].join_date).toISOString().substr(0, 10)
					)
				) {
					return next(
						new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
					);
				}
			}
		}
	}

	const client = await pool.connect();
	await client.query('BEGIN');

	if (profile.email) {
		let check;
		try {
			const query = `SELECT user_id FROM users WHERE email = $1 and user_id <> $2 LIMIT 1`;
			const params = [profile.email, studentId];

			check = await client.query(query, params);
		} catch (err) {
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'student.controller.js',
				'updateStudent'
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
			studentId,
		];

		await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'updateStudent'
		);
		return next(error);
	}

	if (listClass.length > 0) {
		try {
			for (let i = 0; i < listClass.length; i++) {
				if (listClass[i].status == '0') {
					const query = `UPDATE payment					
					SET status=$1, payment_date=$2, modified_by=$3, modified_at=$4				
					WHERE payment_id=$5`;
					const params = [
						listClass[i].status,
						null,
						userId,
						new Date(),
						listClass[i].payment_id,
					];

					await client.query(query, params);
				} else {
					const query = `UPDATE payment					
					SET status=$1, payment_date=$2, modified_by=$3, modified_at=$4				
					WHERE payment_id=$5`;
					const params = [
						listClass[i].status,
						listClass[i].status === '1' ? new Date() : null,
						userId,
						new Date(),
						listClass[i].payment_id,
					];

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
				'student.controller.js',
				'updateStudent'
			);
			return next(error);
		}
	}

	if (listCourse.length > 0) {
		try {
			for (let i = 0; i < listCourse.length; i++) {
				let checkJoinDate;
				const checkJoinDateQuery = `SELECT join_date FROM course_student WHERE course_id = $1 AND student_id = $2`;
				const checkJoinDateParams = [listCourse[i].course_id, studentId];

				checkJoinDate = await client.query(
					checkJoinDateQuery,
					checkJoinDateParams
				);

				if (
					checkJoinDate.rows[0].join_date !== null &&
					listCourse[i].join_date !== null
				) {
					continue;
				}

				if (
					checkJoinDate.rows[0].join_date === null &&
					listCourse[i].join_date === null
				) {
					continue;
				}

				let price;
				const queryPrice = `Select ((cost*percent)/100) as price from course where course_id = $1`;
				const paramPrice = [listCourse[i].course_id];

				price = await client.query(queryPrice, paramPrice);

				const query = `UPDATE course_student						
				SET modified_by=$1, modified_at=$2, join_date=$3					
				where course_id =$4 and student_id =$5`;
				const params = [
					userId,
					new Date(),
					listCourse[i].join_date,
					listCourse[i].course_id,
					studentId,
				];

				await client.query(query, params);

				let teacher;
				const teacherQuery = `SELECT created_by FROM course WHERE course_id = $1 LIMIT 1`;
				const teacherParams = [listCourse[i].course_id];

				teacher = await client.query(teacherQuery, teacherParams);

				let check;
				const checkQuery = `SELECT salary_course_id,total,total_course_sold FROM salary_course WHERE course_id = $1 AND month = $2 AND year = $3 LIMIT 1`;
				const checkParams = [
					listCourse[i].course_id,
					('0' + (new Date().getMonth() + 1)).slice(-2),
					new Date().getFullYear(),
				];

				check = await client.query(checkQuery, checkParams);
				if (check.rowCount < 1) {
					const insertQuery = `INSERT INTO salary_course(
							salary_course_id, course_id, total, status, total_course_sold, user_id, month, year, created_by, modified_by)
							VALUES (nextval('salary_course_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9)`;
					const insertParams = [
						listCourse[i].course_id,
						price.rows[0].price,
						'0',
						1,
						teacher.rows[0].created_by,
						('0' + (new Date().getMonth() + 1)).slice(-2),
						new Date().getFullYear(),
						userId,
						userId,
					];

					await client.query(insertQuery, insertParams);
				} else {
					const oldTotal = check.rows[0].total;
					const oldTotalCourseSold = check.rows[0].total_course_sold;

					if (listCourse[i].join_date !== null) {
						const updateQuery = `UPDATE salary_course
						SET total=$1, total_course_sold=$2, modified_by=$3, modified_at=$4 
						WHERE salary_course_id = $5`;
						const updateParams = [
							parseFloat(price.rows[0].price) + parseFloat(oldTotal),
							parseInt(oldTotalCourseSold) + 1,
							userId,
							new Date(),
							check.rows[0].salary_course_id,
						];

						await pool.query(updateQuery, updateParams);
					} else {
						const updateQuery = `UPDATE salary_course
						SET total=$1, total_course_sold=$2, modified_by=$3, modified_at=$4
						WHERE salary_course_id = $5`;
						const updateParams = [
							parseFloat(price.rows[0].price) - parseFloat(oldTotal),
							parseInt(oldTotalCourseSold) - 1,
							userId,
							new Date(),
							check.rows[0].salary_course_id,
						];

						await pool.query(updateQuery, updateParams);
					}
				}
			}
		} catch (err) {
			await client.query('ROLLBACK');
			const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'student.controller.js',
				'updateStudent'
			);
			return next(error);
		}
	}

	await client.query('COMMIT');
	client.release();

	return res.status(200).json({ message: 'Cập nhập thành công' });
};

const deleteStudent = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_student');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const studentId = req.params.studentId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '0', studentId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'deleteStudent'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreStudent = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_student');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const studentId = req.params.studentId;

	try {
		const query = `UPDATE users
		SET modified_by=$1, modified_at=$2, status=$3
		WHERE user_id = $4`;
		const params = [userId, new Date(), '1', studentId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'restoreStudent'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

const getStudentWeeklyTimetable = async (req, res, next) => {
	const userId = req.userData.userId;
	const role = req.userData.role;

	if (role !== '5') {
		const error = new HttpError('Bạn không có quyền truy cập trang này.', 403);
		return next(error);
	}

	let timetables;
	try {
		const query = `Select DISTINCT schedule.schedule_id, class.class_id, class.class_name,room.room_name,slot.slot_name,slot.slot_id,					
		schedule.date,schedule.day_of_week,schedule.week_of_year,			
		attendance.is_active,schedule.status, class.class_status			
from attendance					
inner join					
	schedule on attendance.schedule_id = schedule.schedule_id				
inner join					
	class on schedule.class_id = class.class_id	
inner join
	class_student on class.class_id = class_student.class_id			
inner join					
	room on schedule.room_id = room.room_id				
inner join					
	slot on schedule.slot_id = slot.slot_id				
where attendance.user_id = $1 AND class.class_status != '2' AND class_student.flag = false				 
order by date ASC`;
		const params = [userId];

		timetables = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'student.controller.js',
			'getStudentWeeklyTimetable'
		);
		return next(error);
	}

	return res.status(200).json(timetables.rows);
};

module.exports = {
	getStudents,
	getStudentById,
	createStudent,
	updateStudent,
	deleteStudent,
	restoreStudent,
	getStudentsByClassId,
	getStudentWeeklyTimetable,
};
