const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const { checkRole } = require('../common/function');
const { validateMaxLength } = require('../common/validate');
const validator = require('validator').default;

const getCountAttendance = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_attendance');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role == 3) {
		user_id = userId;
	}
	const { q, date, filter1 } = req.query;
	try {
		const query = `
            select count(schedule.schedule_id)
            from schedule 
            left join class 
                            on class.class_id = schedule.class_id 
            left join users as a  
                            on a.user_id = schedule.teacher_id 
			inner join 
                (Select count(attendance.user_id) as total_student,schedule.schedule_id 
                    from 
                        attendance 
                    left join users					
                        on users.user_id = attendance.user_id 
                    left join  schedule					
                        on schedule.schedule_id= attendance.schedule_id			
                    where 
                        schedule.date = $6 and
                        users.role_id = '5' and
                        attendance.flag=false
                    Group by schedule.schedule_id) total 
                on total.schedule_id = schedule.schedule_id
            where 
                schedule.date =$1  
                and class.teacher_id ${role === '3' ? '' : '!'}= $5
                and schedule.status ${filter1 === '' ? '!' : ''}= $4
                and class.class_status in ('1','0')
                and ( LOWER( class.class_name) like LOWER($2) or  LOWER(a.full_name) like LOWER($3))
            `;
		const params = [date, '%' + q + '%', '%' + q + '%', filter1, user_id, date];
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
			'attendance.controller.js',
			'getAttendanceDaily'
		);
		return next(error);
	}
};

const getAttendanceDaily = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_attendance');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const { page, limit, q, date, filter1 } = req.query;
	if (new Date(date).getTime() > new Date().getTime()) {
		const error = new HttpError('Chưa đến thời gian điểm danh', 422);
		return next(error);
	}
	const offset = (page - 1) * limit;
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role == 3) {
		user_id = userId;
	}
	try {
		const query = `
            select  CONCAT (count(a1.user_id) ,'/', total.total_student) as total,
                    CONCAT (to_char(slot.start_time, 'HH24:MI') ,' - ', to_char(slot.end_time, 'HH24:MI')) as time,
                    class.class_id, class.class_name,
                    room.room_name,subject.subject_name,
                    a.full_name as teacher_name ,
                    b.full_name  as tutor_name,
					a.user_id as teacher_id,
					b.user_id as tutor_id,
                    schedule.status,schedule.schedule_id,
					to_char(schedule.date,'YYYY-MM-DD') as date
            from 
                schedule
            left join users as a  
                on a.user_id = schedule.teacher_id 
            left join users as b  
                on b.user_id = schedule.tutor_id 
            left join class 
                on class.class_id = schedule.class_id 
                and class.class_status in ('0','1')
            left join room 
                on room.room_id = schedule.room_id
            left join slot 
                on slot.slot_id = schedule.slot_id
            left join subject 
                on subject.subject_id = class.subject_id
            inner join 
                (Select count(attendance.user_id) as total_student,schedule.schedule_id 
                    from 
                        attendance 
                    left join users					
                        on users.user_id = attendance.user_id 
                    left join  schedule					
                        on schedule.schedule_id= attendance.schedule_id			
                    where 
                        schedule.date = $1 and
                        users.role_id = '5' and
                        attendance.flag=false
                    Group by schedule.schedule_id) total 
                on total.schedule_id = schedule.schedule_id
				left join 
				(
						Select users.user_id,attendance.schedule_id from attendance 
							left join users
							on users.user_id = attendance.user_id and users.role_id = '5' and attendance.is_active='1' and attendance.flag=false 
					
				)
				a1 
					on schedule.schedule_id = a1.schedule_id 
            where 
                schedule.date =$2  
                and schedule.status ${filter1 === '' ? '!' : ''}= $7
                and class.teacher_id ${role === '3' ? '' : '!'}= $8
                and ( LOWER( class.class_name) like LOWER($3) or  LOWER(a.full_name) like LOWER($4))
            Group by a.user_id,b.user_id, class.class_id,room.room_name,subject.subject_name,a.full_name,b.full_name,slot.start_time,slot.end_time,schedule.status,schedule.schedule_id,total_student
            ORDER BY slot.start_time ASC ,date DESC LIMIT $5 OFFSET $6`;
		const params = [
			date,
			date,
			'%' + q + '%',
			'%' + q + '%',
			limit,
			offset,
			filter1,
			user_id,
		];
		const data = await pool.query(query, params);
		const result = {
			data: data.rows,
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
			'attendance.controller.js',
			'getAttendanceDaily'
		);
		return next(error);
	}
};

