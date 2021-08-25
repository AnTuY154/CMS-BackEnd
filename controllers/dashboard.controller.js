const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const { checkRole } = require('../common/function');
const validator = require('validator').default;

const getAdminDashboard = async (req, res, next) => {
	const role = req.userData.role;
	const userId = req.userData.userId;

	if (role !== '1') {
		const error = new HttpError('Không có quyền truy cập', 403);
		return next(error);
	}

	try {
		let check;

		const checkQuery = `SELECT role_id FROM users WHERE user_id = $1 AND role_id = $2`;
		const checkParams = [userId, role];

		check = await pool.query(checkQuery, checkParams);

		if (check.rowCount < 1) {
			const error = new HttpError('Không có quyền truy cập', 403);
			return next(error);
		}

		// get user
		let userThisMonth;

		const userThisMonthQuery = `SELECT COUNT(*) FROM users WHERE created_at <= $1 AND status = '1'`;
		const userThisMonthParams = [new Date()];

		userThisMonth = await pool.query(userThisMonthQuery, userThisMonthParams);

		let userLastMonth;

		const userLastMonthQuery = `SELECT COUNT(*) FROM users WHERE created_at < $1 AND status = '1'`;
		const userLastMonthParams = [
			new Date(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-1`),
		];

		userLastMonth = await pool.query(userLastMonthQuery, userLastMonthParams);

		const checkUserThisMonth = userThisMonth.rows[0].count === 0 ? '0' : '1';
		const checkUserLastMonth = userLastMonth.rows[0].count === 0 ? '0' : '1';

		let userCompare =
			checkUserThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((userThisMonth.rows[0].count - userLastMonth.rows[0].count) *
									100) /
									userThisMonth.rows[0].count
							)
						),
						negative:
							userThisMonth.rows[0].count > userLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get course
		let courseThisMonth;

		const courseThisMonthQuery = `SELECT COUNT(*) FROM course WHERE created_at <= $1 AND status != '3'`;
		const courseThisMonthParams = [new Date()];

		courseThisMonth = await pool.query(
			courseThisMonthQuery,
			courseThisMonthParams
		);

		let courseLastMonth;

		const courseLastMonthQuery = `SELECT COUNT(*) FROM course WHERE created_at < $1 AND status != '3'`;
		const courseLastMonthParams = [
			new Date(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-1`),
		];

		courseLastMonth = await pool.query(
			courseLastMonthQuery,
			courseLastMonthParams
		);

		const checkCourseThisMonth =
			courseThisMonth.rows[0].count === 0 ? '0' : '1';
		const checkCourseLastMonth =
			courseLastMonth.rows[0].count === 0 ? '0' : '1';

		let courseCompare =
			checkCourseThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((courseThisMonth.rows[0].count -
									courseLastMonth.rows[0].count) *
									100) /
									courseThisMonth.rows[0].count
							)
						),
						negative:
							courseThisMonth.rows[0].count > courseLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get class
		let classThisMonth;

		const classThisMonthQuery = `SELECT COUNT(*) FROM class WHERE created_at <= $1 AND class_status != '3'`;
		const classThisMonthParams = [new Date()];

		classThisMonth = await pool.query(
			classThisMonthQuery,
			classThisMonthParams
		);

		let classLastMonth;

		const classLastMonthQuery = `SELECT COUNT(*) FROM class WHERE created_at < $1 AND class_status != '3'`;
		const classLastMonthParams = [
			new Date(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-1`),
		];

		classLastMonth = await pool.query(
			classLastMonthQuery,
			classLastMonthParams
		);

		const checkClassThisMonth = classThisMonth.rows[0].count == 0 ? '0' : '1';
		const checkClassLastMonth = classLastMonth.rows[0].count == 0 ? '0' : '1';

		let classCompare =
			checkClassThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((classThisMonth.rows[0].count - classLastMonth.rows[0].count) *
									100) /
									classThisMonth.rows[0].count
							)
						),
						negative:
							classThisMonth.rows[0].count > classLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		//get salary teacher
		let salaryTeacherOffThisMonth;

		const salaryTeacherOffThisMonthQuery = `select coalesce(sum(amount+bonus),0) as count from salary where month=$1 and to_char(created_at,'YYYY')=$2`;
		const salaryTeacherOffThisMonthParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		salaryTeacherOffThisMonth = await pool.query(
			salaryTeacherOffThisMonthQuery,
			salaryTeacherOffThisMonthParams
		);

		let salaryTeacherOnThisMonth;

		const salaryTeacherOnThisMonthQuery = `select coalesce(sum(total),0) as count from salary_course where month = $1 and year = $2`;
		const salaryTeacherOnThisMonthParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		salaryTeacherOnThisMonth = await pool.query(
			salaryTeacherOnThisMonthQuery,
			salaryTeacherOnThisMonthParams
		);

		const totalSalaryTeacherThisMonth =
			salaryTeacherOffThisMonth.rows[0].count +
			salaryTeacherOnThisMonth.rows[0].count;

		let salaryTeacherOffLastMonth;

		const salaryTeacherOffLastMonthQuery = `select coalesce(sum(amount+bonus),0) as count from salary where to_char(created_at,'MM')=$1 and to_char(created_at,'YYYY')=$2`;
		const salaryTeacherOffLastMonthParams = [
			('0' + new Date().getMonth()).slice(-2),
			new Date().getFullYear(),
		];

		salaryTeacherOffLastMonth = await pool.query(
			salaryTeacherOffLastMonthQuery,
			salaryTeacherOffLastMonthParams
		);

		let salaryTeacherOnLastMonth;

		const salaryTeacherOnLastMonthQuery = `select coalesce(sum(total),0) as count from salary_course where month = $1 and year = $2`;
		const salaryTeacherOnLastMonthParams = [
			('0' + new Date().getMonth()).slice(-2),
			new Date().getFullYear(),
		];

		salaryTeacherOnLastMonth = await pool.query(
			salaryTeacherOnLastMonthQuery,
			salaryTeacherOnLastMonthParams
		);

		const totalSalaryTeacherLastMonth =
			salaryTeacherOffLastMonth.rows[0].count +
			salaryTeacherOnLastMonth.rows[0].count;

		const checkSalaryTeacherThisMonth =
			totalSalaryTeacherThisMonth === 0 ? '0' : '1';
		const checkSalaryTeacherLastMonth =
			totalSalaryTeacherLastMonth === 0 ? '0' : '1';

		let salaryTeacherCompare =
			checkSalaryTeacherThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((totalSalaryTeacherThisMonth - totalSalaryTeacherLastMonth) *
									100) /
									totalSalaryTeacherThisMonth
							)
						),
						negative:
							totalSalaryTeacherThisMonth > totalSalaryTeacherLastMonth
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get revenue chart
		let revenueOffDataChart;
		const revenueOffDataChartQuery = `select sum(amount) as count, month from payment WHERE year=$1 GROUP BY month, year`;
		const revenueOffDataChartParams = [new Date().getFullYear()];

		revenueOffDataChart = await pool.query(
			revenueOffDataChartQuery,
			revenueOffDataChartParams
		);

		let revenueOffByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < revenueOffDataChart.rowCount; i++) {
			const month = parseInt(revenueOffDataChart.rows[i].month);
			revenueOffByMonth[month - 1] = revenueOffDataChart.rows[i].count;
		}

		let revenueOffPayDataChart;
		const revenueOffPayDataChartQuery = `select sum(amount) as count, month from payment WHERE year=$1 AND status='1' GROUP BY month, year`;
		const revenueOffPayDataChartParams = [new Date().getFullYear()];

		revenueOffPayDataChart = await pool.query(
			revenueOffPayDataChartQuery,
			revenueOffPayDataChartParams
		);

		let revenueOffPayByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < revenueOffPayDataChart.rowCount; i++) {
			const month = parseInt(revenueOffPayDataChart.rows[i].month);
			revenueOffPayByMonth[month - 1] = revenueOffPayDataChart.rows[i].count;
		}

		let revenueOnDataChart;
		const revenueOnDataChartQuery = `select a.count, a.month from (						
			select sum(price) as count, to_char(join_date,'MM') as month, to_char(join_date,'YYYY') as year from course_student						
			group by month,year						
			) a						
			where a.year= $1`;
		const revenueOnDataChartParams = [new Date().getFullYear()];

		revenueOnDataChart = await pool.query(
			revenueOnDataChartQuery,
			revenueOnDataChartParams
		);

		let revenueOnByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < revenueOnDataChart.rowCount; i++) {
			const month = parseInt(revenueOnDataChart.rows[i].month);
			revenueOnByMonth[month - 1] = revenueOnDataChart.rows[i].count;
		}

		const revenueChart = {
			labels: [
				'T1',
				'T2',
				'T3',
				'T4',
				'T5',
				'T6',
				'T7',
				'T8',
				'T9',
				'T10',
				'T11',
				'T12',
			],
			datasets: [
				{
					label: 'Doanh thu các khóa học',
					data: [
						revenueOnByMonth[0],
						revenueOnByMonth[1],
						revenueOnByMonth[2],
						revenueOnByMonth[3],
						revenueOnByMonth[4],
						revenueOnByMonth[5],
						revenueOnByMonth[6],
						revenueOnByMonth[7],
						revenueOnByMonth[8],
						revenueOnByMonth[9],
						revenueOnByMonth[10],
						revenueOnByMonth[11],
					],
					fill: false,
					backgroundColor: '#3F51B5',
					borderColor: '#3F51B5',
				},
				{
					label: 'Doanh thu tại trung tâm',
					data: [
						revenueOffPayByMonth[0],
						revenueOffPayByMonth[1],
						revenueOffPayByMonth[2],
						revenueOffPayByMonth[3],
						revenueOffPayByMonth[4],
						revenueOffPayByMonth[5],
						revenueOffPayByMonth[6],
						revenueOffPayByMonth[7],
						revenueOffPayByMonth[8],
						revenueOffPayByMonth[9],
						revenueOffPayByMonth[10],
						revenueOffPayByMonth[11],
					],
					fill: false,
					backgroundColor: '#8D99AE',
					borderColor: '#8D99AE',
				},
				{
					label: 'Doanh số tại trung tâm',
					data: [
						revenueOffByMonth[0],
						revenueOffByMonth[1],
						revenueOffByMonth[2],
						revenueOffByMonth[3],
						revenueOffByMonth[4],
						revenueOffByMonth[5],
						revenueOffByMonth[6],
						revenueOffByMonth[7],
						revenueOffByMonth[8],
						revenueOffByMonth[9],
						revenueOffByMonth[10],
						revenueOffByMonth[11],
					],
					fill: false,
					backgroundColor: '#FF4F79',
					borderColor: '#FF4F79',
				},
			],
		};

		// FF4F79 3F51B5 8D99AE

		return res.status(200).json({
			user: {
				userThisMonth: userThisMonth.rows[0].count,
				userLastMonth: userLastMonth.rows[0].count,
				checkUserThisMonth,
				checkUserLastMonth,
				userCompare,
			},
			course: {
				courseThisMonth: courseThisMonth.rows[0].count,
				courseLastMonth: courseLastMonth.rows[0].count,
				checkCourseThisMonth,
				checkCourseLastMonth,
				courseCompare,
			},
			class: {
				classThisMonth: classThisMonth.rows[0].count,
				classLastMonth: classLastMonth.rows[0].count,
				checkClassThisMonth,
				checkClassLastMonth,
				classCompare,
			},
			salaryTeacher: {
				salaryTeacherThisMonth: totalSalaryTeacherThisMonth,
				salaryTeacherLastMonth: totalSalaryTeacherLastMonth,
				checkSalaryTeacherThisMonth,
				checkSalaryTeacherLastMonth,
				salaryTeacherCompare,
			},
			revenueChart,
		});
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'dashboard.controller.js',
			'getAdminDashboard'
		);
		return next(error);
	}
};

const getManagerDashboard = async (req, res, next) => {
	const userId = req.userData.userId;

	try {
		// get feedback
		let feedbackThisMonth;
		const feedbackThisMonthQuery = `SELECT COUNT(*) FROM feedback WHERE to_char(created_at, 'MM') = $1 AND to_char(created_at, 'YYYY') = $2`;
		const feedbackThisMonthParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		feedbackThisMonth = await pool.query(
			feedbackThisMonthQuery,
			feedbackThisMonthParams
		);

		let feedbackLastMonth;
		const feedbackLastMonthQuery = `SELECT COUNT(*) FROM feedback WHERE to_char(created_at, 'MM') = $1 AND to_char(created_at, 'YYYY') = $2`;
		const feedbackLastMonthParams = [
			('0' + new Date().getMonth()).slice(-2),
			new Date().getFullYear(),
		];

		feedbackLastMonth = await pool.query(
			feedbackLastMonthQuery,
			feedbackLastMonthParams
		);

		const checkFeedbackThisMonth =
			feedbackThisMonth.rows[0].count === 0 ? '0' : '1';
		const checkFeedbackLastMonth =
			feedbackLastMonth.rows[0].count === 0 ? '0' : '1';

		let feedbackCompare =
			checkFeedbackThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((feedbackThisMonth.rows[0].count -
									feedbackLastMonth.rows[0].count) *
									100) /
									feedbackThisMonth.rows[0].count
							)
						),
						negative:
							feedbackThisMonth.rows[0].count > feedbackLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get teacher
		let teacherThisMonth;
		const teacherThisMonthQuery = `SELECT COUNT(*) FROM users WHERE role_id = '3' AND created_at <= $1 AND status = '1'`;
		const teacherThisMonthParams = [new Date()];

		teacherThisMonth = await pool.query(
			teacherThisMonthQuery,
			teacherThisMonthParams
		);

		let teacherLastMonth;
		const teacherLastMonthQuery = `SELECT COUNT(*) FROM users WHERE role_id = '3' AND created_at < $1 AND status = '1'`;
		const teacherLastMonthParams = [
			new Date(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-1`),
		];

		teacherLastMonth = await pool.query(
			teacherLastMonthQuery,
			teacherLastMonthParams
		);

		const checkTeacherThisMonth =
			teacherThisMonth.rows[0].count === 0 ? '0' : '1';
		const checkTeacherLastMonth =
			teacherLastMonth.rows[0].count === 0 ? '0' : '1';

		let teacherCompare =
			checkTeacherThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((teacherThisMonth.rows[0].count -
									teacherLastMonth.rows[0].count) *
									100) /
									teacherThisMonth.rows[0].count
							)
						),
						negative:
							teacherThisMonth.rows[0].count > teacherLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get class
		let classThisMonth;
		const classThisMonthQuery = `SELECT COUNT(*) FROM class WHERE created_at <= $1 AND class_status != '3'`;
		const classThisMonthParams = [new Date()];

		classThisMonth = await pool.query(
			classThisMonthQuery,
			classThisMonthParams
		);

		let classLastMonth;
		const classLastMonthQuery = `SELECT COUNT(*) FROM class WHERE created_at < $1 AND class_status != '3'`;
		const classLastMonthParams = [
			new Date(`${new Date().getFullYear()}-${new Date().getMonth() + 1}-1`),
		];

		classLastMonth = await pool.query(
			classLastMonthQuery,
			classLastMonthParams
		);

		const checkClassThisMonth = classThisMonth.rows[0].count === 0 ? '0' : '1';
		const checkClassLastMonth = classLastMonth.rows[0].count === 0 ? '0' : '1';

		let classCompare =
			checkClassThisMonth === '1'
				? {
						percent: Math.abs(
							parseInt(
								((classThisMonth.rows[0].count - classLastMonth.rows[0].count) *
									100) /
									classThisMonth.rows[0].count
							)
						),
						negative:
							classThisMonth.rows[0].count > classLastMonth.rows[0].count
								? false
								: true,
				  }
				: { percent: 0, negative: false };

		// get absent
		let absentThisMonth;
		const absentThisMonthQuery = `SELECT COUNT(attendance.is_active), attendance.is_active FROM schedule INNER JOIN attendance ON schedule.schedule_id = attendance.schedule_id
		INNER JOIN users ON attendance.user_id = users.user_id
		WHERE schedule.status = '1' AND users.role_id = '5' AND to_char(schedule.date, 'MM') = $1
		AND to_char(schedule.date, 'YYYY') = $2 GROUP BY attendance.is_active`;
		const absentThisMonthParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		absentThisMonth = await pool.query(
			absentThisMonthQuery,
			absentThisMonthParams
		);

		let absentLastMonth;
		const absentLastMonthQuery = `SELECT COUNT(attendance.is_active), attendance.is_active FROM schedule INNER JOIN attendance ON schedule.schedule_id = attendance.schedule_id
		INNER JOIN users ON attendance.user_id = users.user_id
		WHERE schedule.status = '1' AND users.role_id = '5' AND to_char(schedule.date, 'MM') = $1
		AND to_char(schedule.date, 'YYYY') = $2 GROUP BY attendance.is_active`;
		const absentLastMonthParams = [
			('0' + new Date().getMonth()).slice(-2),
			new Date().getFullYear(),
		];

		absentLastMonth = await pool.query(
			absentLastMonthQuery,
			absentLastMonthParams
		);

		const totalAbsentThisMonth =
			absentThisMonth.rowCount < 1 ? null : absentThisMonth.rows[0].count;
		const totalAbsentLastMonth =
			absentLastMonth.rowCount < 1 ? null : absentLastMonth.rows[0].count;

		let absentCompare =
			totalAbsentThisMonth !== null && totalAbsentLastMonth !== null
				? {
						percent: Math.abs(
							parseInt(
								((totalAbsentThisMonth - totalAbsentLastMonth) * 100) /
									totalAbsentThisMonth
							)
						),
						negative:
							totalAbsentThisMonth > totalAbsentLastMonth ? false : true,
				  }
				: { percent: 0, negative: false };

		// get student chart
		let studentDataChart;
		const studentDataChartQuery = `select a.count, a.month,a.year from (						
			select count(user_id),  to_char(created_at,'MM') as month, to_char(created_at,'YYYY') as year from users						
			where role_id='5'						
			group by month,year						
			) a						
			where a.year= $1`;
		const studentDataChartParams = [new Date().getFullYear()];

		studentDataChart = await pool.query(
			studentDataChartQuery,
			studentDataChartParams
		);

		let studentByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < studentDataChart.rowCount; i++) {
			const month = parseInt(studentDataChart.rows[i].month);
			studentByMonth[month - 1] = studentDataChart.rows[i].count;
		}

		const studentChart = {
			labels: [
				'T1',
				'T2',
				'T3',
				'T4',
				'T5',
				'T6',
				'T7',
				'T8',
				'T9',
				'T10',
				'T11',
				'T12',
			],
			datasets: [
				{
					label: 'Tổng số học sinh',
					data: [
						studentByMonth[0],
						studentByMonth[1],
						studentByMonth[2],
						studentByMonth[3],
						studentByMonth[4],
						studentByMonth[5],
						studentByMonth[6],
						studentByMonth[7],
						studentByMonth[8],
						studentByMonth[9],
						studentByMonth[10],
						studentByMonth[11],
					],
					fill: false,
					backgroundColor: '#1C6E8C',
					borderColor: '#1C6E8C',
					borderWidth: 1,
				},
			],
		};

		return res.status(200).json({
			feedback: {
				feedbackThisMonth: feedbackThisMonth.rows[0].count,
				feedbackLastMonth: feedbackLastMonth.rows[0].count,
				checkFeedbackThisMonth,
				checkFeedbackLastMonth,
				feedbackCompare,
			},
			teacher: {
				teacherThisMonth: teacherThisMonth.rows[0].count,
				teacherLastMonth: teacherLastMonth.rows[0].count,
				checkTeacherThisMonth,
				checkTeacherLastMonth,
				teacherCompare,
			},
			class: {
				classThisMonth: classThisMonth.rows[0].count,
				classLastMonth: classLastMonth.rows[0].count,
				checkClassThisMonth,
				checkClassLastMonth,
				classCompare,
			},
			absent: {
				absentThisMonth:
					totalAbsentThisMonth === null
						? null
						: (
								(absentThisMonth.rows[0].count /
									(absentThisMonth.rows[0].count +
										absentThisMonth.rows[1].count)) *
								100
						  ).toFixed(2) + '%',
				absentLastMonth:
					totalAbsentLastMonth === null
						? null
						: (
								(absentLastMonth.rows[0].count /
									(absentLastMonth.rows[0].count +
										absentLastMonth.rows[1].count)) *
								100
						  ).toFixed(2) + '%',
				absentCompare,
			},
			student: studentChart,
		});
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'dashboard.controller.js',
			'getManagerDashboard'
		);
		return next(error);
	}
};

