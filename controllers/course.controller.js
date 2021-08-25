const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');
const {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
} = require('../common/validate');
const { validationResult } = require('express-validator');
const validator = require('validator').default;
const mail = require('../configs/mail.config');

const getSubjectList = async (req, res, next) => {
	try {
		const query = `
		    select 
                subject_id as value,subject_name as text 
            from 
                subject
            where flag =false
		`;
		const data = await pool.query(query);
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
			'course.controller.js',
			'getSubjectList'
		);
		return next(error);
	}
};

const getTotalCourseListByFilter = async (req, res, next) => {
	const { page, limit, q, filter1, filter2 } = req.query;

	if (!validator.isNumeric(page) || !validator.isNumeric(limit)) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const offset = (page - 1) * limit;
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role == 3 || role == 4) {
		user_id = userId;
	}
	try {
		const query = `
		Select  	count( distinct a.course_id)						
                from(								
                    select 
                        count(student_id) as number_student, course.course_id								
                    from 
                        course								
                    left join 
                        course_student on course.course_id = course_student.course_id								
                    group by 
                        course.course_id								
                )a INNER JOIN(								
                    select 
                        course.course_id,course.title,subject.subject_name as subject_name, course.cost ,							
                        course.percent, users.full_name as teacher_name, course.status , course.brief_info, 
                        course.flag, subject.subject_id, course.created_at				
                    from 
                        course 
					INNER JOIN subject ON course.subject_id = subject.subject_id	
					INNER JOIN users on users.user_id = course.created_by
					where course.created_by ${user_id !== '' ? '' : '!'}= $5
					
                ) b on a.course_id = b.course_id									
               where    b.flag=false and 
                        (LOWER(b.teacher_name) like LOWER($1) or LOWER(b.title) like LOWER($2)  ) 
                        and b.status  ${filter2 === '' ? '!' : ''}= $3
                        and b.subject_id  ${filter1 === '' ? '!' : ''}= $4								
                    								
		`;
		const param = ['%' + q + '%', '%' + q + '%', filter2, filter1, user_id];
		const results = await pool.query(query, param);
		return res.status(200).json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'getTotalCourseListByFilter'
		);
		return next(error);
	}
};

const getCourseList = async (req, res, next) => {
	const { page, limit, q, filter1, filter2 } = req.query;
	if (!validator.isNumeric(page) || !validator.isNumeric(limit)) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role != '1') {
		user_id = userId;
	}

	const offset = (page - 1) * limit;

	try {
		const query = `
		Select  distinct a.course_id as id,b.title,b.subject_name, b.cost as course_cost,								
                b.percent, b.teacher_name,number_student, b.status as course_status, b.brief_info,b.created_at,b.subject_id,
				coalesce(c.number_lesson,0)	as number_lesson,b.modified_at			
                from(								
                    select 
                        count(student_id) as number_student, course.course_id								
                    from 
                        course								
                    left join 
                        course_student on course.course_id = course_student.course_id								
                    group by 
                        course.course_id								
                )a INNER JOIN(								
                    select 
                        course.course_id,course.title,subject.subject_name as subject_name, course.cost ,							
                        course.percent, users.full_name as teacher_name, course.status , course.brief_info, 
                        course.flag, subject.subject_id, course.created_at,course.created_by,course.modified_at		
                    from 
                        course 
					INNER JOIN subject ON course.subject_id = subject.subject_id	
					INNER JOIN users on users.user_id = course.created_by
					where course.created_by ${user_id == '' ? '!' : ''}= $7
					
                ) b on a.course_id = b.course_id	
					left join (
					select count(lesson.lesson_id) as number_lesson,course_id from lesson inner join lesson_source on lesson.lesson_id = lesson_source.lesson_id
						group by course_id
					) c on a.course_id = c.course_id
												
               where    b.flag=false and 
                        (LOWER(b.teacher_name) like LOWER($1) or LOWER(b.title) like LOWER($2)  ) 
                        and b.status  ${filter2 === '' ? '!' : ''}= $3
                        and b.subject_id  ${filter1 === '' ? '!' : ''}= $4								
                        group by a.course_id,b.title,b.subject_id, b.cost ,	b.modified_at,							
                        b.percent, b.teacher_name,a.number_student, b.status,b.brief_info,b.subject_id, b.created_at,b.subject_name,c.number_lesson						
                        order by  b.status ASC, b.modified_at DESC,b.created_at DESC LIMIT $5 OFFSET $6	
		`;
		const param = [
			'%' + q + '%',
			'%' + q + '%',
			filter2,
			filter1,
			limit,
			offset,
			user_id,
		];
		const data = await pool.query(query, param);
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
			'course.controller.js',
			'getCourseList'
		);
		return next(error);
	}
};

