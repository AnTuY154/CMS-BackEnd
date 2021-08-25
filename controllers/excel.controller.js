const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const { checkRole } = require('../common/function');

const getSalaryListExcel = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;
	const userId = req.userData.userId;
	const role = req.userData.role;

	let salary;
	try {
		const query = `Select * from (											
			Select  distinct users.user_id as id,users.role_id,users.full_name,users.account_number,users.account_holder,								
			(coalesce(Sum(salary.amount),0)+coalesce(Sum(salary.bonus),0)+coalesce(a.total, 0)) as salary_total,users.phone,								
			LEAST(Min(salary.status),a.status) as salary_status from users								
				full join							
						salary on users.user_id = salary.user_id					
				full join							
						schedule on schedule.schedule_id=salary.schedule_id					
				left join (							
					Select Sum(total) as total,salary_course.user_id,month,year,Min(status) as status from salary_course						
					where						
					month = $1 and						
					year = $2						
					Group by salary_course.user_id,month,year						
				) a on a.user_id=users.user_id							
				Where (to_char(schedule.date,'MM') = $3 or a.month =$7)							
				and (to_char(schedule.date,'YYYY') = $4 or a.year =$8)							
				and (LOWER(users.user_id) like LOWER($5) or LOWER(users.full_name) like LOWER($9))							
				Group by users.user_id,users.phone,a.total,users.role_id,users.account_number,users.account_holder,users.full_name,a.status							
				) a						
											
where salary_status ${
			filter3 === '' ? '!' : ''
		}= $6                                
order by salary_status ASC`;
		const params = [
			filter1,
			filter2,
			filter1,
			filter2,
			'%' + q + '%',
			filter3,
			filter1,
			filter2,
			'%' + q + '%',
		];

		salary = await pool.query(query, params);

		let salaryArray = [];
		if (salary.rowCount > 0) {
			for (let i = 0; i < salary.rowCount; i++) {
				let salaryObject = {
					['Mã nhân viên']: salary.rows[i].id,
					['Chức vụ']:
						salary.rows[i].role_id === '3' ? 'Giáo viên' : 'Trợ giảng',
					['Họ và tên']: salary.rows[i].full_name,
					['Số điện thoại']: salary.rows[i].phone,
					['Lương nhận được']: salary.rows[i].salary_total.toLocaleString(
						'vi-VN',
						{ style: 'currency', currency: 'VND' }
					),
					['Trạng thái']:
						salary.rows[i].salary_status === '1'
							? 'Đã thanh toán'
							: 'Chưa thanh toán',
				};

				salaryArray.push(salaryObject);
			}
		}

		return res.status(200).json(salaryArray);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getSalaryListReport'
		);
		return next(error);
	}
};

const getDetailSalaryListExcel = async (req, res, next) => {
	const { page, limit, filter1, filter2, filter3, filter4 } = req.query;

	try {
		const query = `
		select  
		distinct  salary.class_id as "Mã Lớp học",class.class_name as "Tên lớp",
		REPLACE(REPLACE(salary.status,'0','Chưa thanh toán'),'1','Đã Thanh Toán') as "Trạng Thái",
		TRIM(to_char(Sum(salary.amount),'999,999,999,999'))  as "Tiền nhận được",
		TRIM(to_char(Sum(salary.bonus),'999,999,999,999')) as "Tiền thưởng" from salary								
		inner join users on users.user_id = salary.user_id								
		inner join schedule on schedule.schedule_id=salary.schedule_id		
		inner join class on class.class_id=salary.class_id	
		where to_char(schedule.date,'MM') =$1
		and to_char(schedule.date,'YYYY')=$2								
		and users.user_id=$3	
		and salary.status ${filter3 === '' ? '!' : ''}= $4			
		Group by salary.class_id,class.class_name,salary.status	
		order by  "Trạng Thái" ASC  
		`;
		const param = [filter1, filter2, filter4, filter3];
		const data_1 = await pool.query(query, param);
		const final_data = [];
		for (let i = 0; i < data_1.rows.length; i++) {
			const query_2 = `
            select 
               
                to_char(schedule.date,'YYYY/MM/DD') as "Ngày",
                salary.present_student as "Số học sinh đi học",
				salary.amount as "Tiền nhận được" from salary								
            inner join users 
                on users.user_id = salary.user_id								
            inner join schedule 
                on schedule.schedule_id=salary.schedule_id								
            where 
                salary.user_id=$1
                and schedule.class_id = $2	
				and to_char(schedule.date,'MM')=$3
				and to_char(schedule.date,'YYYY')=$4						
            order by date	
        `;
			const param_2 = [filter4, data_1.rows[i]['Mã Lớp học'], filter1, filter2];
			const data_2 = await pool.query(query_2, param_2);

			const data_3 = {
				...data_1.rows[i],
				list_detail: data_2.rows,
			};
			final_data.push(data_3);
		}

		return res.status(200).json(final_data);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'salary.controller.js',
			'getDetailSalaryList'
		);
		return next(error);
	}
};