const getTeacherDashboard = async (req, res, next) => {
	const userId = req.userData.userId;

	try {
		let studentTeaching;
		const studentTeachingQuery = `SELECT COUNT(*) FROM class_student INNER JOIN class ON class_student.class_id = class.class_id
		WHERE class.teacher_id = $1 AND class_student.flag = false AND class.class_status = '1'`;
		const studentTeachingParams = [userId];

		studentTeaching = await pool.query(
			studentTeachingQuery,
			studentTeachingParams
		);

		let classTeaching;
		const classTeachingQuery = `SELECT COUNT(*) FROM class WHERE class.teacher_id = $1 AND class_status = '1'`;
		const classTeachingParams = [userId];

		classTeaching = await pool.query(classTeachingQuery, classTeachingParams);

		let salaryOnThisMonth;
		const salaryOnThisMonthQuery = `select COALESCE(sum(total), 0) as count from salary_course where user_id = $1 and month = $2 and year = $3`;
		const salaryOnThisMonthParams = [
			userId,
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		salaryOnThisMonth = await pool.query(
			salaryOnThisMonthQuery,
			salaryOnThisMonthParams
		);

		let salaryOffThisMonth;
		const salaryOffThisMonthQuery = `select COALESCE(sum(amount+bonus), 0) as count from salary where user_id = $1 and month = $2
		and to_char(created_at,'YYYY')=$3`;
		const salaryOffThisMonthParams = [
			userId,
			parseInt(new Date().getMonth() + 1),
			new Date().getFullYear(),
		];

		salaryOffThisMonth = await pool.query(
			salaryOffThisMonthQuery,
			salaryOffThisMonthParams
		);

		let schedule;
		const scheduleQuery = `SELECT a.count, a.month FROM (
			SELECT COUNT(schedule.schedule_id), to_char(date, 'MM') as month, to_char(date,'YYYY') as year, is_active 
				FROM attendance INNER JOIN schedule ON attendance.schedule_id = schedule.schedule_id
			INNER JOIN class ON schedule.class_id = class.class_id
			WHERE attendance.user_id = $1 AND class.class_status != '2' GROUP BY month, year,is_active ) a
			WHERE a.year = $2`;
		const scheduleParams = [userId, new Date().getFullYear()];

		schedule = await pool.query(scheduleQuery, scheduleParams);

		let scheduleByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < schedule.rowCount; i++) {
			const month = parseInt(schedule.rows[i].month);
			scheduleByMonth[month - 1] = parseInt(schedule.rows[i].count);
		}

		const scheduleChart = {
			labels: [
				'T1',
				'T2',
				'T3',
				'T4',
				'T5',
				'T6',
				'T7',
				'T8',
				'T9',
				'T10',
				'T11',
				'T12',
			],
			datasets: [
				{
					label: 'Số buổi',
					data: [
						scheduleByMonth[0],
						scheduleByMonth[1],
						scheduleByMonth[2],
						scheduleByMonth[3],
						scheduleByMonth[4],
						scheduleByMonth[5],
						scheduleByMonth[6],
						scheduleByMonth[7],
						scheduleByMonth[8],
						scheduleByMonth[9],
						scheduleByMonth[10],
						scheduleByMonth[11],
					],
					fill: false,
					backgroundColor: '#FF4F79',
					borderColor: '#FF4F79',
					borderWidth: 1,
				},
			],
		};

		return res.status(200).json({
			student: studentTeaching.rows[0].count,
			class: classTeaching.rows[0].count,
			salaryOn: salaryOnThisMonth.rows[0].count,
			salaryOff: salaryOffThisMonth.rows[0].count,
			schedule: scheduleChart,
		});
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'dashboard.controller.js',
			'getTeacherDashboard'
		);
		return next(error);
	}
};