const getTeacherList = async (req, res, next) => {
	try {
		const query = `
		    select 
                user_id as value, full_name as text
            from 
                users
			where users.role_id = '3' and flag=false
		`;
		const data = await pool.query(query);
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
			'course.controller.js',
			'getTeacherList'
		);
		return next(error);
	}
};

const getListCourseByStudentId = async (req, res, next) => {
	const studentId = req.params.studentId;

	let courses;
	try {
		const query = `select course_student.course_id, course_student.student_id,course.title, course_student.price, course_student.note, join_date from course_student inner join course on course_student.course_id = course.course_id										
		where course_student.student_id =$1`;
		const params = [studentId];

		courses = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'getListCourseByStudentId'
		);
		return next(error);
	}

	return res.status(200).json(courses.rows);
};

const createCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_create_course');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { title, price, full_content, subject_id, isFeatured } = req.body;
	if (
		!validateIsEmpty(title) ||
		!validateIsEmpty(price) ||
		!validateIsEmpty(subject_id) ||
		!validateMaxLength(title, 255) ||
		!validateMaxLength(price, 255) ||
		!validateMaxLength(full_content, 100000)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	if (!validateIsString(title) || !validator.isNumeric(price.toString())) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const thumbnail = req.file.location;
	const results = await pool.query(`SELECT nextval('course_id')`);
	const course_id = results.rows[0].nextval;
	try {
		await pool.query(
			`
			INSERT INTO public.course(
				course_id,thumbnail,description,status,created_by,created_at,title,cost,subject_id,is_featured)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)
		`,
			[
				course_id,
				thumbnail,
				full_content,
				'0',
				userId,
				datetime,
				title,
				price,
				subject_id,
				isFeatured,
			]
		);
	} catch (err) {
		const error = new HttpError('Something went wrong, please try again', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'createCourse'
		);
		return next(error);
	}

	return res.status(200).json({ message: 'Tạo mới khóa học' });
};

const getCourseById = async (req, res, next) => {
	const course_id = req.params.course_id;
	try {
		const results = await pool.query(
			`
			select 	course.course_id,thumbnail,course.description,users.user_id,users.full_name,
					title,cost,coalesce(percent, 0) as percent,course.status,
					subject.subject_id,coalesce(discount, 0) as discount, course.is_featured from course 
			inner join users on 
				course.created_by = users.user_id
			left join subject on 
				subject.subject_id = course.subject_id and subject.flag=false
			where course_id =$1
		`,
			[course_id]
		);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'getCourseById'
		);
		return next(error);
	}
};

const reviewCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_review_course');
	if (check == false) {
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

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { price, course_id, discount, percent, status, isFeatured } = req.body;

	try {
		const result = await pool.query(
			`
			UPDATE public.course
			SET  
					status=$1, 
					modified_by=$2, 
					modified_at=$3, 
					cost=$4, 
					percent=$5, 
					discount=$6,
					is_featured=$7
			WHERE course_id=$8;
	`,
			[
				status,
				userId,
				datetime,
				price,
				percent,
				discount,
				isFeatured,
				course_id,
			]
		);

		if (result.rowCount == 1) {
			if (status == '1') {
				res.status(200).json({ message: 'Đã duyệt khóa học' });
			} else {
				res.status(200).json({ message: 'Đã từ chối khóa học' });
			}
		} else {
			const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
			return next(error);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'reviewCourse'
		);
		return next(error);
	}
};

const updateCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_edit_course');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const {
		title,
		price,
		full_content,
		subject_id,
		course_id,
		thumbnailUrl,
		isFeatured,
	} = req.body;

	if (
		!validateIsEmpty(title) ||
		!validateIsEmpty(price) ||
		!validateIsEmpty(subject_id) ||
		!validateIsEmpty(course_id) ||
		!validateIsEmpty(isFeatured) ||
		!validateMaxLength(title, 255) ||
		!validateMaxLength(price, 255)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	if (!validateIsString(title) || !validator.isNumeric(price.toString())) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	let thumbnail;
	if (thumbnailUrl) {
		thumbnail = thumbnailUrl;
	} else {
		thumbnail = req.file.location;
	}

	try {
		const checkQuery =
			'SELECT course_id FROM course WHERE created_by = $1 AND course_id = $2';
		const checkparam = [userId, course_id];

		const check = await pool.query(checkQuery, checkparam);

		if (check.rowCount < 0) {
			const error = new HttpError('Bạn không thể chỉnh sửa khóa học này', 404);
			return next(error);
		}

		await pool.query(
			`
			UPDATE public.course
			SET thumbnail=$1,
				description=$2, 
				status=$3, 
				modified_by=$4, 
				modified_at=$5, 
				title=$6, 
				cost=$7, 
				subject_id=$8,
				is_featured=$9
			WHERE course_id=$10;
	`,
			[
				thumbnail,
				full_content,
				'0',
				userId,
				datetime,
				title,
				price,
				subject_id,
				isFeatured,
				course_id,
			]
		);
		res.json({ message: 'Chỉnh sửa thành công' });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'updateCourse'
		);
		return next(error);
	}
};

