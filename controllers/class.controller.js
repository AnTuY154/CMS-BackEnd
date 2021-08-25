const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const {
	getDays,
	checkRole,
	checkDayBelongWeek,
} = require('../common/function');
const { validateIsEmpty, validateMaxLength } = require('../common/validate');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const validator = require('validator').default;

const getAllClasses = async (req, res, next) => {
	let classes;
	try {
		const query = 'SELECT class_id, class_name FROM class';
		classes = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getAllClasses'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

const getClasses = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	const { page, q, subject, room, status } = req.query;

	const offset = (page - 1) * 10;

	let count;
	try {
		const query = `SELECT COUNT(class_id) as total FROM class`;
		count = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'getClasses'
		);
		return next(error);
	}

	if (count.rows[0].total == '0') {
		return res.status(200).json({
			data: [],
			pagination: {
				page: 1,
				limit: 10,
				totalRows: 0,
			},
		});
	}

	let countClass;
	try {
		const query = `Select distinct a.class_id,number_student,b.class_name,b.subject_name,b.teacher_name, b.price ,										
		b.percent,string_agg(b.room_name , ',') as room_name , b.class_status , b.created_at,b.flag	,b.percent,string_agg(b.room_id , ',') as room_id,b.subject_id									
		from (										
		SELECT count(users.user_id) as number_student,class.class_id										
		FROM class										
		LEFT JOIN class_student										
		ON class.class_id = class_student.class_id AND class_student.flag = false
		LEFT JOIN users ON users.user_id = class_student.student_id AND users.status = '1'										
		group by class.class_id										
		) a INNER JOIN (										
		SELECT  distinct class.class_id, class.class_name , subject.subject_name ,										
		users.full_name as teacher_name , class.price , class.percent ,  room.room_name , class.class_status ,class.created_at,class.flag,room.room_id,subject.subject_id										
		FROM class INNER JOIN subject ON class.subject_id = subject.subject_id										
		INNER JOIN users   ON class.teacher_id = users.user_id										
		INNER JOIN schedule    ON class.class_id   = schedule.class_id										
		INNER JOIN room on schedule.room_id = room.room_id										
		) b On a.class_id = b.class_id										
		where  (LOWER(b.class_name) like LOWER($1) or LOWER(b.teacher_name) like LOWER($2) ) and b.class_status ${
			status === '' ? '!' : ''
		}=$3 and b.room_id ${room === '' ? '!' : ''}=$4   and b.subject_id ${
			subject === '' ? '!' : ''
		}=$5										
		group by a.class_id,a.number_student,b.class_name, b.subject_name,b.teacher_name, b.price ,										
		b.percent, b.class_status, b.created_at, b.flag,b.subject_id										
		order by b.class_status, b.created_at DESC																			 
	`;
		const param = ['%' + q + '%', '%' + q + '%', status, room, subject];
		countClass = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClasses'
		);
		return next(error);
	}

	let classes;
	try {
		const query = `Select distinct a.class_id,number_student,b.class_name,b.subject_name,b.teacher_name, b.price ,										
		b.percent,string_agg(b.room_name , ',') as room_name , b.class_status , b.created_at,b.flag,string_agg(b.room_id , ',') as room_id,b.subject_id									
		from (										
			SELECT count(users.user_id) as number_student,class.class_id										
			FROM class										
			LEFT JOIN class_student										
			ON class.class_id = class_student.class_id AND class_student.flag = false
			LEFT JOIN users ON users.user_id = class_student.student_id AND users.status = '1'										
			group by class.class_id										
		) a INNER JOIN (										
		SELECT  distinct class.class_id, class.class_name , subject.subject_name ,										
		users.full_name as teacher_name , class.price , class.percent ,  room.room_name , class.class_status ,class.created_at,class.flag,room.room_id,subject.subject_id										
		FROM class INNER JOIN subject ON class.subject_id = subject.subject_id										
		INNER JOIN users   ON class.teacher_id = users.user_id										
		INNER JOIN schedule    ON class.class_id   = schedule.class_id										
		INNER JOIN room on schedule.room_id = room.room_id										
		) b On a.class_id = b.class_id										
		where  (LOWER(b.class_name) like LOWER($1) or LOWER(b.teacher_name) like LOWER($2) ) and b.class_status ${
			status === '' ? '!' : ''
		}=$3 and b.room_id ${room === '' ? '!' : ''}=$4   and b.subject_id ${
			subject === '' ? '!' : ''
		}=$5										
		group by a.class_id,a.number_student,b.class_name, b.subject_name,b.teacher_name, b.price ,										
		b.percent, b.class_status, b.created_at, b.flag,b.subject_id										
		order by  b.created_at DESC OFFSET $6 LIMIT 10																				 
	`;
		const param = ['%' + q + '%', '%' + q + '%', status, room, subject, offset];
		classes = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClasses'
		);
		return next(error);
	}

	const result = {
		data: classes.rows,
		pagination: {
			page: parseInt(page),
			limit: 10,
			totalRows: countClass.rowCount,
		},
	};
	return res.status(200).json(result);
};