const getMarketerDashboard = async (req, res, next) => {
	const userId = req.userData.userId;

	try {
		let postNotApprove;
		const postNotApproveQuery = `SELECT COUNT(*) FROM post WHERE created_by = $1 AND status = '0' AND flag = false`;
		const postNotApproveParams = [userId];

		postNotApprove = await pool.query(
			postNotApproveQuery,
			postNotApproveParams
		);

		let totalPost;
		const totalPostQuery = `SELECT count(*) FROM post WHERE created_by = $1 AND flag = false`;
		const totalPostParams = [userId];

		totalPost = await pool.query(totalPostQuery, totalPostParams);

		let totalCourse;
		const totalCourseQuery = `SELECT count(*) FROM course WHERE status = '1'`;

		totalCourse = await pool.query(totalCourseQuery);

		let userNew;
		const userNewQuery = `SELECT count(*) FROM users WHERE role_id = '5' AND status = '1'
		 AND to_char(created_at, 'MM') = $1 AND to_char(created_at, 'YYYY') = $2`;
		const userNewParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		userNew = await pool.query(userNewQuery, userNewParams);

		let postDataChart;
		const postDataChartQuery = `SELECT a.count, a.month FROM (
			SELECT COUNT(post_id), to_char(created_at, 'MM') as month, to_char(created_at,'YYYY') as year FROM post
				WHERE created_by = $1 AND flag = false GROUP BY month, year) a
				WHERE a.year = $2`;
		const postDataChartParams = [userId, new Date().getFullYear()];

		postDataChart = await pool.query(postDataChartQuery, postDataChartParams);

		let postByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < postDataChart.rowCount; i++) {
			const month = parseInt(postDataChart.rows[i].month);
			postByMonth[month - 1] = postDataChart.rows[i].count;
		}

		const postChart = {
			labels: [
				'T1',
				'T2',
				'T3',
				'T4',
				'T5',
				'T6',
				'T7',
				'T8',
				'T9',
				'T10',
				'T11',
				'T12',
			],
			datasets: [
				{
					label: 'Tổng số bài viết',
					data: [
						postByMonth[0],
						postByMonth[1],
						postByMonth[2],
						postByMonth[3],
						postByMonth[4],
						postByMonth[5],
						postByMonth[6],
						postByMonth[7],
						postByMonth[8],
						postByMonth[9],
						postByMonth[10],
						postByMonth[11],
					],
					fill: false,
					backgroundColor: '#FF4F79',
					borderColor: '#FF4F79',
					borderWidth: 1,
				},
			],
		};

		return res.status(200).json({
			postNotApprove: postNotApprove.rows[0].count,
			totalPost: totalPost.rows[0].count,
			totalCourse: totalCourse.rows[0].count,
			userNew: userNew.rows[0].count,
			postChart,
		});
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'dashboard.controller.js',
			'getManagerDashboard'
		);
		return next(error);
	}
};