const getSalaryCourseExcel = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3, filter4 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		    select salary_course.salary_course_id as "Mã khóa học",
					course.course_name as "Tên khóa học",
					TRIM(to_char(salary_course.total,'999,999,999,999')) as "Tổng tiền nhận được" ,
					salary_course.total_course_sold as "Số lượng bán được",
					REPLACE(REPLACE(salary_course.status,'0','Chưa thanh toán'),'1','Đã Thanh Toán') as "Trạng Thái"
				
            from salary_course										
            inner join course
                on course.course_id = salary_course.course_id										
            where 
                month=$1 and 
                year =$2 and 
                salary_course.status ${filter3 === '' ? '!' : ''}=$3 and 
                course.created_by =$4
                order by salary_course.status ASC 
		`;
		const param = [filter1, filter2, filter3, filter4];
		const data = await pool.query(query, param);
		return res.status(200).json(data.rows);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'salary.controller.js',
			'getSalaryCourse'
		);
		return next(error);
	}
};

const getAttendanceDailyExcel = async (req, res, next) => {
	const { page, limit, q, date, filter1 } = req.query;
	const offset = (page - 1) * limit;
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role == 3) {
		user_id = userId;
	}
	try {
		const query = `
            select  CONCAT (count(a1.user_id) ,'/', total.total_student) as "Học sinh có mặt",
                    CONCAT (to_char(slot.start_time, 'HH24:MI') ,' - ', to_char(slot.end_time, 'HH24:MI')) as "Thời gian",
                    class.class_id as "Mã lớp học", 
					class.class_name as "Tên lớp học",
                    room.room_name,subject.subject_name as "Môn học",
                    a.full_name as "Giáo viên" ,
                    b.full_name  as "Trợ giảng",
					REPLACE(REPLACE(schedule.status,'0','Chưa điểm danh'),'1','Đã điểm danh') as "Trạng Thái",
					to_char(schedule.date,'YYYY-MM-DD') as "Ngày"
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
                and schedule.status ${filter1 === '' ? '!' : ''}= $5
                and class.teacher_id ${role === '3' ? '' : '!'}= $6
                and ( LOWER( class.class_name) like LOWER($3) or  LOWER(a.full_name) like LOWER($4))
            Group by a.user_id,b.user_id, class.class_id,room.room_name,subject.subject_name,a.full_name,b.full_name,slot.start_time,slot.end_time,schedule.status,schedule.schedule_id,total_student
            ORDER BY slot.start_time ASC ,date DESC`;
		const params = [date, date, '%' + q + '%', '%' + q + '%', filter1, user_id];
		const data = await pool.query(query, params);

		return res.status(200).json(data.rows);
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

const getCourseListExcel = async (req, res, next) => {
	const { page, limit, q, filter1, filter2 } = req.query;
	const role = req.userData.role;
	const userId = req.userData.userId;
	let user_id = '';
	if (role == 3) {
		user_id = userId;
	}
	const offset = (page - 1) * limit;

	try {
		const query = `
		Select  distinct a.course_id as "Mã khóa học",
				b.title as "Tiêu đề",
				b.subject_name as "Môn học", 
				b.cost as "Giá",								
                b.teacher_name as "Tên Giáo Viên",number_student as "Số lượng học sinh",
				
				
				coalesce(c.number_lesson,0)	as "Số lượng bài học",
				b.created_at as "Tạo ngày",
				b.created_by as "Người tạo",
				b.modified_at as "Ngày sửa cuối cùng",
				b.modified_by as "Người sửa cuối cùng",
				REPLACE(REPLACE(REPLACE(REPLACE(b.status,'0','Chưa duyệt'),'1','Đã duyệt'),'2','Từ chối'),'3','Đã xóa') as "Trạng Thái"
				

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
                        course.flag, subject.subject_id, course.created_at,course.created_by,course.modified_at,course.modified_by	
                    from 
                        course 
					INNER JOIN subject ON course.subject_id = subject.subject_id	
					INNER JOIN users on users.user_id = course.created_by
					where course.created_by ${role === '3' ? '' : '!'}= $5
					
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
                        b.percent, b.teacher_name,a.number_student, b.status,b.brief_info,b.subject_id, 
						b.created_at,b.subject_name,c.number_lesson	,b.modified_by,b.created_by				
                        order by  "Trạng Thái" ASC, b.modified_at DESC,b.created_at DESC 
		`;
		const param = ['%' + q + '%', '%' + q + '%', filter2, filter1, user_id];
		const data = await pool.query(query, param);
		return res.status(200).json(data.rows);
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

const getListLessonExcel = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, course_id } = req.query;
	const offset = (page - 1) * limit;
	const role = req.userData.role;
	let user_id = '';
	const userId = req.userData.userId;
	if (role == 3) {
		user_id = userId;
	}

	try {
		const query = `
		select 	lesson.lesson_order	as "Thứ tự chủ đề",
				lesson.lesson_title as "Chủ đề",
                source.source_title as "Bài học",
				lesson_source.order	as "Thứ tự bài học",
				REPLACE(REPLACE(REPLACE(REPLACE(lesson_source.status,'0','Chưa duyệt'),'1','Đã duyệt'),'2','Từ chối'),'3','Đã xóa') as "Trạng Thái"
				from lesson_source
            inner join 
                source on lesson_source.source_id = source.source_id
            inner join 
                lesson on lesson.lesson_id=lesson_source.lesson_id
            where 
               	lesson.course_id =$1 
                and ( LOWER(lesson.lesson_title) like LOWER($2) or  LOWER(source.source_title) like LOWER($3))
                and lesson.lesson_title ${filter1 === '' ? '!' : ''}= $4
                and lesson_source.status ${filter2 === '' ? '!' : ''}= $5
            order by lesson_order ASC , lesson_source.order ASC ,lesson_source.status ASC ,lesson.created_at DESC ,
			lesson_source.created_at DESC
        
		`;
		const param = [course_id, '%' + q + '%', '%' + q + '%', filter1, filter2];
		const data = await pool.query(query, param);
		return res.status(200).json(data.rows);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'lesson.controller.js',
			'getListLesson'
		);
		return next(error);
	}
};

const getFeedBackClassExcel = async (req, res, next) => {
	const role = req.userData.role;
	const check = await checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			feedback.feedback_id as "Mã phản hồi",
			users.full_name as "Học sinh" ,
			a.class_name as "Tên lớp",
			a.teacher_name as "Giáo viên",
			REPLACE(REPLACE(feedback.status,'0','Chưa xem'),'1','Đã xem') as "Trạng Thái",
			feedback.feedback as "Nội dung",
			to_char(feedback.created_at,'YYYY-MM-dd') as "Ngày tạo" from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select class_id,class_name,users.full_name as teacher_name 
			from class inner join users on users.user_id = class.teacher_id
			where class.teacher_id  ${filter2 === '' ? '!' : ''}= $1
			and class.class_id ${filter1 === '' ? '!' : ''}= $2
			) a
			on a.class_id = feedback.class_id
        order by feedback.status ASC, feedback.created_at DESC
		`;
		const param = [filter2, filter1];
		const data = await pool.query(query, param);
		return res.status(200).json(data.rows);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getFeedBackCourseExcel = async (req, res, next) => {
	const role = req.userData.role;
	const check = await checkRole(role, 'function_feedback_list');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { page, limit, q, filter1, filter2 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
			feedback.feedback_id as "Mã phản hồi", 
			users.full_name as "Học sinh" ,
			a.course_name as "Khóa học",a.teacher_name,
			REPLACE(REPLACE(feedback.status,'0','Chưa xem'),'1','Đã xem') as "Trạng Thái",
			feedback.feedback,to_char(feedback.created_at,'YYYY-MM-dd') as date
		from feedback 
		inner join 
			users on users.user_id = feedback.writer_id
		inner join 
			(Select course_id,course_name,users.full_name as teacher_name 
			from course inner join users on users.user_id = course.created_by
			where course.created_by  ${filter2 === '' ? '!' : ''}= $1
			and course.course_id ${filter1 === '' ? '!' : ''}= $2
			) a
			on a.course_id = feedback.course_id
        order by feedback.status ASC, date DESC
		`;
		const param = [filter2, filter1];
		const data = await pool.query(query, param);

		return res.status(200).json(data.rows);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'feedBack.controller.js',
			'getFeedBack'
		);
		return next(error);
	}
};

const getPostListExcel = async (req, res, next) => {
	const { page, limit, q, filter1 } = req.query;
	const offset = (page - 1) * limit;

	try {
		const query = `
		Select 
			distinct post.post_id as "Mã bài viết",
			post.title as "Tiêu đề",
			users.full_name as "Tác giả",
			string_agg(	setting.setting_value, ',') as "Thể loại" ,
			to_char(post.created_at,'YYYY/MM/DD') as "Ngày tạo",
			REPLACE(REPLACE(REPLACE(REPLACE(post.status,'0','Chưa duyệt'),'1','Đã duyệt'),'2','Từ chối'),'3','Đã xóa') as "Trạng Thái"

		from 
			post 
		left join 
			post_setting on post.post_id = post_setting.post_id
		left join 
			setting on post_setting.setting_id = setting.setting_id	and setting.flag=false
		Inner join users on users.user_id = post.created_by							
		Where 
			post.flag=false and  ( LOWER(post.title) like LOWER($1) or  LOWER(users.full_name) like LOWER($2)) and post.status ${
				filter1 === '' ? '!' : ''
			}= $3
		group by post.post_id,users.user_id,post.modified_at
		order by "Trạng Thái" ASC ,"Ngày tạo" DESC 
		`;
		const param = ['%' + q + '%', '%' + q + '%', filter1];
		const data = await pool.query(query, param);

		return res.status(200).json(data.rows);
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

const getRegisterListExcel = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		select 
	
			full_name as "Họ và teen",
			email as "Email",
			phone as "Số điện thoại",
			REPLACE(REPLACE(REPLACE(REPLACE(register.status,'0','Chưa liên hệ'),'1','Đã liên hệ'),'2','Kiểm tra thanh toán'),'3','Đã xóa') as "Trạng Thái",
			to_char(register.date,'YYYY/MM/DD') as "Ngày đăng ký",
			class.class_name as  "Các lớp đăng ký",
			course.course_name as "Các khóa học đăng ký"
		from 
			register
			left  join class on register.class_id=class.class_id
			left  join course on register.course_id=course.course_id
		where  
			(LOWER(phone) like LOWER($1) or  LOWER(full_name) like LOWER($2))
			and register.status ${filter1 === '' ? '!' : ''}= $3
			and to_char(register.date,'MM')${filter2 === '' ? '!' : ''}= $4 
			and to_char(register.date,'YYYY')${filter3 === '' ? '!' : ''}= $5
		Group by  full_name,email,phone,register.status,register.date,user_id,class_name,course_name
		order by "Trạng Thái" ASC

		`;
		const param = ['%' + q + '%', '%' + q + '%', filter1, filter2, filter3];
		const data = await pool.query(query, param);

		return res.status(200).json(data.rows);
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

const getManagersExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_manager');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { q, status, shift } = req.query;

	let managers;
	try {
		const query = `select * from (														
            select string_agg(concat_ws('- ', slot.slot_name, slot.start_time,slot.end_time) , ',') as slot_info,string_agg(slot.slot_id,',') as slot_id_info,users.created_at,users.user_id,users.full_name,users.gender,users.phone, users.email, users.address, users.avt_link, users.flag, users.status from users														
            inner join manager_shift on manager_shift.manager_id=users.user_id														
            inner join slot on manager_shift.slot_id=slot.slot_id and slot.type='1'														
            where users.role_id = '2' and slot.slot_id 														
            ${shift === '' ? 'not' : ''} in ($1)													
            group by users.user_id														
            ) a														
            where a.flag=false and a.status${
							status === '' ? '!' : ''
						}=$2  and (LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4))														
            order by a.created_at DESC`;
		const param = [shift, status, '%' + q + '%', '%' + q + '%'];
		managers = await pool.query(query, param);

		let managerArray = [];
		if (managers.rowCount > 0) {
			for (let i = 0; i < managers.rowCount; i++) {
				let managerObject = {
					['Mã quản lý']: managers.rows[i].user_id,
					['Họ và tên']: managers.rows[i].full_name,
					['Giới tính']:
						managers.rows[i].gender.toLowerCase() === 'male' ? 'Nam' : 'Nữ',
					['Số điện thoại']: managers.rows[i].phone,
					['Email']: managers.rows[i].email,
					['Địa chỉ']: managers.rows[i].address,
					['Ca làm']: managers.rows[i].slot_info,
					['Trạng thái']:
						managers.rows[i].status === '1'
							? 'Đang hoạt động'
							: 'Dừng hoạt động',
					['Ảnh đại diện']: managers.rows[i].avt_link,
				};
				managerArray.push(managerObject);
			}
		}

		return res.status(200).json(managerArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getManagersExcel'
		);
		return next(error);
	}
};

const getTeachersExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_teacher');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { q, status, subject } = req.query;

	let teachers;
	try {
		const query = `select * from (													
            select users.created_at,users.user_id, users.avt_link, users.full_name,users.status,LOWER(users.gender) as gender,users.phone,string_agg(subject.subject_name , ',') as teacher_subject,string_agg(subject.subject_id , ',') as teacher_subject_id,users.address,users.flag from users													
            inner join teacher_subject on users.user_id =teacher_subject.teacher_id													
            inner join subject on teacher_subject.subject_id =subject.subject_id													
            where users.role_id = '3'													
            group by users.user_id													
            ) a													
            where  a.teacher_subject_id like LOWER($1) and a.status ${
							status === '' ? '!' : ''
						}=$2  and (LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4) )													
            order by a.created_at DESC`;
		const param = ['%' + subject + '%', status, '%' + q + '%', '%' + q + '%'];
		teachers = await pool.query(query, param);

		let teacherArray = [];
		if (teachers.rowCount > 0) {
			for (let i = 0; i < teachers.rowCount; i++) {
				let teacherObject = {
					['Mã giáo viên']: teachers.rows[i].user_id,
					['Họ và tên']: teachers.rows[i].full_name,
					['Giới tính']:
						teachers.rows[i].gender.toLowerCase() === 'male' ? 'Nam' : 'Nữ',
					['Số điện thoại']: teachers.rows[i].phone,
					['Email']: teachers.rows[i].email,
					['Địa chỉ']: teachers.rows[i].address,
					['Dạy môn']: teachers.rows[i].teacher_subject,
					['Trạng thái']:
						teachers.rows[i].status === '1'
							? 'Đang hoạt động'
							: 'Dừng hoạt động',
					['Ảnh đại diện']: teachers.rows[i].avt_link,
				};
				teacherArray.push(teacherObject);
			}
		}

		return res.status(200).json(teacherArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getTeachersExcel'
		);
		return next(error);
	}
};

const getTutorsExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_tutor');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { q, status, subject } = req.query;

	let tutors;
	try {
		const query = `select * from (													
            select users.created_at,users.user_id, users.avt_link, users.full_name,users.status,LOWER(users.gender) as gender,users.phone,string_agg(subject.subject_name , ',') as teacher_subject,string_agg(subject.subject_id , ',') as teacher_subject_id,users.address,users.flag from users													
            inner join teacher_subject on users.user_id =teacher_subject.teacher_id													
            inner join subject on teacher_subject.subject_id =subject.subject_id													
            where users.role_id = '4'													
            group by users.user_id													
            ) a													
            where  a.teacher_subject_id like LOWER($1) and a.status ${
							status === '' ? '!' : ''
						}=$2  and (LOWER(a.full_name) like LOWER($3) or LOWER(a.user_id) like LOWER($4) )													
            order by a.created_at DESC`;
		const param = ['%' + subject + '%', status, '%' + q + '%', '%' + q + '%'];
		tutors = await pool.query(query, param);

		let tutorArray = [];
		if (tutors.rowCount > 0) {
			for (let i = 0; i < tutors.rowCount; i++) {
				let tutorObject = {
					['Mã trợ giảng']: tutors.rows[i].user_id,
					['Họ và tên']: tutors.rows[i].full_name,
					['Giới tính']:
						tutors.rows[i].gender.toLowerCase() === 'male' ? 'Nam' : 'Nữ',
					['Số điện thoại']: tutors.rows[i].phone,
					['Email']: tutors.rows[i].email,
					['Địa chỉ']: tutors.rows[i].address,
					['Dạy môn']: tutors.rows[i].tutor_subject,
					['Trạng thái']:
						tutors.rows[i].status === '1' ? 'Đang hoạt động' : 'Dừng hoạt động',
					['Ảnh đại diện']: tutors.rows[i].avt_link,
				};
				tutorArray.push(tutorObject);
			}
		}

		return res.status(200).json(tutorArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getTutorsExcel'
		);
		return next(error);
	}
};

const getStudentsExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_student');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { q, status, classroom, course } = req.query;

	let students;
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

		const count_students_query = query + tail_query;
		students = await pool.query(count_students_query, params);

		let studentArray = [];
		if (students.rowCount > 0) {
			for (let i = 0; i < students.rowCount; i++) {
				let studentObject = {
					['Mã học sinh']: students.rows[i].user_id,
					['Họ và tên']: students.rows[i].full_name,
					['Giới tính']:
						students.rows[i].gender.toLowerCase() === 'male' ? 'Nam' : 'Nữ',
					['Số điện thoại']: students.rows[i].phone,
					['Email']: students.rows[i].email,
					['Địa chỉ']: students.rows[i].address,
					['Trạng thái']:
						students.rows[i].status === '1'
							? 'Đang hoạt động'
							: 'Dừng hoạt động',
					['Ảnh đại diện']: students.rows[i].avt_link,
				};
				studentArray.push(studentObject);
			}
		}

		return res.status(200).json(studentArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getStudentsExcel'
		);
		return next(error);
	}
};

const getMaketingsExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_maketing');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const { q, status } = req.query;

	let maketings;
	try {
		const query = `select distinct user_id,count(post_id),users.created_at,users.full_name,users.gender,
		 users.email, users.phone,users.address,users.flag, users.status, users.avt_link, users.created_at from users								
		left join							
		(select * from post where post.status = '0') a on a.created_by = users.user_id							
		where  users.role_id = '6'	and users.flag =false and users.status ${
			status === '' ? '!' : ''
		}=$1 and (LOWER(users.full_name) like LOWER($2) or LOWER(users.user_id) like LOWER($3))						
		group by users.user_id order by users.created_at DESC`;
		const param = [status, '%' + q + '%', '%' + q + '%'];
		maketings = await pool.query(query, param);

		let maketingArray = [];
		if (maketings.rowCount > 0) {
			for (let i = 0; i < maketings.rowCount; i++) {
				let maketingObject = {
					['Mã trợ giảng']: maketings.rows[i].user_id,
					['Họ và tên']: maketings.rows[i].full_name,
					['Giới tính']:
						maketings.rows[i].gender.toLowerCase() === 'male' ? 'Nam' : 'Nữ',
					['Số điện thoại']: maketings.rows[i].phone,
					['Email']: maketings.rows[i].email,
					['Địa chỉ']: maketings.rows[i].address,
					['Số bài chờ duyệt']: maketings.rows[i].count,
					['Trạng thái']:
						maketings.rows[i].status === '1'
							? 'Đang hoạt động'
							: 'Dừng hoạt động',
					['Ảnh đại diện']: maketings.rows[i].avt_link,
				};
				maketingArray.push(maketingObject);
			}
		}

		return res.status(200).json(maketingArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getMaketingsExcel'
		);
		return next(error);
	}
};

const getClassesExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_class');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const { q, subject, room, status } = req.query;

	let classes;
	try {
		const query = `Select distinct a.class_id,number_student,b.class_name,b.subject_name,b.teacher_name, b.price ,										
		b.percent,string_agg(b.room_name , ',') as room_name , b.class_status , b.created_at,b.flag,string_agg(b.room_id , ',') as room_id,b.subject_id									
		from (										
		SELECT count(student_id) as number_student,class.class_id										
		FROM class										
		LEFT JOIN class_student										
		ON class.class_id = class_student.class_id										
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
		order by  b.created_at DESC`;
		const param = ['%' + q + '%', '%' + q + '%', status, room, subject];
		classes = await pool.query(query, param);

		const parseClassStatus = (status) => {
			switch (status) {
				case '0':
					return 'Chưa bắt đầu';
				case '1':
					return 'Đang học';
				case '2':
					return 'Đã kết thúc';
				default:
					return 'Tạm hoãn';
			}
		};

		let classArray = [];
		if (classes.rowCount > 0) {
			for (let i = 0; i < classes.rowCount; i++) {
				let classObject = {
					['Mã lớp']: classes.rows[i].class_id,
					['Tên lớp']: classes.rows[i].class_name,
					['Môn học']: classes.rows[i].subject_name,
					['Giáo viên']: classes.rows[i].teacher_name,
					['Học phí']: classes.rows[i].price,
					['Phần trăm ăn chia']: classes.rows[i].percent,
					['Phòng học']: classes.rows[i].room_name,
					['Trạng thái']: parseClassStatus(classes.rows[i].class_status),
				};
				classArray.push(classObject);
			}
		}

		return res.status(200).json(classArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getClassesExcel'
		);
		return next(error);
	}
};