const updateCourseFlag = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_delete_course');
	if (check == false) {
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

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { course_id, status } = req.body;

	try {
		const results = await pool.query(
			`
			UPDATE public.course
			SET   	modified_by=$1,
					modified_at=$2, 
					status=$4
			WHERE course.course_id=$3;
		`,
			[userId, datetime, course_id, status]
		);

		if (status == '4') {
			const courseInfoQuery = `select course_id, title from course where course_id = $1`;
			const courseInfoParams = [course_id];
			const courseInfo = await pool.query(courseInfoQuery, courseInfoParams);
			const senderQuery = `SELECT full_name, email FROM users WHERE user_id = $1 AND status = '1' AND is_confirm = true LIMIT 1`;
			const senderParams = [userId];
			const sender = await pool.query(senderQuery, senderParams);
			const managerQuery = `SELECT full_name, email FROM users WHERE role_id = '1' AND status = '1' AND is_confirm = true LIMIT 1`;
			const manager = await pool.query(managerQuery);

			if (manager.rowCount > 0 && sender.rowCount > 0) {
				const mailOptions = {
					from: `${sender.rows[0].full_name.toString()} - Xoài Academy <vietokokbusiness@gmail.com>`,
					to: manager.rows[0].email.toString(),
					subject: `Yêu cầu kiểm duyệt khóa học ${courseInfo.rows[0].title.toString()}`,
					text: ``,
					html: `<p>Xin chào ${manager.rows[0].full_name},</p>
						<p>Bạn đã nhận được yêu cầu kiểm duyệt khóa học ${courseInfo.rows[0].title} với mã khóa học là ${courseInfo.rows[0].course_id}</p>`,
				};

				await mail.sendMail(mailOptions);
			}
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'updateCourseFlag'
		);
		return next(error);
	} finally {
		mail.close();
	}
	res.json({ message: 'Cập nhật thành công' });
};

const getCourseFilter = async (req, res, next) => {
	try {
		const results = await pool.query(
			`
			select course.course_id as value , course.title as text  from course where flag =false and status='1'
		`
		);
		return res.status(200).json(results.rows);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'course.controller.js',
			'updateCourseFlag'
		);
		return next(error);
	}
};

// const sendRequestReview= async (req, res, next) => {
// 	const { course_id } = req.body;
// 	// const d = new Date();
// 	const month = parseInt(month1);
// 	const year = parseInt(year1);
// 	const current_month = ('0' + month).slice(-2);
// 	const last_month = ('0' + (month - 1)).slice(-2);
// 	const current_year = year;

// 	let last_year = '';
// 	if (current_month == '01') {
// 		last_month = '12';
// 		last_year = current_year - 1;
// 	} else {
// 		last_year = current_year;
// 	}
// 	try {

// 		const mailQuery = `
// 		Select title from course where course_id =$1
// 		`;
// 		const mailParams = [course_id];
// 		course_info = await pool.query(mailQuery, mailParams);

// 			const mailOptions = {
// 				from: 'Xoài Academy <xoaiacademy@gmail.com>',
// 				to: list_final[i].email.toString(),
// 				subject: `Yêu cầu kiếm duyệt khóa học ${course_info[0].title}`,
// 				text: '',
// 				html: `<html>
// 			            <head>
//                         <style>

//                         </style>
// 			</head>
// 			<body>
// 				<div>
//                     <p>Hi Marketing Manager</p>
// 					<p>Tôi đã hoàn thành khóa học${course_info[0].title}. Nhờ bạn kiểm duyệt</p>

//                 </div>
//             </body>
//             </html>`,
// 			};

// 			await mail.sendMail(mailOptions);

// 		return res.status(200).json({ message: 'Thành công' });
// 	} catch (err) {
// 		const error = new HttpError('Something went wrong, please try again.', 500);
// 		sendLog(err.stack, error.code, error.message, 'job.config.js', 'job');
// 	}
// };

module.exports = {
	getSubjectList,
	getCourseList,
	getTotalCourseListByFilter,
	getTeacherList,
	getListCourseByStudentId,
	createCourse,
	getCourseById,
	updateCourse,
	reviewCourse,
	updateCourseFlag,
	getCourseFilter,
};