const getManagerPostDashboard = async (req, res, next) => {
	try {
		let postNotApprove;
		const postNotApproveQuery = `SELECT COUNT(*) FROM post WHERE status = '0' AND flag = false`;

		postNotApprove = await pool.query(postNotApproveQuery);

		let totalPost;
		const totalPostQuery = `SELECT count(*) FROM post WHERE flag = false`;

		totalPost = await pool.query(totalPostQuery);

		let totalCourse;
		const totalCourseQuery = `SELECT count(*) FROM course WHERE status = '1'`;

		totalCourse = await pool.query(totalCourseQuery);

		let userNew;
		const userNewQuery = `SELECT count(*) FROM users WHERE role_id = '5' AND status = '1'
		 AND to_char(created_at, 'MM') = $1 AND to_char(created_at, 'YYYY') = $2`;
		const userNewParams = [
			('0' + (new Date().getMonth() + 1)).slice(-2),
			new Date().getFullYear(),
		];

		userNew = await pool.query(userNewQuery, userNewParams);

		let postDataChart;
		const postDataChartQuery = `SELECT a.count, a.month FROM (
			SELECT COUNT(post_id), to_char(created_at, 'MM') as month, to_char(created_at,'YYYY') as year FROM post
				WHERE flag = false GROUP BY month, year) a
				WHERE a.year = $1`;
		const postDataChartParams = [new Date().getFullYear()];

		postDataChart = await pool.query(postDataChartQuery, postDataChartParams);

		let postByMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

		for (let i = 0; i < postDataChart.rowCount; i++) {
			const month = parseInt(postDataChart.rows[i].month);
			postByMonth[month - 1] = postDataChart.rows[i].count;
		}

		const postChart = {
			labels: [
				'T1',
				'T2',
				'T3',
				'T4',
				'T5',
				'T6',
				'T7',
				'T8',
				'T9',
				'T10',
				'T11',
				'T12',
			],
			datasets: [
				{
					label: 'Tổng số bài viết',
					data: [
						postByMonth[0],
						postByMonth[1],
						postByMonth[2],
						postByMonth[3],
						postByMonth[4],
						postByMonth[5],
						postByMonth[6],
						postByMonth[7],
						postByMonth[8],
						postByMonth[9],
						postByMonth[10],
						postByMonth[11],
					],
					fill: false,
					backgroundColor: '#FF4F79',
					borderColor: '#FF4F79',
					borderWidth: 1,
				},
			],
		};

		return res.status(200).json({
			postNotApprove: postNotApprove.rows[0].count,
			totalPost: totalPost.rows[0].count,
			totalCourse: totalCourse.rows[0].count,
			userNew: userNew.rows[0].count,
			postChart,
		});
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'dashboard.controller.js',
			'getManagerPostDashboard'
		);
		return next(error);
	}
};

