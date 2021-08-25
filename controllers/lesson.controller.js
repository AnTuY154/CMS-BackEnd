const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');
const { validationResult } = require('express-validator');
const validator = require('validator').default;
const {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
} = require('../common/validate');

const getTopics = async (req, res, next) => {
	const courseId = req.params.courseId;

	try {
		const userId = req.userData.userId;
		const datetime = new Date().toISOString();
		const results = await pool.query(
			`select distinct lesson_title as label ,lesson_order as lessonOrder,lesson_id as value from lesson where course_id = $1 and flag=false`,
			[courseId]
		);
		res.json({
			data: results.rows,
		});
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

const getTopics2 = async (req, res, next) => {
	const courseId = req.params.courseId;

	try {
		const userId = req.userData.userId;
		const datetime = new Date().toISOString();
		const results = await pool.query(
			`select distinct lesson_title as text , lesson_title as value from lesson where course_id = $1 and flag=false`,
			[courseId]
		);
		res.json({
			data: results.rows,
		});
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

const createLesson = async (req, res, next) => {
	const role = req.userData.role;

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const check = await functionCommon.checkRole(role, 'function_create_lesson');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { lesson, source } = req.body;
	const userId = req.userData.userId;

	if (
		!validateIsEmpty(lesson.course_id) ||
		!validateMaxLength(lesson.course_id, 255) ||
		!validateIsEmpty(lesson.topic_order) ||
		!validateMaxLength(lesson.topic_order, 255) ||
		!validateIsEmpty(source.lesson_name) ||
		!validateMaxLength(source.lesson_name, 255) ||
		!validateIsEmpty(source.lesson_order) ||
		!validateIsEmpty(source.lesson_order, 255) ||
		((source.video_link == null ||
			source.video_link == undefined ||
			source.video_link == '') &&
			(source.source_detail == null ||
				source.source_detail == undefined ||
				source.source_detail == ''))
	) {
		const error = new HttpError(
			'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
			422
		);
		return next(error);
	}

	if (
		!validateMaxLength(source.source_detail, 100000) ||
		validator.isNumeric(source.lesson_order) == false ||
		!validateMaxLength(source.video_link, 255) ||
		validator.matches(
			source.video_link,
			/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
		) == false
	) {
		const error = new HttpError(
			'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
			422
		);
		return next(error);
	}

	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		let lesson_id = '';
		// dau tien inser vao lesson nếu là mới
		if (lesson.lesson_id.length == 0) {
			if (
				lesson.lesson_topic == null ||
				lesson.lesson_topic == '' ||
				lesson.lesson_topic == undefined ||
				validator.isNumeric(lesson.topic_order) == false ||
				!validateMaxLength(lesson.lesson_topic, 255) ||
				!validateMaxLength(lesson.topic_order, 255)
			) {
				const error = new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				);
				return next(error);
			}
			const getLessonId = await client.query(` Select nextval('lesson_id')`);
			lesson_id = getLessonId.rows[0].nextval;
			const insertLesson = await client.query(
				`INSERT INTO public.lesson(
                    lesson_id, course_id, created_by,lesson_title,lesson_order)
                    VALUES ($1, $2, $3 , $4,$5);`,
				[
					lesson_id,
					lesson.course_id,
					userId,
					lesson.lesson_topic,
					lesson.topic_order,
				]
			);
		}

		// insert vao source
		const getSourceId = await client.query(`Select nextval('source_id')`);
		const source_id = getSourceId.rows[0].nextval;
		const insertSource = await client.query(
			`INSERT INTO public.source(
                 source_id, source_title, source_link, created_by, source_detail)
                 VALUES ($5, $1, $2, $3, $4);`,
			[
				source.lesson_name,
				source.video_link,
				userId,
				source.source_detail,
				source_id,
			]
		);

		if (lesson.lesson_id.length == 0) {
			// leson moi
			const insertLessonSource = await client.query(
				`INSERT INTO public.lesson_source(
                        lesson_id, source_id, created_by, "order", status)
                        VALUES ($1, $2, $3, $4, $5);`,
				[lesson_id, source_id, userId, source.lesson_order, '0']
			);
		} else {
			// leson cu
			const insertLessonSource = await client.query(
				`INSERT INTO public.lesson_source(
                        lesson_id, source_id, created_by, "order", status)
                        VALUES ($1, $2, $3, $4, $5);`,
				[lesson.lesson_id, source_id, userId, source.lesson_order, '0']
			);
		}

		await client.query('COMMIT');

		res.json({
			message: 'Tạo bài học thành công',
		});
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'lesson.controller.js',
			'getListLesson'
		);
		return next(error);
	} finally {
		client.release();
	}
};

const getListLesson = async (req, res, next) => {
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
		select lesson.lesson_order,lesson.lesson_title as topic,
                    source.source_title,lesson_source.order,lesson_source.status as source_status,lesson.created_at,
                    lesson_source.created_at,source.source_id as id from lesson_source
            inner join 
                source on lesson_source.source_id = source.source_id
            inner join 
                lesson on lesson.lesson_id=lesson_source.lesson_id
            where 
               lesson.course_id =$1 
                and ( LOWER(lesson.lesson_title) like LOWER($2) or  LOWER(source.source_title) like LOWER($3))
                and lesson.lesson_title ${filter1 === '' ? '!' : ''}= $4
                and lesson_source.status ${filter2 === '' ? '!' : ''}= $5
            order by lesson_order ASC , lesson_source.order ASC ,lesson_source.status ASC ,lesson.created_at DESC , lesson_source.created_at DESC
            LIMIT $6 OFFSET $7
		`;
		const param = [
			course_id,
			'%' + q + '%',
			'%' + q + '%',
			filter1,
			filter2,
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
			'lesson.controller.js',
			'getListLesson'
		);
		return next(error);
	}
};

const getTotalLesson = async (req, res, next) => {
	const { page, limit, q, filter1, filter2, course_id } = req.query;
	try {
		const query = `
		select count(*) from lesson_source
            inner join 
                source on lesson_source.source_id = source.source_id
            inner join 
                lesson on lesson.lesson_id=lesson_source.lesson_id
            where 
                lesson.course_id =$1 
                and ( LOWER(lesson.lesson_title) like LOWER($2) or  LOWER(source.source_title) like LOWER($3))
                and lesson.lesson_title ${filter1 === '' ? '!' : ''}= $4
                and lesson_source.status ${filter2 === '' ? '!' : ''}= $5

          
		`;
		const param = [course_id, '%' + q + '%', '%' + q + '%', filter1, filter2];
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
			'lesson.controller.js',
			'getListLesson'
		);
		return next(error);
	}
};

const updateLessonSourceStatus = async (req, res, next) => {
	const role = req.userData.role;

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const { source_id, status } = req.body;
	const check_delete = await functionCommon.checkRole(
		role,
		'function_delete_lesson'
	);
	const check_review = await functionCommon.checkRole(
		role,
		'function_review_lesson'
	);
	if (role == '3' && check_delete == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	} else if (role != '3' && check_review == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	if (source_id) {
		try {
			const userId = req.userData.userId;
			const datetime = new Date().toISOString();
			const results = await pool.query(
				`UPDATE public.lesson_source
                SET   
                    modified_by=$1, 
                    modified_at=$2, 
                    status=$3
                WHERE 
                    source_id=$4;`,
				[userId, datetime, status, source_id]
			);
			res.json({
				message: 'Cập nhật trạng thái thành công',
			});
		} catch (err) {
			const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
			sendLog(
				err.stack,
				error.code,
				error.message,
				'lesson.controller.js',
				'updateLessonSourceStatus'
			);
			return next(error);
		}
	} else {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		return next(error);
	}
};

const getSourceById = async (req, res, next) => {
	const sourceId = req.params.sourceId;
	try {
		const userId = req.userData.userId;
		const datetime = new Date().toISOString();
		const results = await pool.query(
			`select 
                lesson.lesson_title,lesson.lesson_order,source.source_title,lesson_source.order,source.source_link,
                source.source_detail,
                lesson.lesson_id,
                lesson_title as label

            from 
                lesson_source 
            inner join 
                source on lesson_source.source_id = source.source_id
            inner join 
                lesson on lesson_source.lesson_id = lesson.lesson_id
            where 
                source.source_id =$1`,
			[sourceId]
		);
		res.json({
			data: results.rows,
		});
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'lesson.controller.js',
			'getSourceById'
		);
		return next(error);
	}
};

const updateSource = async (req, res, next) => {
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
	const check1 = await functionCommon.checkRole(role, 'function_create_lesson');
	if (check1 == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const { lesson, source } = req.body;
	const userId = req.userData.userId;
	const datetime = new Date().toISOString();
	if (
		!validateIsEmpty(lesson.course_id) ||
		!validateMaxLength(lesson.course_id, 255) ||
		!validateIsEmpty(lesson.topic_order) ||
		!validateMaxLength(lesson.topic_order, 255) ||
		!validateIsEmpty(source.lesson_name) ||
		!validateMaxLength(source.lesson_name, 255) ||
		!validateIsEmpty(source.lesson_order) ||
		!validateIsEmpty(source.lesson_order, 255) ||
		((source.video_link == null ||
			source.video_link == undefined ||
			source.video_link == '') &&
			(source.source_detail == null ||
				source.source_detail == undefined ||
				source.source_detail == ''))
	) {
		const error = new HttpError(
			'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
			422
		);
		return next(error);
	}

	if (
		!validateMaxLength(source.source_detail, 100000) ||
		!validateMaxLength(source.video_link, 255) ||
		validator.isNumeric(source.lesson_order) == false ||
		validator.matches(
			source.video_link,
			/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
		) == false
	) {
		const error = new HttpError(
			'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.1',
			422
		);
		return next(error);
	}

	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE public.source
                SET     source_title=$1, 
                        source_link=$2, 
                        modified_by=$3, 
                        modified_at=$4, 
                        source_detail=$5
                WHERE source_id=$6`,
			[
				source.lesson_name,
				source.video_link,
				userId,
				datetime,
				source.source_detail,
				source.source_id,
			]
		);

		let lesson_id = '';
		// dau tien inser vao lesson nếu là mới
		if (lesson.lesson_id.length == 0) {
			const getLessonId = await client.query(` Select nextval('lesson_id')`);
			lesson_id = getLessonId.rows[0].nextval;
			if (
				lesson.lesson_topic == null ||
				lesson.lesson_topic == '' ||
				lesson.lesson_topic == undefined ||
				validator.isNumeric(lesson.topic_order) == false ||
				!validateMaxLength(lesson.lesson_topic, 255) ||
				!validateMaxLength(lesson.topic_order, 255)
			) {
				const error = new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				);
				return next(error);
			}

			if (validator.isNumeric(lesson.topic_order) == false) {
				const error = new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				);
				return next(error);
			}
			// insert new lesson
			await client.query(
				`INSERT INTO public.lesson(
                        lesson_id, course_id, created_by,lesson_title,lesson_order)
                        VALUES ($1, $2, $3 , $4,$5);`,
				[
					lesson_id,
					lesson.course_id,
					userId,
					lesson.lesson_topic,
					lesson.topic_order,
				]
			);
			// update source
			await client.query(
				`	UPDATE public.lesson_source
                    SET   lesson_id=$1,modified_by=$2, modified_at=$3, status=$4
                    WHERE source_id=$5 `,
				[lesson_id, userId, datetime, '0', source.source_id]
			);
		} else {
			// update neu la cu
			await client.query(
				`	UPDATE public.lesson_source
                    SET   lesson_id=$1,modified_by=$2, modified_at=$3, status=$4,"order"=$6
                    WHERE source_id=$5 `,
				[
					lesson.lesson_id,
					userId,
					datetime,
					'0',
					source.source_id,
					source.lesson_order,
				]
			);
		}

		await client.query('COMMIT');

		res.json({
			message: 'Cập nhật trạng thái thành công',
		});
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'lesson.controller.js',
			'updateLessonSourceStatus'
		);
		return next(error);
	} finally {
		client.release();
	}
};

module.exports = {
	getTopics,
	createLesson,
	getListLesson,
	getTotalLesson,
	updateLessonSourceStatus,
	getTopics2,
	getSourceById,
	updateSource,
};