const getStudentsAttendanceDaily = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_attendance');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const { scheduleId, classId } = req.query;
	let students;
	try {
		const role = req.userData.role;
		const userId = req.userData.userId;
		if (role == 3) {
			const query_check = `select teacher_id from class where class_id =$1`;
			const params_check = [classId];
			const response = await pool.query(query_check, params_check);
			const teacher = response.rows[0].teacher_id;
			if (userId != teacher) {
				const error = new HttpError(
					'bạn không có quyền điểm danh lớp này',
					666
				);
				sendLog(
					err.stack,
					error.code,
					error.message,
					'attendance.controller.js',
					'getStudentsAttendanceDaily'
				);
				return next(error);
			}
		}
		// check xem giaos vien co lop day hay khong
		const query = `Select users.role_id, schedule.class_id, schedule.schedule_id,attendance.attendance_id,users.user_id,users.full_name,users.phone,attendance.is_active,users.avt_link from attendance 
		inner join users								
        	on users.user_id = attendance.user_id 
		inner join  schedule								
        	on schedule.schedule_id= attendance.schedule_id and schedule.flag=false	

        where schedule.schedule_id=$1 and users.role_id in ('5','4')	and attendance.flag=false						
        order by role_id DESC`;
		const params = [scheduleId];
		students = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'attendance.controller.js',
			'getStudentsAttendanceDaily'
		);
		return next(error);
	}

	return res.status(200).json(students.rows);
};

const updateAttendanceDaily = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_edit_attendance');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
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

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;

	const { attendance, schedule_id, class_id } = req.body;

	const keyNames = Object.keys(attendance);
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const check_date = await client.query(
			`
			Select date, to_char(date,'MM') as month , to_char(date,'YYYY') as year from schedule where schedule_id = $1
	`,
			[schedule_id]
		);

		if (check_date.rows.length > 0) {
			if (new Date(check_date.rows[0].date).getTime() > new Date().getTime()) {
				const error = new HttpError('Chưa đến thời gian điểm danh', 422);
				return next(error);
			}
		}

		for (let i = 0; i < keyNames.length; i++) {
			if (!validator.matches(attendance[keyNames[i]], /^(0|1|2)$/)) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			const get_student_id = await client.query(
				`
				Select user_id from attendance where attendance_id = $1
		`,
				[keyNames[i]]
			);

			const student_id = get_student_id.rows[0].user_id;

			const get_last_charge_fee = await client.query(
				`
                Select payment_id,additional_charges,residual_fee from payment where class_id =$1 and student_id=$2 and month=$3 and year=$4
        `,
				[
					class_id,
					student_id,
					check_date.rows[0].month,
					check_date.rows[0].year,
				]
			);
			// nếu là học sinh
			if (get_last_charge_fee.rows.length > 0) {
				const get_class_info = await client.query(
					`
					Select price,class_status as status from class where class_id =$1 
			`,
					[class_id]
				);

				const get_schedule_info = await client.query(
					`
					Select  status from schedule where schedule_id =$1
			`,
					[schedule_id]
				);

				const get_current_attendance = await client.query(
					`
					Select is_active from attendance where  
					attendance_id=$1
			`,
					[keyNames[i]]
				);

				if (
					attendance[keyNames[i]] == false &&
					get_schedule_info.rows[0].status == '0'
				) {
					await client.query(
						`
							UPDATE public.payment
							SET   residual_fee=$1
							WHERE payment_id=$2;
					`,
						[
							get_last_charge_fee.rows[0].residual_fee +
								get_class_info.rows[0].price,
							get_last_charge_fee.rows[0].payment_id,
						]
					);
				} else if (
					attendance[keyNames[i]] == false &&
					get_schedule_info.rows[0].status == '1' &&
					get_current_attendance.rows[0].is_active == true
				) {
					await client.query(
						`
							UPDATE public.payment
							SET   residual_fee=$1
							WHERE payment_id=$2;
					`,
						[
							get_last_charge_fee.rows[0].residual_fee +
								get_class_info.rows[0].price,
							get_last_charge_fee.rows[0].payment_id,
						]
					);
				} else if (
					attendance[keyNames[i]] == true &&
					get_schedule_info.rows[0].status == '1' &&
					get_current_attendance.rows[0].is_active == false
				) {
					await client.query(
						`
							UPDATE public.payment
							SET   residual_fee=$1
							WHERE payment_id=$2;
					`,
						[
							get_last_charge_fee.rows[0].residual_fee -
								get_class_info.rows[0].price,
							get_last_charge_fee.rows[0].payment_id,
						]
					);
				}
			}

			await client.query(
				`
                UPDATE public.attendance
                SET  
                    is_active=$1,
                    modified_by=$2, 
                    modified_at=$3
                WHERE 
                    attendance_id=$4
        `,
				[attendance[keyNames[i]], userId, datetime, keyNames[i]]
			);
		}

		// update schedule
		await client.query(
			`
            UPDATE public.schedule
            SET     status='1',
                    modified_by=$1, 
                    modified_at=$2
            WHERE schedule_id=$3
    `,
			[userId, datetime, schedule_id]
		);
		// update class status
		await client.query(
			`
            UPDATE public.class
	        SET   
                modified_by=$1, 
                modified_at=$2, 
                class_status='1'
	        WHERE class_id=$3
    `,
			[userId, datetime, class_id]
		);
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'updatePost'
		);
		return next(error);
	} finally {
		client.release();
	}
	// update attendance
	return res.status(200).json({ message: 'Điểm danh thành công' });
};

