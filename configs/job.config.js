const schedule = require('node-schedule');
const sendLog = require('./tracking-log.config');
const pool = require('./db.config');
const HttpError = require('../models/http-error');
const mail = require('./mail.config');

schedule.scheduleJob('30 3 1 * *', async () => {
	const client = await pool.connect();
	const d = new Date();

	const current_month = ('0' + (d.getMonth() + 1)).slice(-2);
	const last_month = ('0' + d.getMonth()).slice(-2);

	const current_year = d.getFullYear();
	let last_year = '';
	if (current_month == '01') {
		last_month = '12';
		last_year = current_year - 1;
	} else {
		last_year = current_year;
	}
	try {
		await client.query('BEGIN');
		// get List student present
		const query_caculate_student_fee = `
		select 
		a.price,a.percent,a.user_id,a.total_lesson,a.class_id,a.class_name,coalesce(b.additional_charges, 0) as additional_charges,
		coalesce(b.residual_fee, 0) as residual_fee,
		(a.price*(a.total_lesson)+coalesce(b.additional_charges, 0)-coalesce(b.residual_fee, 0)) as fee
		
		from (									
			select 
				class.price,class.percent,class.class_id,count(attendance_id) as total_lesson,attendance.user_id,class.class_name 
			from 
				attendance 
			inner join								
				schedule 
					on schedule.schedule_id=attendance.schedule_id inner join class on class.class_id = schedule.class_id									
			inner join 
				users 
					on users.user_id = attendance.user_id								
			where to_char(schedule.date,'MM')=$1 and to_char(schedule.date,'YYYY')=$2 and users.role_id='5'									
			group by attendance.user_id,class.class_name,class.class_id,class.price,class.percent									
											
		) a left join (									
			Select payment.residual_fee,payment.additional_charges,payment.student_id,payment.class_id from payment where month=$3	and year =$4						
		) b on a.user_id =b.student_id and a.class_id=b.class_id
					
	`;
		const params_caculate_student_fee = [
			current_month,
			current_year,
			last_month,
			last_year,
		];
		const res = await client.query(
			query_caculate_student_fee,
			params_caculate_student_fee
		);

		for (let i = 0; i < res.rowCount; i++) {
			const query_insert_fee_payment = `
				INSERT INTO public.payment(
				payment_id, class_id, student_id, status, amount,
				created_by, modified_by, month, year, class_price, additional_charges, residual_fee,
				total_lesson_in_month)
				VALUES (nextval('payment_id'), $1, $2, '0', $3, $4, $5, $6, $7, $8, $9, $10,$11)`;
			const params_insert_fee_payment = [
				res.rows[i].class_id,
				res.rows[i].user_id,
				res.rows[i].fee,
				'admin',
				'admin',
				current_month % 12,
				current_year,
				res.rows[i].price,
				'0',
				'0',
				res.rows[i].total_lesson,
			];
			await client.query(query_insert_fee_payment, params_insert_fee_payment);
		}

		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(err.stack, error.code, error.message, 'server.js', 'job');
	} finally {
		client.release();
	}
});