const getClassByClassId = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	const classId = req.params.classId;

	let countStudent;
	try {
		const query = `Select count(student_id) from class_student where class_id=$1 and flag=false`;
		const params = [classId];
		countStudent = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	let classinfo;
	try {
		const query = `SELECT class.class_id, class.max_student_in_class, class.class_name, class.teacher_id, class.subject_id,
		subject.subject_name,class.grade_level, class.tutor_id, class.percent,to_char(class.start_day, 'YYYY-MM-DD') as start_day,
		to_char(class.end_day, 'YYYY-MM-DD') as end_day, class.class_status, class.note,
		class.modified_at, class.price, class.flag			
		FROM class INNER JOIN					
		subject ON class.subject_id = subject.subject_id and subject.flag=false INNER JOIN						
		users ON class.teacher_id = users.user_id and users.flag=false						
			where class.class_id=$1 and class.flag=false`;
		const params = [classId];
		classinfo = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	if (classinfo.rowCount < 1) {
		const error = new HttpError('Không tìm thấy lớp học', 402);
		return next(error);
	}

	if (classinfo.rows[0].class_status === '3') {
		const error = new HttpError('Lớp học đã bị xóa', 404);
		return next(error);
	}

	let schedule;
	try {
		const query = `Select slot.slot_name,slot.slot_id,room.room_id,room.room_name,schedule.day_of_week, schedule.type								
		from								
		schedule								
		INNER JOIN slot on slot.slot_id = schedule.slot_id and slot.flag=false								
		INNER JOIN room on room.room_id = schedule.room_id and room.flag=false								
		where class_id =$1 AND (schedule.type = '1' OR schedule.type = '0')								
		group by schedule.class_id,schedule.slot_id, schedule.type, schedule.room_id,schedule.day_of_week,slot.slot_name,room.room_name,slot.slot_id,room.room_id`;
		const params = [classId];
		schedule = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	let detailSchedule;
	try {
		const query = `Select slot.slot_name,slot.slot_id,room.room_id,room.room_name,schedule.day_of_week, schedule.type					
		,schedule.status,slot.start_time,slot.end_time,schedule.schedule_id,schedule.date, schedule.week_of_year, schedule.teacher_id,
		(SELECT users.full_name FROM users WHERE users.user_id = schedule.teacher_id) as teacher_name, schedule.tutor_id,
		(SELECT users.full_name FROM users WHERE users.user_id = schedule.tutor_id) as tutor_name
		from					
		schedule					
		INNER JOIN slot on slot.slot_id = schedule.slot_id and slot.flag=false					
		INNER JOIN room on room.room_id = schedule.room_id and slot.flag=false					
		where class_id =$1 and status !='2'  and date >=$2 and date <= $3`;
		const params = [
			classId,
			classinfo.rows[0].start_day,
			classinfo.rows[0].end_day,
		];
		detailSchedule = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	return res.status(200).json({
		studentNumber: countStudent.rows[0].count,
		classinfo: classinfo.rows[0],
		schedule: schedule.rows,
		detailSchedule: detailSchedule.rows,
	});
};

const createClass = async (req, res, next) => {
	// check role
	const check = await checkRole(req.userData.role, 'function_create_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	// check validate
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	const userId = req.userData.userId;

	const { classinfo, classtimetable } = req.body;

	if (
		!validateIsEmpty(classinfo.classname) ||
		!validateIsEmpty(classinfo.teacher) ||
		!validateIsEmpty(classinfo.price) ||
		!validateIsEmpty(classinfo.startdate) ||
		!validateIsEmpty(classinfo.percent) ||
		!validateIsEmpty(classinfo.subject) ||
		!validateIsEmpty(classinfo.maxstudent) ||
		!validateIsEmpty(classinfo.grade) ||
		!validateIsEmpty(classinfo.enddate)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validateMaxLength(classinfo.classname, 255) ||
		!validateMaxLength(classinfo.teacher, 255) ||
		!validateMaxLength(classinfo.price, 255) ||
		!validateMaxLength(classinfo.startdate, 255) ||
		!validateMaxLength(classinfo.percent, 255) ||
		!validateMaxLength(classinfo.subject, 255) ||
		!validateMaxLength(classinfo.maxstudent, 255) ||
		!validateMaxLength(classinfo.grade, 255) ||
		!validateMaxLength(classinfo.enddate, 255) ||
		!validateMaxLength(classinfo.note, 1000)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validator.isNumeric(classinfo.price.toString()) ||
		!validator.isDate(classinfo.startdate) ||
		!validator.isNumeric(classinfo.percent.toString()) ||
		!validator.isNumeric(classinfo.maxstudent.toString()) ||
		!validator.matches(classinfo.grade, /^(1|2|3|4|5|6|7|8|9|10|11|12)$/) ||
		!validator.isDate(classinfo.enddate)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		new Date().getTime() >= new Date(classinfo.startdate).getTime() ||
		new Date(classinfo.startdate).getTime() >=
			new Date(classinfo.enddate).getTime()
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	const client = await pool.connect();

	await client.query('BEGIN');

	// check duplicate
	let checkClass;
	try {
		for (let i = 0; i < classtimetable.length; i++) {
			let query = `SELECT DISTINCT class.class_id, class.class_name, room.room_name, schedule.day_of_week, users.full_name, slot.slot_name 
			FROM schedule INNER JOIN
			room ON room.room_id = schedule.room_id INNER JOIN
							slot ON slot.slot_id = schedule.slot_id and slot.type='0' INNER JOIN
							class On class.class_id = schedule.class_id INNER JOIN
							users on users.user_id = schedule.teacher_id
			where
			schedule.date >= $1 and schedule.slot_id = $2
			and schedule.room_id = $3 and schedule.day_of_week = $4 and (schedule.status = '3' or schedule.status in('0', '1')) and schedule.flag=false`;
			const params = [
				classinfo.startdate,
				classtimetable[i].slot,
				classtimetable[i].room,
				classtimetable[i].day,
			];
			checkClass = await client.query(query, params);
			if (checkClass.rowCount > 0) {
				return res.json({ duplicate: true, data: checkClass.rows });
			}
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'createClass'
		);
		return next(error);
	}

	// teacher
	let checkTeacher;
	try {
		for (let i = 0; i < classtimetable.length; i++) {
			let query = `SELECT DISTINCT class.class_id, class.class_name, room.room_name, schedule.day_of_week, users.full_name, slot.slot_name	
			FROM  schedule INNER JOIN
			room ON room.room_id = schedule.room_id INNER JOIN
							slot ON slot.slot_id = schedule.slot_id and slot.type='0' INNER JOIN
							class On class.class_id = schedule.class_id INNER JOIN
							users on users.user_id = schedule.teacher_id
				where
			schedule.date >= $1 and schedule.slot_id=$2
			and schedule.teacher_id=$3 and schedule.day_of_week=$4 and schedule.status != '2' and schedule.flag=false`;
			const params = [
				classinfo.startdate,
				classtimetable[i].slot,
				classinfo.teacher,
				classtimetable[i].day,
			];
			checkTeacher = await client.query(query, params);
			if (checkTeacher.rowCount > 0) {
				return res.json({ duplicate: true, data: checkTeacher.rows });
			}
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'createClass'
		);
		return next(error);
	}

	// insert to class table
	let classroom;
	try {
		let query;
		let params;
		if (classinfo.tutor !== '') {
			query = `INSERT INTO class(
				class_id, class_name, teacher_id, class_type, price, start_day, percent, tutor_id, created_by, modified_by,subject_id,note,max_student_in_class, grade_level, end_day, class_status)
				VALUES (nextval('class_id'), $1, $2, '1', $3, $4, $5, $6, $7,$8, $9,$10, $11, $12, $13, $14) RETURNING class_id`;
			params = [
				classinfo.classname,
				classinfo.teacher,
				classinfo.price,
				new Date(classinfo.startdate),
				classinfo.percent,
				classinfo.tutor,
				userId,
				userId,
				classinfo.subject,
				classinfo.note,
				classinfo.maxstudent,
				classinfo.grade,
				new Date(classinfo.enddate),
				'0',
			];
		} else {
			query = `INSERT INTO class(
				class_id, class_name, teacher_id, class_type, price, start_day, percent, created_by, modified_by,subject_id,note,max_student_in_class, grade_level, end_day, class_status)
				VALUES (nextval('class_id'), $1, $2, '1', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING class_id`;
			params = [
				classinfo.classname,
				classinfo.teacher,
				classinfo.price,
				new Date(classinfo.startdate),
				classinfo.percent,
				userId,
				userId,
				classinfo.subject,
				classinfo.note,
				classinfo.maxstudent,
				classinfo.grade,
				new Date(classinfo.enddate),
				'0',
			];
		}

		classroom = await client.query(query, params);
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'createClass'
		);
		return next(error);
	}

	// insert schedule
	try {
		for (let i = 0; i < classtimetable.length; i++) {
			const days = getDays(
				classinfo.startdate,
				classtimetable[i].day,
				classinfo.enddate
			);
			for (let j = 0; j < days.length; j++) {
				let query;
				let params;
				if (classinfo.tutor !== '') {
					query = `INSERT INTO schedule(								
						schedule_id, class_id, teacher_id, date, status, tutor_id, created_by,modified_by, slot_id, room_id,day_of_week, type, week_of_year)							
						VALUES (nextval('schedule_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING schedule_id`;
					params = [
						classroom.rows[0].class_id,
						classinfo.teacher,
						days[j],
						'0',
						classinfo.tutor,
						userId,
						userId,
						classtimetable[i].slot,
						classtimetable[i].room,
						new Date(days[j]).getDay(),
						classtimetable[i].type,
						checkDayBelongWeek(days[j]),
					];
				} else {
					query = `INSERT INTO schedule(								
						schedule_id, class_id, teacher_id, date, status, created_by,modified_by, slot_id, room_id,day_of_week, type, week_of_year)							
						VALUES (nextval('schedule_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING schedule_id`;
					params = [
						classroom.rows[0].class_id,
						classinfo.teacher,
						days[j],
						'0',
						userId,
						userId,
						classtimetable[i].slot,
						classtimetable[i].room,
						new Date(days[j]).getDay(),
						classtimetable[i].type,
						checkDayBelongWeek(days[j]),
					];
				}
				const schedule = await client.query(query, params);

				const teacherQuery = `INSERT INTO attendance(					
					attendance_id, schedule_id, user_id, created_by,modified_by)				
					VALUES (nextval('attendance_id'), $1, $2, $3, $4)`;
				const teacherParams = [
					schedule.rows[0].schedule_id,
					classinfo.teacher,
					'Admin1',
					'Admin1',
				];
				await client.query(teacherQuery, teacherParams);

				if (classinfo.tutor !== '') {
					const tutorQuery = `INSERT INTO attendance(					
						attendance_id, schedule_id, user_id, created_by,modified_by)				
						VALUES (nextval('attendance_id'), $1, $2, $3, $4)`;
					const tutorParams = [
						schedule.rows[0].schedule_id,
						classinfo.tutor,
						userId,
						userId,
					];
					await client.query(tutorQuery, tutorParams);
				}
			}
		}
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'createClass'
		);
		return next(error);
	}

	await client.query('COMMIT');
	client.release();

	return res.status(200).json({ message: 'Tạo mới lớp học thành công' });
};

const updateClass = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const classId = req.params.classId;
	const { classInfo, detailSchedules } = req.body;

	if (
		!validateIsEmpty(classInfo.classname) ||
		!validateIsEmpty(classInfo.teacher) ||
		!validateIsEmpty(classInfo.price) ||
		!validateIsEmpty(classInfo.startdate) ||
		!validateIsEmpty(classInfo.percent) ||
		!validateIsEmpty(classInfo.subject) ||
		!validateIsEmpty(classInfo.maxstudent) ||
		!validateIsEmpty(classInfo.grade) ||
		!validateIsEmpty(classInfo.enddate)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validateMaxLength(classInfo.classname, 255) ||
		!validateMaxLength(classInfo.teacher, 255) ||
		!validateMaxLength(classInfo.price, 255) ||
		!validateMaxLength(classInfo.startdate, 255) ||
		!validateMaxLength(classInfo.percent, 255) ||
		!validateMaxLength(classInfo.subject, 255) ||
		!validateMaxLength(classInfo.maxstudent, 255) ||
		!validateMaxLength(classInfo.grade, 255) ||
		!validateMaxLength(classInfo.enddate, 255) ||
		!validateMaxLength(classInfo.note, 1000)
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		!validator.isNumeric(classInfo.price.toString()) ||
		!validator.isDate(classInfo.startdate.toString()) ||
		!validator.isNumeric(classInfo.percent.toString()) ||
		!validator.isNumeric(classInfo.maxstudent.toString()) ||
		!validator.matches(
			classInfo.grade.toString(),
			/^(1|2|3|4|5|6|7|8|9|10|11|12)$/
		) ||
		!validator.isDate(classInfo.enddate.toString())
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	if (
		new Date(classInfo.startdate).getTime() >=
		new Date(classInfo.enddate).getTime()
	) {
		return next(
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	for (let i = 0; i < detailSchedules.length; i++) {
		if (
			!validateIsEmpty(detailSchedules[i].date) ||
			!validateIsEmpty(detailSchedules[i].day_of_week) ||
			!validateIsEmpty(detailSchedules[i].room_id) ||
			!validateIsEmpty(detailSchedules[i].schedule_id) ||
			!validateIsEmpty(detailSchedules[i].slot_id) ||
			!validateIsEmpty(detailSchedules[i].status) ||
			!validateIsEmpty(detailSchedules[i].teacher_id) ||
			!validateIsEmpty(detailSchedules[i].type) ||
			!validateIsEmpty(detailSchedules[i].week_of_year)
		) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}

		if (
			new Date(detailSchedules[i].date).getDay() !==
			detailSchedules[i].day_of_week
		) {
			return next(
				new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
			);
		}
	}

	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		let checkClass;
		for (let i = 0; i < detailSchedules.length; i++) {
			let checkClassQuery = `SELECT DISTINCT class.class_id, class.class_name, room.room_name, schedule.day_of_week, users.full_name, slot.slot_name 
			FROM schedule INNER JOIN
			room ON room.room_id = schedule.room_id INNER JOIN
							slot ON slot.slot_id = schedule.slot_id and slot.type='0' INNER JOIN
							class On class.class_id = schedule.class_id INNER JOIN
							users on users.user_id = schedule.teacher_id
			where
			class.class_id != $1 AND
			schedule.date >= $2 and schedule.slot_id = $3
			and schedule.room_id = $4 and schedule.day_of_week = $5 and (schedule.status = '3' or schedule.status in('0', '1')) and schedule.flag=false`;
			const checkClassParams = [
				classId,
				classInfo.startdate,
				detailSchedules[i].slot_id,
				detailSchedules[i].room_id,
				detailSchedules[i].day_of_week,
			];
			checkClass = await client.query(checkClassQuery, checkClassParams);
			if (checkClass.rowCount > 0) {
				return res.json({ duplicate: true, data: checkClass.rows });
			}
		}
		// teacher
		let checkTeacher;
		for (let i = 0; i < detailSchedules.length; i++) {
			let checkTeacherQuery = `SELECT DISTINCT class.class_id, class.class_name, room.room_name, schedule.day_of_week, users.full_name, slot.slot_name	
			FROM  schedule INNER JOIN
			room ON room.room_id = schedule.room_id INNER JOIN
							slot ON slot.slot_id = schedule.slot_id and slot.type='0' INNER JOIN
							class On class.class_id = schedule.class_id INNER JOIN
							users on users.user_id = schedule.teacher_id
				where
				class.class_id != $1 AND
			schedule.date >= $2 and schedule.slot_id=$3
			and schedule.teacher_id=$4 and schedule.day_of_week=$5 and schedule.status != '2' and schedule.flag=false`;
			const checkTeacherParams = [
				classId,
				classInfo.startdate,
				detailSchedules[i].slot,
				detailSchedules.teacher_id,
				detailSchedules[i].day_of_week,
			];
			checkTeacher = await client.query(checkTeacherQuery, checkTeacherParams);
			if (checkTeacher.rowCount > 0) {
				return res.json({ duplicate: true, data: checkTeacher.rows });
			}
		}

		let oldClassInfo;
		const oldClassInfoQuery = `SELECT class.class_id, class.max_student_in_class, class.class_name, class.teacher_id, class.subject_id,
		subject.subject_name,class.grade_level, class.tutor_id, class.percent, class.start_day, class.end_day, class.class_status, class.note,
		class.modified_at, class.price
		FROM class INNER JOIN
		subject ON class.subject_id = subject.subject_id and subject.flag=false INNER JOIN
		users ON class.teacher_id = users.user_id and users.flag=false
			where class.class_id=$1 and class.flag=false`;
		const oldClassInfoParams = [classId];
		oldClassInfo = await client.query(oldClassInfoQuery, oldClassInfoParams);

		if (oldClassInfo.rows[0].class_status === '2') {
			const error = new HttpError('Lớp đã kết thúc', 404);
			return next(error);
		}

		let updateClassQuery;
		let updateClassParams;
		if (classInfo.tutor) {
			updateClassQuery = `UPDATE class
				SET class_name=$1, teacher_id=$2, class_type=$3, percent=$4, tutor_id=$5,modified_by=$6, modified_at=$7, subject_id=$8,
				 note=$9, max_student_in_class=$10, grade_level=$11
				WHERE class_id=$12`;
			updateClassParams = [
				classInfo.classname,
				classInfo.teacher,
				'1',
				classInfo.percent,
				classInfo.tutor,
				userId,
				new Date(),
				classInfo.subject,
				classInfo.note,
				classInfo.maxstudent,
				classInfo.grade,
				classId,
			];
		} else {
			updateClassQuery = `UPDATE class
				SET class_name=$1, teacher_id=$2, class_type=$3, percent=$4, modified_by=$5, modified_at=$6, subject_id=$7,
				 note=$8, max_student_in_class=$9, grade_level=$10
				WHERE class_id=$11`;
			updateClassParams = [
				classInfo.classname,
				classInfo.teacher,
				'1',
				classInfo.percent,
				userId,
				new Date(),
				classInfo.subject,
				classInfo.note,
				classInfo.maxstudent,
				classInfo.grade,
				classId,
			];
		}

		await client.query(updateClassQuery, updateClassParams);

		let oldDetailSchedule;

		const oldDetailScheduleQuery = `Select slot.slot_name,slot.slot_id,room.room_id,room.room_name,schedule.day_of_week, schedule.type
			,schedule.status,slot.start_time,slot.end_time,schedule.schedule_id,schedule.date, schedule.week_of_year, schedule.teacher_id,
			(SELECT users.full_name FROM users WHERE users.user_id = schedule.teacher_id) as teacher_name, schedule.tutor_id,
			(SELECT users.full_name FROM users WHERE users.user_id = schedule.tutor_id) as tutor_name
			from
			schedule
			INNER JOIN slot on slot.slot_id = schedule.slot_id and slot.flag=false
			INNER JOIN room on room.room_id = schedule.room_id and slot.flag=false
			where class_id =$1 and status !='2'  and date >=$2 and date <= $3`;
		const oldDetailScheduleParams = [
			classId,
			oldClassInfo.rows[0].start_day,
			oldClassInfo.rows[0].end_day,
		];
		oldDetailSchedule = await client.query(
			oldDetailScheduleQuery,
			oldDetailScheduleParams
		);

		if (
			oldClassInfo.rows[0].class_status !== '0' &&
			new Date(oldClassInfo.rows[0].start_day).getFullYear() +
				'-' +
				('0' + (new Date().getMonth() + 1)).slice(-2) +
				'-' +
				('0' + new Date().getDate()).slice(-2) !==
				new Date(classInfo.startdate).getFullYear() +
					'-' +
					('0' + (new Date().getMonth() + 1)).slice(-2) +
					'-' +
					('0' + new Date().getDate()).slice(-2)
		) {
			const error = new HttpError(
				'Lớp đang hoạt động, không thể sửa ngày bắt đầu',
				404
			);
			return next(error);
		}

		let oldPrice;
		const oldPriceQuery = `SELECT price FROM class WHERE class_id = $1`;
		const oldPriceParams = [classId];

		oldPrice = await client.query(oldPriceQuery, oldPriceParams);

		let checkExistStudent;
		const checkExistStudentQuery = `SELECT class_student.student_id FROM class_student INNER JOIN class ON class_student.class_id = class.class_id
	INNER JOIN users ON class_student.student_id = users.user_id
	WHERE class_student.class_id = $1 AND class_status = '0' AND users.status = '1'`;
		const checkExistStudentParams = [classId];

		checkExistStudent = await client.query(
			checkExistStudentQuery,
			checkExistStudentParams
		);
		if (checkExistStudent.rowCount > 0) {
			if (
				oldPrice.rows[0].price.toString() !== classInfo.price.toString() ||
				detailSchedules.length !== oldDetailSchedule.rowCount
			) {
				const totalLesson = detailSchedules.filter(
					(ds) => new Date(ds.date).getMonth() + 1 === new Date().getMonth() + 1
				).length;

				// gia khong doi buoi doi
				if (
					detailSchedules.length !== oldDetailSchedule.rowCount &&
					oldPrice.rows[0].price.toString() === classInfo.price.toString()
				) {
					const month = ('0' + (new Date().getMonth() + 1)).slice(-2);
					let oldScheduleThisMonth;
					const oldScheduleThisMonthQuery = `Select count(schedule.schedule_id)
						 from schedule						
						 where class_id =$1 and status !='2'  and date >= $2 and date <= $3 AND to_char(date, 'MM') = $4 AND
						 to_char(date, 'YYYY') = $5`;
					const oldScheduleThisMonthParams = [
						classId,
						new Date(),
						new Date(classInfo.enddate),
						month,
						new Date().getFullYear(),
					];

					oldScheduleThisMonth = await client.query(
						oldScheduleThisMonthQuery,
						oldScheduleThisMonthParams
					);

					const oldChangePrice = oldScheduleThisMonth.rows[0].count;
					const daysChangePrice = detailSchedules.filter(
						(ds) =>
							new Date().getTime() < new Date(ds.date).getTime() &&
							new Date(ds.date).getMonth() + 1 === new Date().getMonth() + 1
					).length;

					const totalPriceOld =
						parseFloat(oldPrice.rows[0].price) * oldChangePrice;
					const totalPriceNew =
						parseFloat(oldPrice.rows[0].price) * daysChangePrice;

					let check = false;
					if (totalPriceOld > totalPriceNew) {
						check = true;
					}

					for (let i = 0; i < checkExistStudent.rowCount; i++) {
						let oldPayment;
						const oldPaymentQuery = `SELECT additional_charges, residual_fee FROM payment				
				WHERE class_id = $1 AND student_id = $2 AND month = $3 AND flag=false`;
						const oldPaymentParams = [
							classId,
							checkExistStudent.rows[i].student_id,
							month,
						];
						oldPayment = await client.query(oldPaymentQuery, oldPaymentParams);
						let query;
						let params;

						if (check) {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, residual_fee=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'122222',
								totalLesson,
								oldPayment.rows[0].residual_fee +
									(totalPriceOld - totalPriceNew),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						} else {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, additional_charges=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'12222',
								totalLesson,
								oldPayment.rows[0].additional_charges +
									(totalPriceNew - totalPriceOld),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						}
					}
				} else if (
					detailSchedules.length !== oldDetailSchedule.rowCount &&
					oldPrice.rows[0].price.toString() !== classInfo.price.toString()
				) {
					const month = ('0' + (new Date().getMonth() + 1)).slice(-2);
					let oldScheduleThisMonth;
					const oldScheduleThisMonthQuery = `Select count(schedule.schedule_id)
						 from schedule						
						 where class_id =$1 and status !='2'  and date >= $2 and date <= $3 AND to_char(date, 'MM') = $4 AND
						 to_char(date, 'YYYY') = $5`;
					const oldScheduleThisMonthParams = [
						classId,
						new Date(),
						new Date(classInfo.enddate),
						month,
						new Date().getFullYear(),
					];

					oldScheduleThisMonth = await client.query(
						oldScheduleThisMonthQuery,
						oldScheduleThisMonthParams
					);

					const oldChangePrice = oldScheduleThisMonth.rows[0].count;
					const daysChangePrice = detailSchedules.filter(
						(ds) =>
							new Date().getTime() < new Date(ds.date).getTime() &&
							new Date(ds.date).getMonth() + 1 === new Date().getMonth() + 1
					).length;

					const totalPriceOld =
						parseFloat(oldPrice.rows[0].price) * oldChangePrice;
					const totalPriceNew = parseFloat(classInfo.price) * daysChangePrice;

					let check = false;
					if (totalPriceOld > totalPriceNew) {
						check = true;
					}

					for (let i = 0; i < checkExistStudent.rowCount; i++) {
						let oldPayment;
						const oldPaymentQuery = `SELECT additional_charges, residual_fee FROM payment				
				WHERE class_id = $1 AND student_id = $2 AND month = $3 AND flag=false`;
						const oldPaymentParams = [
							classId,
							checkExistStudent.rows[i].student_id,
							month,
						];
						oldPayment = await client.query(oldPaymentQuery, oldPaymentParams);
						let query;
						let params;

						if (check) {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, residual_fee=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'122222',
								totalLesson,
								oldPayment.rows[0].residual_fee +
									(totalPriceOld - totalPriceNew),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						} else {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, additional_charges=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'12222',
								totalLesson,
								oldPayment.rows[0].additional_charges +
									(totalPriceNew - totalPriceOld),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						}
					}

					const updateClass1Query = `UPDATE class	SET price=$1 WHERE class_id=$2`;
					const updateClass1Params = [classInfo.price, classId];

					await client.query(updateClass1Query, updateClass1Params);
				} else if (detailSchedules.length === oldDetailSchedule.rowCount) {
					const daysChangePrice = detailSchedules.filter(
						(ds) =>
							new Date().getTime() < new Date(ds.date).getTime() &&
							new Date(ds.date).getMonth() + 1 === new Date().getMonth() + 1
					);

					const totalPriceOld =
						parseFloat(oldPrice.rows[0].price) * daysChangePrice.length;
					const totalPriceNew =
						parseFloat(classInfo.price) * daysChangePrice.length;

					const month = ('0' + (new Date().getMonth() + 1)).slice(-2);

					let check = false;
					if (totalPriceOld > totalPriceNew) {
						check = true;
					}

					for (let i = 0; i < checkExistStudent.rowCount; i++) {
						let oldPayment;
						const oldPaymentQuery = `SELECT additional_charges, residual_fee FROM payment				
				WHERE class_id = $1 AND student_id = $2 AND month = $3 AND flag=false`;
						const oldPaymentParams = [
							classId,
							checkExistStudent.rows[i].student_id,
							month,
						];
						oldPayment = await client.query(oldPaymentQuery, oldPaymentParams);
						let query;
						let params;

						if (check) {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, residual_fee=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'122222',
								totalLesson,
								oldPayment.rows[0].residual_fee +
									(totalPriceOld - totalPriceNew),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						} else {
							query = `UPDATE payment
								SET modified_by=$1, modified_at=$2, class_price=$3, total_lesson_in_month=$4, additional_charges=$5
								WHERE class_id = $6 AND student_id = $7 AND month = $8 AND flag=false`;
							params = [
								userId,
								new Date(),
								'12222',
								totalLesson,
								oldPayment.rows[0].additional_charges +
									(totalPriceNew - totalPriceOld),
								classId,
								checkExistStudent.rows[i].student_id,
								month,
							];

							await client.query(query, params);
						}
					}

					const updateClass1Query = `UPDATE class	SET price=$1 WHERE class_id=$2`;
					const updateClass1Params = [classInfo.price, classId];

					await client.query(updateClass1Query, updateClass1Params);
				}
			}
		}

		const updateDateQuery = `UPDATE class SET start_day = $1, end_day =$2 WHERE class_id = $3`;
		const updateDateParams = [
			new Date(classInfo.startdate),
			new Date(classInfo.enddate),
			classId,
		];

		await client.query(updateDateQuery, updateDateParams);

		if (oldClassInfo.rows[0].teacher_id !== classInfo.teacher) {
			const oldTeacherScheduleQuery = `SELECT schedule_id FROM schedule WHERE teacher_id = $1 AND class_id = $2 AND schedule.date >= $3`;
			const oldTeacherScheduleParams = [
				oldClassInfo.rows[0].teacher_id,
				classId,
				new Date(),
			];
			const schedule = await client.query(
				oldTeacherScheduleQuery,
				oldTeacherScheduleParams
			);

			for (let i = 0; i < schedule.rowCount; i++) {
				const deleteOldTeacherScheduleQuery = `DELETE FROM attendance WHERE schedule_id = $1`;
				const deleteOldTeacherScheduleParams = [schedule.rows[i].schedule_id];
				await client.query(
					deleteOldTeacherScheduleQuery,
					deleteOldTeacherScheduleParams
				);
			}
		}

		if (
			oldClassInfo.rows[0].tutor_id !== null &&
			oldClassInfo.rows[0].tutor_id !== classInfo.tutor
		) {
			const oldTutorScheduleQuery = `SELECT schedule_id FROM schedule WHERE tutor_id = $1 AND class_id = $2 AND schedule.date >= $3`;
			const oldTutorScheduleParams = [
				oldClassInfo.rows[0].tutor_id,
				classId,
				new Date(),
			];
			const schedule = await client.query(
				oldTutorScheduleQuery,
				oldTutorScheduleParams
			);

			for (let i = 0; i < schedule.rowCount; i++) {
				const deleteOldTutorScheduleQuery = `DELETE FROM attendance WHERE schedule_id = $1`;
				const deleteOldTutorScheduleParams = [schedule.rows[i].schedule_id];
				await client.query(
					deleteOldTutorScheduleQuery,
					deleteOldTutorScheduleParams
				);
			}
		}

		for (let i = 0; i < oldDetailSchedule.rowCount; i++) {
			const schedule_id = oldDetailSchedule.rows[i].schedule_id;
			if (
				detailSchedules.findIndex((dtc) => dtc.schedule_id === schedule_id) ===
				-1
			) {
				const deleteAttendanceQuery = `DELETE FROM attendance WHERE schedule_id = $1`;
				const deleteAttendanceParams = [schedule_id];
				await client.query(deleteAttendanceQuery, deleteAttendanceParams);

				const deleteScheduleQuery = `DELETE FROM schedule WHERE schedule_id = $1`;
				const deleteScheduleParams = [schedule_id];
				await client.query(deleteScheduleQuery, deleteScheduleParams);
			}
		}

		if (
			JSON.stringify(oldDetailSchedule.rows) !== JSON.stringify(detailSchedules)
		) {
			let students;
			const getStudentQuery = `SELECT student_id FROM class_student INNER JOIN users ON class_student.student_id = users.user_id WHERE class_id = $1 AND users.status = '1'`;
			const getStudentParams = [classId];

			students = await client.query(getStudentQuery, getStudentParams);

			for (let i = 0; i < detailSchedules.length; i++) {
				if (detailSchedules[i].schedule_id !== '-1') {
					if (detailSchedules[i].tutor_id) {
						const query = `UPDATE schedule
							SET teacher_id= $1, date= $2, status= $3, tutor_id=$4, slot_id=$5, room_id=$6, day_of_week=$7, week_of_year=$8, type= $9
							WHERE schedule_id = $10`;

						const params = [
							detailSchedules[i].teacher_id,
							new Date(detailSchedules[i].date),
							detailSchedules[i].status,
							detailSchedules[i].tutor_id,
							detailSchedules[i].slot_id,
							detailSchedules[i].room_id,
							detailSchedules[i].day_of_week,
							detailSchedules[i].week_of_year,
							detailSchedules[i].type,
							detailSchedules[i].schedule_id,
						];

						await client.query(query, params);
					} else {
						const query = `UPDATE schedule
							SET teacher_id= $1, date= $2, status= $3, slot_id=$4, room_id=$5, day_of_week=$6, week_of_year=$7, type=$8
							WHERE schedule_id = $9`;

						const params = [
							detailSchedules[i].teacher_id,
							new Date(detailSchedules[i].date),
							detailSchedules[i].status,
							detailSchedules[i].slot_id,
							detailSchedules[i].room_id,
							detailSchedules[i].day_of_week,
							detailSchedules[i].week_of_year,
							detailSchedules[i].type,
							detailSchedules[i].schedule_id,
						];

						await client.query(query, params);
					}
				} else {
					let newSchedule;
					if (detailSchedules[i].tutor_id) {
						const query = `INSERT INTO schedule(
								schedule_id, class_id, teacher_id, date, status, tutor_id, created_by,modified_by, slot_id, room_id,day_of_week, week_of_year, type)
								VALUES (nextval('schedule_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING schedule_id`;

						const params = [
							classId,
							classInfo.teacher,
							new Date(detailSchedules[i].date),
							detailSchedules[i].status,
							classInfo.tutor,
							userId,
							userId,
							detailSchedules[i].slot_id,
							detailSchedules[i].room_id,
							detailSchedules[i].day_of_week,
							detailSchedules[i].week_of_year,
							detailSchedules[i].type,
						];

						newSchedule = await client.query(query, params);
					} else {
						const query = `INSERT INTO schedule(
								schedule_id, class_id, teacher_id, date, status, created_by,modified_by, slot_id, room_id,day_of_week, week_of_year, type)
								VALUES (nextval('schedule_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING schedule_id`;

						const params = [
							classId,
							classInfo.teacher,
							new Date(detailSchedules[i].date),
							detailSchedules[i].status,
							userId,
							userId,
							detailSchedules[i].slot_id,
							detailSchedules[i].room_id,
							detailSchedules[i].day_of_week,
							detailSchedules[i].week_of_year,
							detailSchedules[i].type,
						];

						newSchedule = await client.query(query, params);
					}

					const teacherQuery = `INSERT INTO attendance(
							attendance_id, schedule_id, user_id, created_by,modified_by)
							VALUES (nextval('attendance_id'), $1, $2, $3, $4)`;
					const teacherParams = [
						newSchedule.rows[0].schedule_id,
						detailSchedules[i].teacher_id,
						userId,
						userId,
					];
					await client.query(teacherQuery, teacherParams);

					if (detailSchedules[i].tutor_id) {
						const tutorQuery = `INSERT INTO attendance(
								attendance_id, schedule_id, user_id, created_by,modified_by)
								VALUES (nextval('attendance_id'), $1, $2, $3, $4)`;
						const tutorParams = [
							newSchedule.rows[0].schedule_id,
							detailSchedules[i].tutor_id,
							userId,
							userId,
						];
						await client.query(tutorQuery, tutorParams);
					}

					if (students.rowCount > 0) {
						for (let k = 0; k < students.rowCount; k++) {
							const studentQuery = `INSERT INTO attendance(
									attendance_id, schedule_id, user_id, created_by,modified_by)
									VALUES (nextval('attendance_id'), $1, $2, $3, $4)`;
							const studentParams = [
								newSchedule.rows[0].schedule_id,
								students.rows[k].student_id,
								userId,
								userId,
							];
							await client.query(studentQuery, studentParams);
						}
					}
				}
			}
		}

		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'updateClass'
		);
		return next(error);
	} finally {
		client.release();
	}

	return res.status(200).json({ message: 'Cập nhập lớp học thành công' });
};

const getListClassByStudentId = async (req, res, next) => {
	const userId = req.userData.userId;
	const check = await checkRole(req.userData.role, 'function_myclass');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	let classes;
	try {
		const query = `Select a.class_id,b.class_name,b.subject_name,b.teacher_name, b.price,			
		string_agg(b.room_name , ',') as room_name ,b.class_status								
				from (										
					SELECT class.class_id										
					FROM class										
					LEFT JOIN class_student										
					ON class.class_id = class_student.class_id AND class_student.flag = false
					LEFT JOIN users ON users.user_id = class_student.student_id AND users.status = '1'	
					WHERE class_student.student_id = $1
					group by class.class_id			
				) a INNER JOIN (										
				SELECT  distinct class.class_id, class.class_name, subject.subject_name,										
				users.full_name as teacher_name , class.price, room.room_name , class.class_status										
				FROM class INNER JOIN subject ON class.subject_id = subject.subject_id										
				INNER JOIN users   ON class.teacher_id = users.user_id										
				INNER JOIN schedule  ON class.class_id  = schedule.class_id										
				INNER JOIN room on schedule.room_id = room.room_id										
				) b On a.class_id = b.class_id
				
				group by a.class_id,b.class_name, b.subject_name,b.teacher_name, b.price,										
				b.class_status	`;
		const params = [userId];

		classes = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getListClassByStudentId'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

const getListClassByStudentIdManagerScreen = async (req, res, next) => {
	const studentId = req.params.studentId;
	const { month, year } = req.query;

	let classes;
	try {
		const query = `select a.class_id,  
		a.payment_id,a.status, a.class_name,a.total_lesson_in_month,a.amount-coalesce(b.additional_charges, 0)+coalesce(b.residual_fee, 0) as total_money,
		coalesce(b.additional_charges, 0) as additional_charges,coalesce(b.residual_fee, 0)as residual_fee,a.amount		
		from (									
			Select class.class_name,payment.class_id,payment.payment_id,payment.status, payment.student_id,payment.total_lesson_in_month,payment.amount
			from payment
			inner join class on class.class_id = payment.class_id
			where month= $1 and year = $2  AND payment.flag = false							
											
		) a left join (									
			Select payment.residual_fee,payment.additional_charges,payment.student_id,payment.class_id from payment where month= $3 and year = $4 AND payment.flag = false						
		) b on a.student_id =b.student_id and a.class_id=b.class_id
		WHERE a.student_id = $5`;
		const params = [month, year, parseInt(month) - 1, year, studentId];

		classes = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getListClassByStudentIdManagerScreen'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

// lay class chi tiet cua man hoc sinh
const getClassByStudentId = async (req, res, next) => {
	const userId = req.userData.userId;
	const classId = req.params.classId;

	const check = await checkRole(req.userData.role, 'function_myclass');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	let checkPermiss;
	try {
		const query = `SELECT class_id FROM class_student WHERE class_id = $1 AND student_id = $2 and flag=false`;
		const params = [classId, userId];

		checkPermiss = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	if (checkPermiss.rowCount < 1) {
		const error = new HttpError('Bạn không có quyền truy cập trang này', 403);
		return next(error);
	}

	let countStudent;
	try {
		const query = `Select count(student_id) from class_student where class_id=$1 and flag=false`;
		const params = [classId];
		countStudent = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	let classinfo;
	try {
		const query = `SELECT class.class_id, class.max_student_in_class, class.class_name, subject.subject_name,
		class.grade_level, to_char(class.start_day, 'YYYY-MM-DD') as start_day,
		to_char(class.end_day, 'YYYY-MM-DD') as end_day, class.class_status, class.price, class.flag			
		FROM class INNER JOIN subject ON class.subject_id = subject.subject_id and subject.flag=false						
		where class.class_id= $1 and class.flag=false`;
		const params = [classId];
		classinfo = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	if (classinfo.rowCount < 1 || classinfo.rows[0].class_status === '3') {
		const error = new HttpError('Không tìm thấy lớp học', 404);
		return next(error);
	}

	let teacher;
	try {
		const query = `SELECT users.full_name as teacher_name FROM users INNER JOIN class ON
		class.teacher_id = users.user_id
		WHERE class_id = $1`;
		const params = [classId];

		teacher = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	let tutor;
	try {
		const query = `SELECT users.full_name as tutor_name FROM users INNER JOIN class ON
		class.tutor_id = users.user_id
		WHERE class_id = $1`;
		const params = [classId];

		tutor = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByClassId'
		);
		return next(error);
	}

	return res.status(200).json({
		classInfo: classinfo.rows[0],
		numberStudent: countStudent.rows[0].count,
		teacher: teacher.rows[0].teacher_name,
		tutor: tutor.rowCount > 0 ? tutor.rows[0].tutor_name : '',
	});
};

// combo box
const getClassByTeacherId = async (req, res, next) => {
	const teacherId = req.params.teacherId;

	let classes;
	try {
		const query = `SELECT class_id, class_name FROM class Where (teacher_id = $1 OR tutor_id = $2) AND class_status = '1'`;
		const params = [teacherId, teacherId];

		classes = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassByTeacherId'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

// combo box
const getClassesByManagerShift = async (req, res, next) => {
	const managerId = req.params.managerId;

	let shifts;
	try {
		const query = `Select slot_id,slot_name,start_time,end_time from slot where slot_id in (					
			select slot_id from manager_shift where manager_id =$1 and type='1'				
		)`;
		const params = [managerId];
		shifts = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getClassesByManagerShift'
		);
		return next(error);
	}

	let classes = [];
	for (let i = 0; i < shifts.rowCount; i++) {
		let list;
		const query = `select distinct schedule.class_id, class_name from schedule INNER JOIN class ON class.class_id = schedule.class_id where class.class_status = '1' AND slot_id in (				
		Select slot_id from slot where start_time >= $1 and (end_time <=$2 or start_time <=$3) and type='0'		
		) and schedule.flag=false`;

		const params = [
			shifts.rows[i].start_time,
			shifts.rows[i].end_time,
			shifts.rows[i].end_time,
		];
		list = await pool.query(query, params);
		if (list.rowCount > 0) {
			for (let j = 0; j < list.rowCount; j++) {
				classes.push(list.rows[j]);
			}
		}
	}

	return res.status(200).json(classes);
};

const deleteClass = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const classId = req.params.classId;

	try {
		const query = `UPDATE class
		SET modified_by=$1, modified_at=$2, class_status=$3
		WHERE class_id = $4`;
		const params = [userId, new Date(), '3', classId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'deleteClass'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Xóa thành công' });
};

const restoreClass = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_delete_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const classId = req.params.classId;

	let classroom;
	try {
		const query = 'SELECT start_day, end_day FROM class WHERE class_id = $1';
		const params = [classId];

		classroom = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'restoreClass'
		);
		return next(error);
	}

	let status;
	if (
		new Date(classroom.rows[0].start_day).getTime() <= new Date().getTime() &&
		new Date().getTime() <= new Date(classroom.rows[0].end_day).getTime()
	) {
		status = '1';
	} else if (
		new Date(classroom.rows[0].start_day).getTime() > new Date().getTime()
	) {
		status = '0';
	} else {
		status = '2';
	}

	try {
		const query = `UPDATE class
		SET modified_by=$1, modified_at=$2, class_status=$3
		WHERE class_id = $4`;
		const params = [userId, new Date(), status, classId];

		await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'manager.controller.js',
			'deleteClass'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Khôi phục thành công' });
};

const addStudentToClass = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const userId = req.userData.userId;
	const classId = req.params.classId;
	const studentId = req.params.studentId;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const classroomQuery = `SELECT class_id, to_char(start_day, 'MM') as month, to_char(start_day, 'YYYY') as year FROM class WHERE class_id = $1 AND class_status != '2'`;
		const classroomParams = [classId];
		const classroom = await client.query(classroomQuery, classroomParams);

		if (classroom.rowCount < 1) {
			const error = new HttpError('Không tìm thấy lớp học', 404);
			return next(error);
		}

		const studentQuery = `SELECT user_id FROM users WHERE user_id = $1 AND role_id = '5' AND status = '1'`;
		const studentParams = [studentId];
		const student = await client.query(studentQuery, studentParams);

		if (student.rowCount < 1) {
			const error = new HttpError('Không tìm thấy học sinh', 404);
			return next(error);
		}

		const checkDuplicateStudentQuery =
			'SELECT student_id FROM class_student WHERE class_id = $1 AND student_id = $2 LIMIT 1';
		const checkDuplicateStudentParams = [classId, studentId];
		const checkDuplicateStudent = await client.query(
			checkDuplicateStudentQuery,
			checkDuplicateStudentParams
		);

		if (checkDuplicateStudent.rowCount > 0) {
			const error = new HttpError('Học sinh này đã là học sinh của lớp', 404);
			return next(error);
		}

		const parseDate =
			new Date().getFullYear() +
			'-' +
			('0' + (new Date().getMonth() + 1)).slice(-2) +
			'-' +
			('0' + new Date().getDate()).slice(-2);

		const month = ('0' + (new Date().getMonth() + 1)).slice(-2);

		const scheduleClassQuery = `SELECT date, slot_id FROM schedule WHERE class_id = $1 AND date >= $2 ORDER BY date`;
		const scheduleClassParams = [classId, parseDate];

		const scheduleClass = await client.query(
			scheduleClassQuery,
			scheduleClassParams
		);

		const enddateClassQuery = `SELECT end_day FROM class WHERE class_id = $1`;
		const enddateClassParams = [classId];

		const enddateClass = await client.query(
			enddateClassQuery,
			enddateClassParams
		);

		const parseEnddate =
			new Date(enddateClass.rows[0].end_day).getFullYear() +
			'-' +
			('0' + (new Date(enddateClass.rows[0].end_day).getMonth() + 1)).slice(
				-2
			) +
			'-' +
			('0' + new Date(enddateClass.rows[0].end_day).getDate()).slice(-2);

		const scheduleStudentQuery = `SELECT date, slot_id FROM attendance INNER JOIN schedule ON attendance.schedule_id = schedule.schedule_id
		WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date`;
		const scheduleStudentParams = [studentId, parseDate, parseEnddate];

		const scheduleStudent = await client.query(
			scheduleStudentQuery,
			scheduleStudentParams
		);

		if (scheduleClass.rowCount > 0 && scheduleStudent.rowCount > 0) {
			for (let i = 0; i < scheduleClass.rowCount; i++) {
				for (let j = 0; j < scheduleStudent.rowCount; j++) {
					if (
						new Date(scheduleClass.rows[i].date).getTime() ===
							new Date(scheduleStudent.rows[j].date).getTime() &&
						scheduleClass.rows[i].slot_id === scheduleStudent.rows[j].slot_id
					) {
						const error = new HttpError(
							'Lịch của học sinh bị trùng, vui lòng kiểm tra lại.',
							404
						);
						return next(error);
					}
				}
			}
		}

		const insertClassStudentquery = `INSERT INTO class_student(
				class_id, student_id, created_by, modified_by)
				VALUES ($1, $2, $3, $4)`;
		const insertClassStudentParams = [classId, studentId, userId, userId];

		await client.query(insertClassStudentquery, insertClassStudentParams);

		const schedulesQuery = `select schedule_id from schedule where class_id = $1 and date >= $2`;
		const schedulesParams = [classId, parseDate];

		const schedules = await client.query(schedulesQuery, schedulesParams);

		if (schedules.rowCount > 0) {
			let totalLessonInMonth;
			const totalLessonInMonthQuery = `select schedule_id from schedule where class_id =$1 and date >= $2 and to_char(schedule.date,'MM') =$3`;
			const totalLessonInMonthParams = [classId, parseDate, month];

			totalLessonInMonth = await client.query(
				totalLessonInMonthQuery,
				totalLessonInMonthParams
			);

			for (let i = 0; i < schedules.rowCount; i++) {
				const query = `INSERT INTO attendance(
						attendance_id, schedule_id, user_id, is_active, created_by, modified_by)
						VALUES (nextval('attendance_id'), $1, $2, $3, $4, $5)`;
				const params = [
					schedules.rows[i].schedule_id,
					studentId,
					'0',
					userId,
					userId,
				];

				await client.query(query, params);
			}

			if (
				parseInt(classroom.rows[0].month) === new Date().getMonth() + 1 &&
				parseInt(classroom.rows[0].year) === new Date().getFullYear()
			) {
				const priceQuery = `select price from class where class_id =$1`;
				const priceParams = [classId];

				const price = await client.query(priceQuery, priceParams);

				const amount = parseFloat(
					price.rows[0].price * totalLessonInMonth.rowCount
				);

				const paymentQuery = `INSERT INTO payment(
					payment_id, class_id, student_id, status, amount, created_by, modified_by, month, year, class_price, total_lesson_in_month, additional_charges, residual_fee)
					VALUES (nextval('payment_id'), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
				const paymentParams = [
					classId,
					studentId,
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
				await client.query(paymentQuery, paymentParams);
			}
		}

		await client.query('COMMIT');

		return res
			.status(200)
			.json({ message: 'Thêm học sinh vào lớp học thành công' });
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'addStudentToClass'
		);
		return next(error);
	} finally {
		client.release();
	}
};

const deleteStudentInClass = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const classId = req.params.classId;
	const studentId = req.params.studentId;
	const userId = req.userData.userId;

	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		let classroom;
		const classQuery = `SELECT class_id FROM class WHERE class_id = $1 AND class_status != '2'`;
		const classParams = [classId];

		classroom = await client.query(classQuery, classParams);

		if (classroom.rowCount < 1) {
			const error = new HttpError('Không tìm thấy lớp học', 404);
			return next(error);
		}

		let student;

		const studentQuery = `SELECT user_id FROM users WHERE user_id = $1 AND role_id = '5' AND status = '1'`;
		const studentParams = [studentId];

		student = await client.query(studentQuery, studentParams);

		if (student.rowCount < 1) {
			const error = new HttpError('Không tìm thấy học sinh', 404);
			return next(error);
		}

		let schedules;
		const attendancesQuery = `SELECT schedule.schedule_id FROM schedule INNER JOIN attendance ON schedule.schedule_id = attendance.schedule_id
	WHERE class_id = $1 AND attendance.user_id = $2`;
		const attendancesParams = [classId, studentId];
		schedules = await client.query(attendancesQuery, attendancesParams);

		for (let i = 0; i < schedules.rowCount; i++) {
			const query = `DELETE FROM attendance WHERE schedule_id = $1 AND user_id = $2`;
			const params = [schedules.rows[i].schedule_id, studentId];

			await client.query(query, params);
		}

		const deleteClassStudentQuery = `DELETE FROM class_student WHERE class_id = $1 AND student_id = $2`;
		const deleteClassStudentParams = [classId, studentId];

		await client.query(deleteClassStudentQuery, deleteClassStudentParams);

		const month = ('0' + (new Date().getMonth() + 1)).slice(-2);
		const paymentQuery = `UPDATE payment
		SET flag=$1, modified_by=$2, modified_at=$3
		WHERE class_id = $4 AND student_id = $5 AND month = $6 AND flag = false`;

		const paymentParams = [true, userId, new Date(), classId, studentId, month];

		await client.query(paymentQuery, paymentParams);

		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'deleteStudentInClass'
		);
		return next(error);
	} finally {
		client.release();
	}

	return res.status(200).json({ message: 'Xóa học sinh khỏi lớp thành công' });
};

// combo box
const getClassesSelect = async (req, res, next) => {
	let classes;
	try {
		const query = `SELECT class_id as value, class_name as label FROM class where class_id not in ('2','3')`;
		classes = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'class.controller.js',
			'getAllClasses'
		);
		return next(error);
	}

	return res.status(200).json(classes.rows);
};

module.exports = {
	getClasses,
	getClassByClassId,
	createClass,
	getAllClasses,
	getListClassByStudentId,
	getClassByTeacherId,
	getClassesByManagerShift,
	updateClass,
	restoreClass,
	deleteClass,
	addStudentToClass,
	deleteStudentInClass,
	getClassesSelect,
	getClassByStudentId,
	getListClassByStudentIdManagerScreen,
};