const getClassesByStudentExcel = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_myclass');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}
	const userId = req.userData.userId;

	let classes;
	try {
		const query = `SELECT class.class_id, class_name, users.full_name as teacher_name, price, subject.subject_id, subject.subject_name, class_status FROM class
		INNER JOIN class_student ON class.class_id = class_student.class_id
		INNER JOIN users ON users.user_id = class.teacher_id
		INNER JOIN subject ON subject.subject_id = class.subject_id
		WHERE class_student.student_id = $1 AND class.class_status != '3' AND class_student.flag = false`;
		const params = [userId];
		classes = await pool.query(query, params);

		let classArray = [];

		const parseClassStatus = (status) => {
			switch (status) {
				case '0':
					return 'Chưa bắt đầu';
				case '1':
					return 'Đang học';
				case '2':
					return 'Đã kết thúc';
				default:
					return 'Tạm hoãn';
			}
		};

		if (classes.rowCount > 0) {
			for (let i = 0; i < classes.rowCount; i++) {
				let classObject = {
					['Mã lớp']: classes.rows[i].class_id,
					['Tên lớp']: classes.rows[i].class_name,
					['Môn học']: classes.rows[i].subject_name,
					['Giáo viên']: classes.rows[i].teacher_name,
					['Học phí']: classes.rows[i].price,

					['Trạng thái']: parseClassStatus(classes.rows[i].class_status),
				};
				classArray.push(classObject);
			}
		}

		return res.status(200).json(classArray);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'excel.controller.js',
			'getClassesByStudentExcel'
		);
		return next(error);
	}
};