const getRevenus = async (req, res, next) => {
	// 2 là tháng 3 là năm
	const { page, limit, q, filter1, filter2, filter3 } = req.query;

	const offset = (page - 1) * limit;
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
				select CONCAT(payment.month,'/',payment.year) as time,
						payment.student_id as user_id,payment.class_id, class.class_name ,
						users.full_name,payment.amount,payment.payment_id as id,
						to_char(payment.payment_date,'dd/MM/YYYY') as payment_date
					from payment 
					inner join 
					users on payment.student_id = users.user_id
					inner join 
					class on class.class_id = payment.class_id
				where payment.month >=$4 and payment.month <=$5 and payment.year >=$6 and payment.year <= $7   and 
				(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				class.class_id ${filter1 === '' ? '!' : ''}= $3  AND payment.flag = false
				order by payment.payment_date DESC
				LIMIT $8 OFFSET $9
			`;
			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				from_month,
				to_month,
				from_year,
				to_year,
				limit,
				offset,
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

const getCountRevenus = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;

	const regex = /([12]\d{3}-(0[1-9]|1[0-2]))/;
	if (filter2 && filter2.match(regex) && filter3 && filter3.match(regex)) {
		try {
			const from = filter2.split('-');
			const to = filter3.split('-');
			const from_year = parseInt(from[0]);
			const from_month = parseInt(from[1]);
			const to_year = parseInt(to[0]);
			const to_month = parseInt(to[1]);

			let query = `
			select count(payment.payment_id)
					from payment 
					inner join 
					users on payment.student_id = users.user_id
					inner join 
					class on class.class_id = payment.class_id
				where payment.month >=$4 and payment.month <=$5 and payment.year >=$6 and payment.year <= $7  and 
				(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				class.class_id ${filter1 === '' ? '!' : ''}= $3  AND payment.flag = false
			
			
			
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

			return res.status(200).json(data.rows[0]);
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
		return res.status(200).json({
			count: '0',
		});
	}
};

const getProceedsAndSale = async (req, res, next) => {
	const { q, filter1, filter2, filter3 } = req.query;

	const regex = /([12]\d{3}-(0[1-9]|1[0-2]))/;
	if (filter2 && filter2.match(regex) && filter3 && filter3.match(regex)) {
		try {
			const from = filter2.split('-');
			const to = filter3.split('-');
			const from_year = parseInt(from[0]);
			const from_month = parseInt(from[1]);
			const to_year = parseInt(to[0]);
			const to_month = parseInt(to[1]);
			let query = `
			select	 Sum(payment.amount) as proceeds
			from 
				payment
			inner join 
				users on payment.student_id = users.user_id
			inner join 
				class on class.class_id = payment.class_id
				where payment.payment_date is not null
				and payment.month >=$4 and payment.month <=$5 and payment.year >=$6 and payment.year <= $7  
				and (LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				class.class_id ${filter1 === '' ? '!' : ''}= $3  AND payment.flag = false
			`;

			let query_sale = `
			select	 Sum(payment.amount) as sale
			from 
				payment
			inner join 
				users on payment.student_id = users.user_id
			inner join 
				class on class.class_id = payment.class_id
				where  
				payment.month >=$4 and payment.month <=$5 and payment.year >=$6 and payment.year <= $7   and 

				(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				class.class_id ${filter1 === '' ? '!' : ''}= $3  AND payment.flag = false
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

			const proceeds = await pool.query(query, param);

			const sale = await pool.query(query_sale, param);

			const data = {
				proceeds: proceeds.rows[0],
				sale: sale.rows[0],
			};
			return res.status(200).json(data);
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
		const data = {
			proceeds: '0',
			sale: '0',
		};
		return res.status(200).json(data);
	}
};

const getRevenusOnline = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3 } = req.query;

	const offset = (page - 1) * limit;
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
			select  distinct users.user_id,course.course_id,users.full_name, course.title,to_char(register.created_at,'dd/MM/YYYY') as buy_date,
					course_student.price,
					to_char(course_student.join_date,'dd/MM/YYYY') as join_date,
				
					register.register_id as id
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
			order by join_date DESC
			LIMIT $6 OFFSET $7
			`;
			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				list_month,
				list_year,
				limit,
				offset,
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

const getCountRevenusOnline = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, filter3 } = req.query;

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
				return res.status(200).json({
					count: '0',
				});
			}
			let query = `
			select  count(register.register_id)
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
		
		
			
			
			`;
			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				list_month,
				list_year,
			];
			const data = await pool.query(query, param);
			return res.status(200).json(data.rows[0]);
		} catch (err) {
			const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'dashboard.controller.js',
				'getCountRevenusOnline'
			);
			return next(error);
		}
	} else {
		return res.status(200).json({
			count: '0',
		});
	}
};

