const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const sendLog = require('../configs/tracking-log.config');
const functionCommon = require('../common/function');
const {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
} = require('../common/validate');
const validator = require('validator').default;

const updateSalary = async (req, res, next) => {
	const role = req.userData.role;
	const data = req.body;
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	const client = await pool.connect();
	const check = await functionCommon.checkRole(role, 'function_edit_salary');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	try {
		await client.query('BEGIN');
		for (let i = 0; i < data.length; i++) {
			if (
				(validateIsEmpty(data[i].status) == false &&
					!validator.matches(data[i].status, /^(0|1)$/)) ||
				(validateIsEmpty(data[i].bonus) == false &&
					!validateMaxLength(data[i].bonus, 255) &&
					!validator.isNumeric(data[i].bonus))
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}
			for (let k = 0; k < data[i].list_salary_id.length; k++) {
				if (validateIsEmpty(data[i].list_salary_id[k].salary_id) == false) {
					return next(
						new HttpError(
							'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
							422
						)
					);
				}
				if (k == 0) {
					const query = `
                    UPDATE public.salary
                    SET status=$1,
                        modified_at=$2, 
                        modified_by=$3,
                        bonus=$4
                    WHERE  salary_id=$5;
                    `;
					const param = [
						data[i].status,
						datetime,
						userId,
						data[i].bonus,
						data[i].list_salary_id[k].salary_id,
					];
					await client.query(query, param);
				} else {
					const query = `
                    UPDATE public.salary
                    SET status=$1,
                        modified_at=$2, 
                        modified_by=$3
                    WHERE  salary_id=$4
                    `;
					const param = [
						data[i].status,
						datetime,
						userId,
						data[i].list_salary_id[k].salary_id,
					];
					await client.query(query, param);
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
			'salary.controller.js',
			'updateSalary'
		);
		return next(error);
	} finally {
		client.release();
	}
	return res.status(200).json({
		message: 'Cập nhật thành công',
	});
};

const updateSalaryCourse = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_edit_salary');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const data = req.body;
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		for (let i = 0; i < data.length; i++) {
			if (
				validateIsEmpty(data[i].status) == false ||
				(data[i].status != '0' && data[i].status != '1') ||
				validateIsEmpty(data[i].salary_course_id) == false
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			const query = `
                UPDATE 
                    public.salary_course
	            SET   
                    status=$1,
                    modified_by=$2, 
                    modified_at=$3
	            WHERE 
                    salary_course_id=$4;
            `;
			const param = [
				data[i].status,
				userId,
				datetime,
				data[i].salary_course_id,
			];
			await client.query(query, param);
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'salary.controller.js',
			'updateSalaryCourse'
		);
		return next(error);
	} finally {
		client.release();
	}
	return res.status(200).json({
		message: 'Cập nhật trạng thái lương thành công',
	});
};

const getTotalBillByUser = async (req, res, next) => {
	const { filter1, filter2, filter3, filter4 } = req.query;
	try {
		const query = `
        select count(distinct salary.class_id) from 
            salary 
            inner join schedule on 
            schedule.schedule_id =salary.schedule_id
            where 
            to_char(schedule.date,'MM') = $1 and 
            to_char(schedule.date,'YYYY') = $2	and
            salary.status ${filter3 === '' ? '!' : ''}= $3 and
			user_id=$4
		`;
		const param = [filter1, filter2, filter3, filter4];
		const data = await pool.query(query, param);
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
			'salary.controller.js',
			'getTotalBillByUser'
		);
		return next(error);
	}
};

const getTotalBillOnlineByUser = async (req, res, next) => {
	const { filter1, filter2, filter3, filter4 } = req.query;
	try {
		const query = `
        select count(salary_course_id) 
        from salary_course 
        where 
            user_id = $1 and 
            month =$2 and 
            year=$3 and
            status ${filter3 === '' ? '!' : ''}= $4
		`;
		const param = [filter4, filter1, filter2, filter3];
		const data = await pool.query(query, param);
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
			'salary.controller.js',
			'getTotalBillOnlineByUser'
		);
		return next(error);
	}
};