schedule.scheduleJob('30 4 1 * *', async () => {
	const d = new Date();

	const current_month = ('0' + (d.getMonth() + 1)).slice(-2);
	const last_month = ('0' + d.getMonth()).slice(-2);

	const current_year = d.getFullYear();
	let last_year = '';
	if (current_month == '01') {
		last_month = '12';
		last_year = current_year - 1;
	} else {
		last_year = current_year;
	}
	try {
		let mailData;
		const mailQuery = `Select class.class_name,class.price,users.user_id, users.full_name, users.email, payment.month, payment.year,
		coalesce(a.additional_charges,0) as additional_charges,
		coalesce(a.residual_fee,0) as residual_fee,
		payment.amount,
		payment.total_lesson_in_month from payment 
	inner join users on users.user_id = payment.student_id
	inner join class on class.class_id = payment.class_id
	left join (
		Select * from payment 
		inner join users on users.user_id = payment.student_id
		where month = $1 and year = $2
	) a on a.student_id = payment.student_id  and a.class_id = payment.class_id
where payment.month = $3 and payment.year = $4 AND users.status = '1' AND
class.class_status != '2' AND payment.flag = false
ORDER BY users.user_id`;
		const mailParams = [last_month, last_year, current_month, last_year];
		mailData = await pool.query(mailQuery, mailParams);

		const mailDataArray = mailData.rows;
		let list_mail = [];
		let list_class = [];

		let user_id = '';

		for (let i = 0; i < mailDataArray.length; i++) {
			if (user_id != mailDataArray[i].user_id) {
				if (list_class.length > 0) {
					const mail = {
						userId: mailDataArray[i - 1].user_id,
						username: mailDataArray[i - 1].full_name,
						email: mailDataArray[i - 1].email,
						listClass: list_class,
					};
					list_mail.push(mail);
				}
				user_id = mailDataArray[i].user_id;
				list_class = [];
				list_class.push({
					classname: mailDataArray[i].class_name,
					price: mailDataArray[i].price,
					totalLessonInMonth: mailDataArray[i].total_lesson_in_month,
					additionalCharges: mailDataArray[i].additional_charges,
					residualFee: mailDataArray[i].residual_fee,
					amount: mailDataArray[i].amount,
				});
			} else {
				list_class.push({
					classname: mailDataArray[i].class_name,
					price: mailDataArray[i].price,
					totalLessonInMonth: mailDataArray[i].total_lesson_in_month,
					additionalCharges: mailDataArray[i].additional_charges,
					residualFee: mailDataArray[i].residual_fee,
					amount: mailDataArray[i].amount,
				});
			}
		}

		if (mailDataArray.length > 0) {
			const mail = {
				userId: mailDataArray[mailDataArray.length - 1].user_id,
				username: mailDataArray[mailDataArray.length - 1].full_name,
				email: mailDataArray[mailDataArray.length - 1].email,
				listClass: list_class,
			};
			list_mail.push(mail);
		}

		for (let i = 0; i < list_mail.length; i++) {
			let tablehtmlContent = `<table id="customers">
            <tr>
            <th>STT</th>
            <th>Tên lớp</th>
            <th>Học phí / buổi</th>
            <th>Tổng số buổi tháng ${new Date().getMonth() + 1}</th>
            <th>Phí nợ (tháng ${new Date().getMonth()})</th>
            <th>Phí thừa (tháng ${new Date().getMonth()})</th>
            <th>Thành tiền</th>
          </tr>
            `;
			const listClass = list_mail[i].listClass;
			let totalAmount = 0;
			for (let j = 0; j < listClass.length; j++) {
				totalAmount += parseFloat(listClass[j].amount);
				const trText = `<tr>
                                    <td>${j + 1}</td>
                                    <td>${listClass[j].classname}</td>
                                    <td>${listClass[j].price.toLocaleString(
																			'vi-VN',
																			{
																				style: 'currency',
																				currency: 'VND',
																			}
																		)}</td>
                                    <td>${listClass[j].totalLessonInMonth}</td>
                                    <td>${listClass[
																			j
																		].additionalCharges.toLocaleString(
																			'vi-VN',
																			{
																				style: 'currency',
																				currency: 'VND',
																			}
																		)}</td>
                                    <td>${listClass[
																			j
																		].residualFee.toLocaleString('vi-VN', {
																			style: 'currency',
																			currency: 'VND',
																		})}</td>
                                    <td>${listClass[j].amount.toLocaleString(
																			'vi-VN',
																			{
																				style: 'currency',
																				currency: 'VND',
																			}
																		)}</td>                         
                                </tr>`;
				tablehtmlContent += trText;
			}
			tablehtmlContent += '</table>';

			const mailOptions = {
				from: 'Xoài Academy <xoaiacademy@gmail.com>',
				to: list_mail[i].email.toString(),
				subject: `Thông báo học phí tháng ${new Date().getMonth() + 1}`,
				text: '',
				html: `<html>
			            <head>
                        <style>
                        #customers {
                          font-family: Arial, Helvetica, sans-serif;
                          border-collapse: collapse;
                          width: 100%;
                        }
                        
                        #customers td, #customers th {
                          border: 1px solid #ddd;
                          padding: 8px;
                        }
                        
                        #customers tr:nth-child(even){background-color: #f2f2f2;}
                        
                        #customers tr:hover {background-color: #ddd;}
                        
                        #customers th {
                          padding-top: 12px;
                          padding-bottom: 12px;
                          text-align: left;
                          background-color: #04AA6D;
                          color: white;
                        }
                        </style>
			</head>
			<body>
				<div>
                    <p>Xin lỗi nếu mail này làm phiền đến bạn.</p>
					<p>Hi ${list_mail[i].username},</p>
					<p>Xoài Academy gửi gia đình và em học phí tháng ${
						new Date().getMonth() + 1
					}:</p>
					${tablehtmlContent}
                    <p>Tổng số tiền phải đóng: ${totalAmount.toLocaleString(
											'vi-VN',
											{
												style: 'currency',
												currency: 'VND',
											}
										)}</p>
                </div>
            </body>
            </html>`,
			};

			await mail.sendMail(mailOptions);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(err.stack, error.code, error.message, 'job.config.js', 'job');
	} finally {
		mail.close();
	}
});

schedule.scheduleJob('30 5 1 * *', async () => {
	const d = new Date();

	const current_month = ('0' + (d.getMonth() + 1)).slice(-2);
	const last_month = ('0' + d.getMonth()).slice(-2);

	const current_year = d.getFullYear();
	let last_year = '';
	if (current_month == '01') {
		last_month = '12';
		last_year = current_year - 1;
	} else {
		last_year = current_year;
	}
	try {
		let mailData;
		const mailQuery = `select salary.salary_id,salary.class_id, users.full_name,salary.bonus,users.email,schedule.schedule_id,users.role_id,users.user_id,
			class.class_name,
			to_char(schedule.date,'YYYY/MM/DD') as date,
			salary.present_student,salary.amount from salary								
		inner join users 
			on users.user_id = salary.user_id								
		inner join schedule 
			on schedule.schedule_id=salary.schedule_id	
		inner join class
			on class.class_id = schedule.class_id
		where 
			to_char(schedule.date,'MM') = $1
			and to_char(schedule.date,'YYYY') = $2						
		order by users.user_id , class.class_id	,schedule.date`;
		const mailParams = [last_month, last_year];
		mailData = await pool.query(mailQuery, mailParams);

		const list = mailData.rows;

		let list_class = [];
		let list_final = [];
		let user_id = '';
		let class_id = '';
		let detailSalaryList = [];
		let amount = 0;
		let bonus = 0;
		for (let i = 0; i < list.length; i++) {
			bonus += list[i].bonus;
			amount += list[i].amount;

			if (user_id != list[i].user_id) {
				if (detailSalaryList.length > 0) {
					const classInfo = {
						class_name: list[i - 1].class_name,
						bonus: bonus - list[i].bonus,
						list_detail_salary: detailSalaryList,
						total: amount - list[i].amount,
					};
					list_class.push(classInfo);
					const userInfo = {
						full_name: list[i - 1].full_name,
						email: list[i - 1].email,
						list_class: list_class,
					};
					list_final.push(userInfo);
					list_class = [];
					amount = list[i].amount;
					bonus = list[i].bonus;
					detailSalaryList = [];
				}

				const detailsalary = {
					date: list[i].date,
					present_student: list[i].present_student,
					amount: list[i].amount,
				};
				detailSalaryList.push(detailsalary);

				user_id = list[i].user_id;
				class_id = list[i].class_id;
			} else {
				if (class_id != list[i].class_id) {
					const class_info = {
						class_name: list[i - 1].class_name,
						bonus: bonus - list[i].bonus,
						list_detail_salary: detailSalaryList,
						total: amount - list[i].amount,
					};
					list_class.push(class_info);
					class_id = list[i].class_id;
					detailSalaryList = [];
					amount = list[i].amount;
					bonus = list[i].bonus;
					const detailsalary = {
						date: list[i].date,
						present_student: list[i].present_student,
						amount: list[i].amount,
					};
					detailSalaryList.push(detailsalary);
				} else {
					const detailsalary = {
						date: list[i].date,
						present_student: list[i].present_student,
						amount: list[i].amount,
					};
					detailSalaryList.push(detailsalary);
				}
			}
		}

		if (list.length > 0) {
			const classInfo = {
				class_name: list[list.length - 1].class_name,
				bonus: bonus,
				list_detail_salary: detailSalaryList,
				total: amount,
			};
			list_class.push(classInfo);
			const userInfo = {
				full_name: list[list.length - 1].full_name,
				email: list[list.length - 1].email,
				list_class: list_class,
			};
			list_final.push(userInfo);
		}

		for (let i = 0; i < list_final.length; i++) {
			const listClass = list_final[i].list_class;
			let tableContent = ``;
			let totalSalary = 0;
			for (let j = 0; j < listClass.length; j++) {
				totalSalary +=
					parseFloat(listClass[j].total) + parseFloat(listClass[j].bonus);
				tableContent += `<p>Lớp: ${listClass[j].class_name}</p>
				<table id="customers">
            <tr>
            <th>STT</th>
            <th>Ngày</th>
            <th>Số học sinh đi học</th>
            <th>Tổng nhận</th>          
          </tr>`;
				const listDetail = listClass[j].list_detail_salary;
				for (k = 0; k < listDetail.length; k++) {
					const trText = `<tr>
                                    <td>${k + 1}</td>
                                    <td>${listDetail[k].date}</td>
                                    <td>${
																			listDetail[k].present_student
																		}</td>                                   
                                    <td>${listDetail[k].amount.toLocaleString(
																			'vi-VN',
																			{
																				style: 'currency',
																				currency: 'VND',
																			}
																		)}</td>                                                     
                                </tr>`;
					tableContent += trText;
				}
				tableContent += `</table>
				<p>Tiền thưởng: ${listClass[j].bonus.toLocaleString('vi-VN', {
					style: 'currency',
					currency: 'VND',
				})}</p>
				<p>Thành tiền: ${listClass[j].total.toLocaleString('vi-VN', {
					style: 'currency',
					currency: 'VND',
				})}</p><br/>`;
			}

			tableContent += `<br/><h2>Tổng lương tháng ${last_month}: ${totalSalary.toLocaleString(
				'vi-VN',
				{
					style: 'currency',
					currency: 'VND',
				}
			)}</h2>`;

			const mailOptions = {
				from: 'Xoài Academy <xoaiacademy@gmail.com>',
				to: list_final[i].email.toString(),
				subject: `Thông báo tiền lương tháng ${last_month}`,
				text: '',
				html: `<html>
			            <head>
                        <style>
                        #customers {
                          font-family: Arial, Helvetica, sans-serif;
                          border-collapse: collapse;
                          width: 100%;
                        }
                        
                        #customers td, #customers th {
                          border: 1px solid #ddd;
                          padding: 8px;
                        }
                        
                        #customers tr:nth-child(even){background-color: #f2f2f2;}
                        
                        #customers tr:hover {background-color: #ddd;}
                        
                        #customers th {
                          padding-top: 12px;
                          padding-bottom: 12px;
                          text-align: left;
                          background-color: #04AA6D;
                          color: white;
                        }
                        </style>
			</head>
			<body>
				<div>
                    <p>Xin lỗi nếu mail này làm phiền đến bạn.</p>
					<p>Hi ${list_final[i].full_name},</p>
					<p>Xoài Academy gửi bạn tiền lương tháng ${last_month}:</p>
					${tableContent}                  
                </div>
            </body>
            </html>`,
			};

			await mail.sendMail(mailOptions);
		}
	} catch (err) {
		const error = new HttpError('Something went wrong, please try again.', 500);
		sendLog(err.stack, error.code, error.message, 'job.config.js', 'job');
	} finally {
		mail.close();
	}
});

module.exports = schedule;