const getRevenueExcelOn = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;

	const regex = /([12]\d{3}-(0[1-9]|1[0-2]))/;
	if (filter2 && filter2.match(regex) && filter3 && filter3.match(regex)) {
		try {
			const from = filter2.split('-');
			const to = filter3.split('-');
			const from_year = from[0];
			const from_month = from[1];

			const to_year = to[0];
			const to_month = to[1];
			const list_month = [from_month, to_month];
			const list_year = [from_year, to_year];
			if (
				(parseInt(from_month) > parseInt(to_month) &&
					parseInt(from_year) == parseInt(to_year)) ||
				parseInt(from_year) > parseInt(to_year)
			) {
				const error = new HttpError(
					'Thời gian bắt đầu phải lớn hơn thời gian kết thúc',
					666
				);
				return next(error);
			}
			let query = `

			select  register.register_id as "Mã hóa đơn",
					users.user_id as "Mã học sinh",
					users.full_name as "Tên học sinh", 
					course.course_id as "Mã khóa học",
					course.title as "Tiêu đề",
					to_char(register.created_at,'dd/MM/YYYY') as "Ngày mua",
					course_student.price as "Giá mua",
					to_char(course_student.join_date,'dd/MM/YYYY') as "Ngày xác nhận"
					
			from register
			inner join 
				course on course.course_id = register.course_id
			inner join 
				course_student on register.course_id = course_student.course_id
			inner join 
				users on users.user_id = register.user_id
			where register.course_id is not null and register.status ='2' and
			(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
			course.course_id ${filter1 === '' ? '!' : ''}= $3 
			and to_char(register.created_at,'MM') = ANY($4)
			and to_char(register.created_at,'YYYY')=ANY($5)
			order by course_student.join_date DESC
	
			`;
			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				list_month,
				list_year,
			];
			const data = await pool.query(query, param);
			return res.status(200).json(data.rows);
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
	} else {
		const error = new HttpError('Vui lòng chọn From và To', 500);
		return next(error);
	}
};