const getDetailAttendanceHistory = async (req, res, next) => {
	const check = await checkRole(
		req.userData.role,
		'function_attendance_history_all'
	);
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const classId = req.params.classId;
	const { month, year } = req.query;

	const parseMonth = `0${month}`.slice('-2');

	let attendances;
	try {
		const query = `select schedule.status, schedule.date,a.is_active, users.full_name, users.user_id, schedule.slot_id, slot.slot_name from schedule inner join									
        (									
            select * from attendance where attendance.schedule_id in (								
            select schedule.schedule_id from schedule where class_id = $1							
        )									
        ) a on schedule.schedule_id = a.schedule_id									
        inner join users on users.user_id=a.user_id		
		inner join slot ON schedule.slot_id = slot.slot_id
        and schedule.class_id = $2 and users.role_id ='5' and to_char(schedule.date, 'MM') = $3 and to_char(schedule.date, 'YYYY') = $4						
        order by schedule.date`;
		const params = [classId, classId, parseMonth, year];

		attendances = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getDetailAttendanceHistory'
		);
		return next(error);
	}

	let students;
	try {
		const query = `select DISTINCT users.full_name, users.user_id from schedule INNER JOIN attendance ON schedule.schedule_id = attendance.schedule_id
        INNER JOIN users ON attendance.user_id = users.user_id WHERE users.role_id = '5' AND     							
        class_id = $1 and to_char(date, 'MM') = $2 and to_char(date, 'YYYY') = $3`;
		const params = [classId, parseMonth, year];

		students = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getDetailAttendanceHistory'
		);
		return next(error);
	}

	let scheduleDate;
	try {
		const query = `select date, schedule.slot_id, slot_name from schedule INNER JOIN slot ON slot.slot_id = schedule.slot_id WHERE     							
        class_id = $1 and to_char(date, 'MM') = $2 and to_char(date, 'YYYY') = $3
         ORDER BY date`;
		const params = [classId, parseMonth, year];

		scheduleDate = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getDetailAttendanceHistory'
		);
		return next(error);
	}

	return res.status(200).json({
		attendances: attendances.rows,
		students: students.rows,
		scheduleDate: scheduleDate.rows,
	});
};

const getStudentAttendanceByClassId = async (req, res, next) => {
	const check = await checkRole(
		req.userData.role,
		'function_attendance_report'
	);
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const userId = req.userData.userId;
	const role = req.userData.role;
	const classId = req.params.classId;

	if (role !== '5') {
		const error = new HttpError('Bạn không có quyền truy cập trang này.', 403);
		return next(error);
	}

	let checkPermiss;
	try {
		const query = `SELECT class_id FROM class_student WHERE class_id = $1 AND student_id = $2`;
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

	let attendances;
	try {
		const query = `SELECT schedule.date, slot_name, room_name, users.full_name as teacher_name, attendance.is_active, schedule.status
		FROM attendance INNER JOIN schedule ON attendance.schedule_id = schedule.schedule_id
		INNER JOIN slot ON schedule.slot_id = slot.slot_id
		INNER JOIN room ON schedule.room_id = room.room_id
		INNER JOIN users ON schedule.teacher_id = users.user_id
		WHERE class_id = $1 AND attendance.user_id = $2 
		ORDER BY schedule.date`;
		const params = [classId, userId];

		attendances = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'attendance.controller.js',
			'getStudentAttendanceByClassId'
		);
		return next(error);
	}

	let countAbsent = 0;

	for (let i = 0; i < attendances.rowCount; i++) {
		if (
			attendances.rows[i].status === '1' &&
			(attendances.rows[i].is_active === 'false' ||
				attendances.rows[i].is_active === '0')
		) {
			countAbsent++;
		}
	}

	const absentPercent = Math.round((countAbsent / attendances.rowCount) * 100);

	return res
		.status(200)
		.json({ attendances: attendances.rows, absentPercent, countAbsent });
};

module.exports = {
	getAttendanceDaily,
	getStudentsAttendanceDaily,
	getCountAttendance,
	updateAttendanceDaily,
	getDetailAttendanceHistory,
	getStudentAttendanceByClassId,
};