const getProceedsAndSaleOn = async (req, res, next) => {
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
				const data = {
					proceeds: '0',
					sale: '0',
				};
				return res.status(200).json(data);
			}
			let query = `
			select 
				sum(price) as proceeds
			from 
				course_student 
			inner join 
				users on users.user_id = course_student.student_id
			inner join 
				register on register.course_id = course_student.course_id
			where course_student.join_date is not null
				and (LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) 
				and to_char(register.created_at,'MM') = ANY($4)
				and to_char(register.created_at,'YYYY')=ANY($5)
				and course_student.course_id ${filter1 === '' ? '!' : ''}= $3 
			`;

			let query_sale = `
			select 
				sum(price) as sale
			from 
				course_student 
			inner join 
				users on users.user_id = course_student.student_id
			inner join 
				register on register.course_id = course_student.course_id
			where 
				(LOWER(users.full_name) like LOWER($1) or  LOWER(users.user_id) like LOWER($2)) and
				course_student.course_id ${filter1 === '' ? '!' : ''}= $3 
				and to_char(register.created_at,'MM') = ANY($4)
				and to_char(register.created_at,'YYYY')=ANY($5)
			`;

			const param = [
				'%' + q + '%',
				'%' + q + '%',
				filter1,
				list_month,
				list_year,
			];
			const proceeds = await pool.query(query, param);

			const sale = await pool.query(query_sale, param);

			const data = {
				proceeds: proceeds.rows[0],
				sale: sale.rows[0],
			};
			return res.status(200).json(data);
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
		const data = {
			proceeds: '0',
			sale: '0',
		};
		return res.status(200).json(data);
	}
};