const getTotalSalary = async (req, res, next) => {
	const { filter1, q, filter2, filter3 } = req.query;
	let user_id = '';
	const role = req.userData.role;
	const userId = req.userData.userId;
	if (role != 1 && role != 2) {
		user_id = userId;
	}
	try {
		const query = `
		Select count(*) from (
			Select 	a.id,a.role_id,a.full_name,a.account_number,a.account_holder,a.phone,LEAST(a.status_off,b.status_on) as salary_status,
					(coalesce(Sum(a.salary_total_off),0)+coalesce(Sum(b.total_on),0)) as salary_total from (
						
						Select  distinct users.user_id as id,users.role_id,users.full_name,users.account_number,users.account_holder,	
						Min(salary.status) as status_off,
						(coalesce(Sum(salary.amount),0)+coalesce(Sum(salary.bonus),0)) as salary_total_off,users.phone							
						 from users								
							full join							
									salary on users.user_id = salary.user_id					
							full join							
									schedule on schedule.schedule_id=salary.schedule_id										
							Where (salary.month::varchar(255) = $1)							
							and (to_char(salary.created_at,'YYYY') = $2)												
							Group by users.user_id,users.phone,users.role_id,users.account_number,users.account_holder,users.full_name					
							) a						
							left join (							
								Select coalesce(Sum(total),0) as total_on,salary_course.user_id,month,year,Min(status) as status_on from salary_course						
								where						
								month = $3 and						
								year = $4				
								Group by salary_course.user_id,month,year						
							) b on a.id=b.user_id	
					
							Group by a.id,a.role_id,a.full_name,a.account_number,a.account_holder,a.phone,a.status_off,b.status_on
							order by salary_status ASC 
			) salary_list
				where salary_status ${filter3 === '' ? '!' : ''}= $5    
				AND id ${user_id === '' ? '!' : ''}= $8
				and (LOWER(id) like LOWER($6) or LOWER(full_name) like LOWER($7) )		                              
    
		`;
		const param = [
			parseInt(filter1).toString(),
			filter2,
			filter1,
			filter2,
			filter3,
			'%' + q + '%',
			'%' + q + '%',
			user_id,
		];

		const data = await pool.query(query, param);
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
			'salary.controller.js',
			'getTotalSalary'
		);
		return next(error);
	}
};

const getTotalEmployeeSalary = async (req, res, next) => {
	const { filter1, filter2 } = req.query;
	try {
		const query = `
		Select coalesce(a.salary_course, 0)+coalesce(b.salary, 0) as sum,b.role_id from							
			(				
				Select Sum(total) as salary_course,role_id from salary_course			
				inner join users on users.user_id = salary_course.user_id					
				where							
				month = $1 and							
				year= $2							
				group by users.role_id			
			) a full join(				
			select sum(amount)+sum(coalesce(bonus, 0)) as salary,role_id				
			from salary				
			inner join users on users.user_id = salary.user_id				
			where  salary.month::varchar(255) = $3	
			and to_char(salary.created_at,'YYYY') = $4				
			group by users.role_id				
			) b on a.role_id = b.role_id	
			order by b.role_id		
		`;
		const param = [filter1, filter2, parseInt(filter1).toString(), filter2];
		const data = await pool.query(query, param);
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
			'salary.controller.js',
			'getTotalEmployeeSalary'
		);
		return next(error);
	}
};