const getRevenueExcelOff = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;

	const regex = /([12]\d{3}-(0[1-9]|1[0-2]))/;
	if (filter2 && filter2.match(regex) && filter3 && filter3.match(regex)) {
		try {
			// const last_month = ('0' + d.getMonth()).slice(-2);
			const from = filter2.split('-');
			const to = filter3.split('-');
			const from_year = parseInt(from[0]);
			const from_month = parseInt(from[1]);
			const to_year = parseInt(to[0]);
			const to_month = parseInt(to[1]);
			if (
				(from_month > to_month && from_year == to_year) ||
				from_year > to_year
			) {
				const error = new HttpError(
					'Thời gian bắt đầu phải lớn hơn thời gian kết thúc',
					666
				);

				return next(error);
			}

			let query = `

				select 	payment.payment_id as "Mã hóa đơn",
						payment.student_id  as "Mã học sinh",
						payment.class_id as "Mã lớp học", 
						class.class_name as "Tên lớp học" ,
						CONCAT(payment.month,'/',payment.year) as "Thời gian" ,
						users.full_name as "Học sinh",
						TRIM(to_char(payment.amount,'999,999,999,999')) as "Thực thu",
						to_char(payment.payment_date,'dd/MM/YYYY') as "Ngày thu"
					from payment 
					inner join 
					users on payment.student_id = users.user_id
					inner join 
					class on class.class_id = payment.class_id
				where payment.month >=$4 and payment.month <=$5 and payment.year >=$6 and payment.year <= $7   and 
				(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				class.class_id ${filter1 === '' ? '!' : ''}= $3 
				order by payment.payment_date DESC
			
			`;
			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				from_month,
				to_month,
				from_year,
				to_year,
			];

			const data = await pool.query(query, param);

			return res.status(200).json(data.rows);
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
	} else {
		const error = new HttpError('Vui lòng chọn From và To', 500);
		// sendLog(
		// 	err.stack,
		// 	error.code,
		// 	error.message,
		// 	'post.controller.js',
		// 	'getPostList'
		// );
		return next(error);
	}
};

const getRefundMoneyExcel = async (req, res, next) => {
	// 2 là tháng 3 là năm
	const { page, limit, q, filter1, filter2 } = req.query;

	const offset = (page - 1) * limit;
	const regex = /([12]\d{3}-(0[1-9]|1[0-2]))/;
	if (filter2 && filter2.match(regex)) {
		try {
			// const last_month = ('0' + d.getMonth()).slice(-2);
			const date_info = filter2.split('-');

			const year = parseInt(date_info[0]);
			const month = parseInt(date_info[1]);
			let last_month = month - 1;
			let last_year = year;
			if (month == 1) {
				last_month = 12;
				last_year = year - 1;
			}
			let query = `
				select 	payment.payment_id as "Mã hóa đơn",
						users.full_name as "Học Sinh",
						class.class_name as "Lớp",
						
						payment.additional_charges as "Phí nợ",
						payment.residual_fee as "Phí thừa",
						(payment.residual_fee-payment.additional_charges) as "Số tiền hoàn trả",
						REPLACE(REPLACE(payment.refund_status::varchar(255),'false','Chưa thanh toán'),'true','Đã Thanh Toán') as "Trạng thái hoàn tiền"
					

				from
					payment
				inner join users on users.user_id= payment.student_id
				inner join class on class.class_id= payment.class_id
				where
				month =$1 and year =$2
				and student_id not in (
					select payment.student_id from payment where
					month =$3 and year =$4
				) and payment.class_id not in (
				select class_id from payment where
					month =$5 and year =$6
				) 
				and (payment.residual_fee !=0 or payment.additional_charges !=0)
				and (LOWER(users.full_name) like LOWER($7) or  LOWER(users.user_id) like LOWER($8)) 
				and class.class_id ${filter1 === '' ? '!' : ''}= $9
				order by refund_status
			
			`;
			const param = [
				last_month,
				last_year,
				month,
				year,
				month,
				year,
				'%' + q + '%',
				'%' + q + '%',
				filter1,
			];
			const data = await pool.query(query, param);

			return res.status(200).json(data.rows);
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
	} else {
		const error = new HttpError('Vui lòng chọn tháng', 666);
		// sendLog(
		// 	err.stack,
		// 	error.code,
		// 	error.message,
		// 	'post.controller.js',
		// 	'getPostList'
		// );
		return next(error);
	}
};

module.exports = {
	getSalaryListExcel,
	getDetailSalaryListExcel,
	getSalaryCourseExcel,
	getAttendanceDailyExcel,
	getCourseListExcel,
	getListLessonExcel,
	getFeedBackClassExcel,
	getFeedBackCourseExcel,
	getPostListExcel,
	getRegisterListExcel,
	getManagersExcel,
	getTeachersExcel,
	getTutorsExcel,
	getStudentsExcel,
	getMaketingsExcel,
	getClassesExcel,
	getClassesByStudentExcel,
	getRevenueExcelOff,
	getRevenueExcelOn,
	getRefundMoneyExcel,
};