const getRefundMoney = async (req, res, next) => {
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
				select 	payment.payment_id,users.full_name,class.class_name,payment.amount,payment.status,
						payment.additional_charges,payment.residual_fee,payment.refund_status,
						(payment.residual_fee-payment.additional_charges) as refund

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
				and (LOWER(users.full_name) like LOWER($9) or  LOWER(users.user_id) like LOWER($10)) 
				and class.class_id ${filter1 === '' ? '!' : ''}= $11
				order by refund_status
				LIMIT $7 OFFSET $8
			`;
			const param = [
				last_month,
				last_year,
				month,
				year,
				month,
				year,
				limit,
				offset,
				'%' + q + '%',
				'%' + q + '%',
				filter1,
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

const getCountRefundMoney = async (req, res, next) => {
	// 2 là tháng 3 là năm
	const { q, filter1, filter2 } = req.query;

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
				select  count(payment.payment_id)
				 from payment
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

			return res.status(200).json(data.rows[0]);
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

const updateRefundMoney = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_list_revenue');
	if (!check) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào chức năng này!',
			403
		);
		return next(error);
	}

	// const errors = validationResult(req);
	// if (!errors.isEmpty()) {
	// 	return next(
	// 		new HttpError(
	// 			'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
	// 			422
	// 		)
	// 	);
	// }

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;

	const payments = req.body;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (let i = 0; i < payments.length; i++) {
			if (!validator.matches(payments[i].status, /^(0|1)$/)) {
				await client.query('ROLLBACK');
				client.release();
				return next(new HttpError('Đầu vào không hợp lệ', 422));
			}
			await client.query(
				`
				Update payment 
				set refund_status =$1
				where payment_id=$2
		`,
				[payments[i].status, payments[i].payment_id]
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
			'updatePost'
		);
		return next(error);
	} finally {
		client.release();
	}

	// update attendance

	return res.json({ message: 'Cập nhật thành công' });
};

const getTotalAdditionalChargesAndresidualFee = async (req, res, next) => {
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
			let query_get_total_residual_fee_additional_charges = `
			select coalesce(sum(payment.residual_fee),0) as residual_fee  ,
					coalesce(sum(payment.additional_charges),0) as additional_charges

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
		
		
		`;
			const param_get_total_residual_fee_additional_charges = [
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
			const get_total_residual_fee_additional_charges = await pool.query(
				query_get_total_residual_fee_additional_charges,
				param_get_total_residual_fee_additional_charges
			);
			// if(get_total_residual_fee_additional_charges)

			return res
				.status(200)
				.json(get_total_residual_fee_additional_charges.rows[0]);
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
		return res.status(200).json({
			residual_fee: '0',
			additional_charges: '0',
		});
	}
};

module.exports = {
	getAdminDashboard,
	getManagerDashboard,
	getTeacherDashboard,
	getMarketerDashboard,
	getManagerPostDashboard,
	getRevenus,
	getCountRevenus,
	getProceedsAndSale,
	getRevenusOnline,
	getCountRevenusOnline,
	getProceedsAndSaleOn,
	getRefundMoney,
	updateRefundMoney,
	getCountRefundMoney,
	getTotalAdditionalChargesAndresidualFee,
};