const getSalaryCourse = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3, filter4 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		    select salary_course.salary_course_id,course.title,salary_course.total_course_sold,salary_course.total,salary_course.bonus,salary_course.status 
            from salary_course										
            inner join course
                on course.course_id = salary_course.course_id										
            where 
                month=$1 and 
                year =$2 and 
                salary_course.status ${filter3 === '' ? '!' : ''}=$3 and 
                course.created_by =$4
                order by salary_course.status ASC LIMIT $5 OFFSET $6
		`;
		const param = [filter1, filter2, filter3, filter4, limit, offset];
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
			'salary.controller.js',
			'getSalaryCourse'
		);
		return next(error);
	}
};

const getSalaryList = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3 } = req.query;
	// if(filter1=='' || filter2==''){
	// 	const error = new HttpError('Vui lòng chọn tháng và năm', 404);
	// 	return next(error);
	// }
	const offset = (page - 1) * limit;
	let user_id = '';
	const role = req.userData.role;
	const userId = req.userData.userId;
	if (role != 1 && role != 2) {
		user_id = userId;
	}
	try {
		const query = `
		Select * from (
			Select 	a.id,a.role_id,a.full_name,a.account_number,a.account_holder,a.phone,LEAST(a.status_off,b.status_on) as salary_status,
					(coalesce(Sum(a.salary_total_off),0)+coalesce(Sum(b.total_on),0)) as salary_total from (
						
						Select  distinct users.user_id as id,users.role_id,users.full_name,users.account_number,users.account_holder,	
						Min(salary.status) as status_off,
						(coalesce(Sum(salary.amount),0)+coalesce(Sum(salary.bonus),0)) as salary_total_off,users.phone							
						 from users								
							full join							
									salary on users.user_id = salary.user_id					
							full join							
									schedule on schedule.schedule_id=salary.schedule_id										
							Where (salary.month::varchar(255) = $1)							
							and (to_char(salary.created_at,'YYYY') = $2)												
							Group by users.user_id,users.phone,users.role_id,users.account_number,users.account_holder,users.full_name					
							) a						
							left join (							
								Select coalesce(Sum(total),0) as total_on,salary_course.user_id,month,year,Min(status) as status_on from salary_course						
								where						
								month = $3 and						
								year = $4				
								Group by salary_course.user_id,month,year						
							) b on a.id=b.user_id	
					
							Group by a.id,a.role_id,a.full_name,a.account_number,a.account_holder,a.phone,a.status_off,b.status_on
							order by salary_status ASC OFFSET $8 LIMIT $9
			) salary_list
				where salary_status ${filter3 === '' ? '!' : ''}= $5  
				AND id ${user_id === '' ? '!' : ''}= $10  
				and (LOWER(id) like LOWER($6) or LOWER(full_name) like LOWER($7) )																						
		`;
		const param = [
			parseInt(filter1).toString(),
			filter2,
			filter1,
			filter2,
			filter3,
			'%' + q + '%',
			'%' + q + '%',
			offset,
			limit,
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
			'salary.controller.js',
			'getSalaryList'
		);
		return next(error);
	}
};

const getDetailSalaryList = async (req, res, next) => {
	const { page, limit, filter1, filter2, filter3, filter4 } = req.query;
	const offset = (page - 1) * limit;
	try {
		const query = `
		    select a.*,count(class_student.student_id) as total_student from
            class_student inner join (
                select  
                    distinct  salary.user_id,salary.class_id,class.class_name,users.phone,salary.status,Sum(salary.amount) as pre_money,
                    Sum(salary.bonus) as bonus from salary								
                    inner join users on users.user_id = salary.user_id								
                    inner join schedule on schedule.schedule_id=salary.schedule_id		
                    inner join class on class.class_id=salary.class_id	
                    where to_char(schedule.date,'MM') =$1
                    and to_char(schedule.date,'YYYY')=$2								
                    and users.user_id=$3	
                    and salary.status ${filter3 === '' ? '!' : ''}= $4			
                    group by salary.user_id,salary.class_id,users.phone,salary.status,class.class_name	
        ) a on a.class_id = class_student.class_id
        group by class_student.class_id,a.user_id,a.user_id,a.class_id,a.phone,a.status,a.class_name,a.pre_money,a.bonus
        order by a.status ASC LIMIT $5 OFFSET $6
		`;
		const param = [filter1, filter2, filter4, filter3, limit, offset];
		const data_1 = await pool.query(query, param);
		const final_data = [];
		for (let i = 0; i < data_1.rows.length; i++) {
			const query_2 = `
            select 
                salary.salary_id,salary.class_id, 
                to_char(schedule.date,'YYYY/MM/DD') as date,
                salary.present_student,salary.amount from salary								
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
			const param_2 = [filter4, data_1.rows[i].class_id, filter1, filter2];
			const data_2 = await pool.query(query_2, param_2);

			const data_3 = {
				...data_1.rows[i],
				list_detail: data_2.rows,
			};
			final_data.push(data_3);
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
			'salary.controller.js',
			'getDetailSalaryList'
		);
		return next(error);
	}
};

const caculateScheduleSalary = async (req, res, next) => {
	const { schedule_id, class_id, teacher_id, tutor_id, is_update } = req.body;
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	const client = await pool.connect();
	const d = new Date();
	const current_month = d.getMonth() + 1;
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}
	try {
		await client.query('BEGIN');

		const check_salary = `select * from salary where user_id=$1 and schedule_id=$2`;
		const params_check_salary = [teacher_id, schedule_id];

		const check_responese = await client.query(
			check_salary,
			params_check_salary
		);
		if (check_responese.rowCount > 0 && is_update == false) {
			const error = new HttpError('Lương nhân viên của buổi học bị trùng', 403);
			return next(error);
		}
		// get List student present
		const query_caculate_amount = `
		select a.count * b.price as amount,a.count as present_student from
			(select 
				count(users.user_id) 
			from attendance 
			inner join 
				users on users.user_id = attendance.user_id
			where 						
				users.role_id = '5' and schedule_id =$1 and is_active = '1') a ,						
			(Select 
				(price* percent/100) as price 
			from 
				class 
			where class_id =$2) b`;

		const params_caculate_amount = [schedule_id, class_id];

		const responese = await client.query(
			query_caculate_amount,
			params_caculate_amount
		);
		const amount = responese.rows[0];
		// sau khi edit diem danh
		if (is_update) {
			const query_update_teacher_salary = `
			UPDATE public.salary
			SET  
				amount=$1,
				modified_at=$2,
				modified_by=$3, 
				present_student=$4
			WHERE 
				schedule_id=$5
				and user_id=$6;`;
			const params_update_teacher_salary = [
				amount.amount,
				datetime,
				userId,
				amount.present_student,
				schedule_id,
				teacher_id,
			];
			await client.query(
				query_update_teacher_salary,
				params_update_teacher_salary
			);

			// update cho tutor
			if (tutor_id != '') {
				let tutor_amount = '';

				// check xem tutor có mặt hay không
				const query_check_tutor_attendance = `
					select is_active from attendance inner join users on attendance.user_id = users.user_id and users.role_id ='4' 
					where schedule_id =$1
				`;
				const params_check_tutor_attendance = [schedule_id];
				const tutor_attendace = await client.query(
					query_check_tutor_attendance,
					params_check_tutor_attendance
				);
				if (tutor_attendace.rows[0].is_active == '0') {
					tutor_amount = '0';
				} else if (tutor_attendace.rows[0].is_active == '2') {
					const query_get_tutor_salary = `
							select setting_value as tutor_salary  from setting where setting_type= 'tutor_sc_salary' 
						`;
					const tutor_salary = await client.query(query_get_tutor_salary);
					tutor_amount = tutor_salary.rows[0].tutor_salary;
				} else {
					const query_get_tutor_salary = `
					select setting_value as tutor_salary  from setting where setting_type= 'tutor_nm_salary' 
				`;
					const tutor_salary = await client.query(query_get_tutor_salary);
					tutor_amount = tutor_salary.rows[0].tutor_salary;
				}

				// insert salary tutor
				const query_update_tutor_salary = `
						UPDATE public.salary
						SET  
							amount=$1,
							modified_at=$2,
							modified_by=$3, 
							present_student=$4
						WHERE 
							schedule_id=$5
							and user_id=$6;`;
				const params_update_tutor_salary = [
					tutor_amount,
					datetime,
					userId,
					amount.present_student,
					schedule_id,
					tutor_id,
				];
				await client.query(
					query_update_tutor_salary,
					params_update_tutor_salary
				);
			}
		} else {
			// diem danh lan dau
			// cho teacher
			const get_schedule_date = `select to_char(date,'MM')  as month from schedule where teacher_id=$1 and schedule_id=$2`;
			const params_schedule_date = [teacher_id, schedule_id];

			const schedule_date = await client.query(
				get_schedule_date,
				params_schedule_date
			);
			const month_of_schedule = schedule_date.rows[0].month;

			const query_insert_teacher_salary = `
				INSERT INTO public.salary(										
					salary_id, user_id, amount, schedule_id, status, 
					created_by,modified_by, class_id, present_student,month)									
				VALUES (
					nextval('salary_id'), $1, $2, $3, '0',
					$4, $5,$6, $7,$8
					);`;
			const params_insert_teacher_salary = [
				teacher_id,
				amount.amount,
				schedule_id,
				userId,
				userId,
				class_id,
				amount.present_student,
				month_of_schedule,
			];
			await client.query(
				query_insert_teacher_salary,
				params_insert_teacher_salary
			);

			// cho tutor
			if (tutor_id != '' && tutor_id != undefined) {
				// check xem tutor có mặt hay không
				const query_check_tutor_attendance = `
					select is_active from attendance inner join users on attendance.user_id = users.user_id and users.role_id ='4' 
					where schedule_id =$1
				`;
				const params_check_tutor_attendance = [schedule_id];
				const tutor_attendace = await client.query(
					query_check_tutor_attendance,
					params_check_tutor_attendance
				);
				if (tutor_attendace.rows[0].is_active == '0') {
					tutor_amount = '0';
				} else if (tutor_attendace.rows[0].is_active == '2') {
					const query_get_tutor_salary = `
							select setting_value as tutor_salary  from setting where setting_type= 'tutor_sc_salary' 
						`;
					const tutor_salary = await client.query(query_get_tutor_salary);
					tutor_amount = tutor_salary.rows[0].tutor_salary;
				} else {
					const query_get_tutor_salary = `
					select setting_value as tutor_salary  from setting where setting_type= 'tutor_nm_salary' 
				`;
					const tutor_salary = await client.query(query_get_tutor_salary);
					tutor_amount = tutor_salary.rows[0].tutor_salary;
				}
				// insert salary tutor
				const query_insert_tutor_salary = `
					INSERT INTO public.salary(										
						salary_id, user_id, amount, schedule_id, status, 
						created_by,modified_by, class_id, present_student,month)									
					VALUES (
						nextval('salary_id'), $1, $2, $3, '0',
						$4, $5,$6, $7,$8
						);`;
				const params_insert_tutor_salary = [
					tutor_id,
					tutor_amount,
					schedule_id,
					userId,
					userId,
					class_id,
					amount.present_student,
					month_of_schedule,
				];
				await client.query(
					query_insert_tutor_salary,
					params_insert_tutor_salary
				);
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
			'salary.controller.js',
			'getSalaryList'
		);
		return next(error);
	} finally {
		client.release();
	}
	return res.status(200).json({
		message: 'Tính lương thành công',
	});
};

module.exports = {
	getSalaryList,
	getTotalEmployeeSalary,
	getDetailSalaryList,
	getSalaryCourse,
	updateSalary,
	getTotalSalary,
	getTotalBillByUser,
	updateSalaryCourse,
	getTotalBillOnlineByUser,
	caculateScheduleSalary,
};
