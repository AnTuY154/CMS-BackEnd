const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');
const { validationResult } = require('express-validator');
const {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
} = require('../common/validate');
const validator = require('validator').default;
const mail = require('../configs/mail.config');

const getPostCategory = async (req, res, next) => {
	try {
		const results = await pool.query(
			`SELECT setting_id as id,setting_value as text,description FROM setting where setting_type='post_category' and flag=false`
		);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getPostCategory'
		);
		return next(error);
	}
};

const getApprovePost = async (req, res, next) => {
	try {
		const results = await pool.query(
			`Select count(post_id) from post where flag=false and status = '1'`
		);

		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getApprovePost'
		);
		return next(error);
	}
};

const total_record = async (req, res, next) => {
	const { q, filter1 } = req.query;
	let user_id = '';
	const role = req.userData.role;
	const userId = req.userData.userId;
	if (role != 1 && role != 7) {
		user_id = userId;
	}
	try {
		const results = await pool.query(
			`Select 
			Count(distinct post.post_id)
		from 
			post 
		left join 
			post_setting on post.post_id = post_setting.post_id
		left join 
			setting on post_setting.setting_id = setting.setting_id	and setting.flag=false
		Inner join users on users.user_id = post.created_by							
		Where 
			post.flag=false and
			( LOWER(post.title) like LOWER($1) or  LOWER(users.full_name) like LOWER($2)) and 
			post.status ${filter1 === '' ? '!' : ''}= $3
			and post.created_by ${user_id !== '' ? '' : '!'}= $4
			`,
			['%' + q + '%', '%' + q + '%', filter1, user_id]
		);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'total_record'
		);
		return next(error);
	}
};

const updatePostFlag = async (req, res, next) => {
	const userId = req.userData.userId;
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_delete_post');
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
	const { post_id, status } = req.body;

	if (post_id) {
		try {
			const userId = req.userData.userId;
			const datetime = new Date().toISOString();
			const results = await pool.query(
				`UPDATE public.post
				SET status=$4,
				modified_by=$1, modified_at=$2
				WHERE  post_id=$3;`,
				[userId, datetime, post_id, status]
			);

			if (status == '4') {
				const postInfoQuery = `select post_id, title from post where post_id = $1`;
				const postInfoParams = [post_id];
				const postInfo = await pool.query(postInfoQuery, postInfoParams);
				const senderQuery = `SELECT full_name, email FROM users WHERE user_id = $1 AND status = '1' AND is_confirm = true LIMIT 1`;
				const senderParams = [userId];
				const sender = await pool.query(senderQuery, senderParams);
				const managerQuery = `SELECT full_name, email FROM users WHERE role_id = '7' AND status = '1' AND is_confirm = true LIMIT 1`;
				const manager = await pool.query(managerQuery);

				if (manager.rowCount > 0 && sender.rowCount > 0) {
					const mailOptions = {
						from: `${sender.rows[0].full_name.toString()} - Xoài Academy <vietokokbusiness@gmail.com>`,
						to: manager.rows[0].email.toString(),
						subject: `Yêu cầu kiểm duyệt bài viết ${postInfo.rows[0].title.toString()}`,
						text: ``,
						html: `<p>Xin chào ${manager.rows[0].full_name},</p>
							<p>Bạn đã nhận được yêu cầu kiểm duyệt bài viết ${postInfo.rows[0].title} với mã bài viết là ${postInfo.rows[0].post_id}</p>`,
					};

					await mail.sendMail(mailOptions);
				}
			}

			res.json({
				message: 'Cập nhật trạng thái thành công',
			});
		} catch (err) {
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
			mail.close();
		}
	} else {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		return next(error);
	}
};

const getPostList = async (req, res, next) => {
	const { page, limit, q, filter1 } = req.query;
	const offset = (page - 1) * limit;
	let user_id = '';
	const role = req.userData.role;
	const userId = req.userData.userId;
	if (role != 1 && role != 7) {
		user_id = userId;
	}
	try {
		const query = `
		Select 
			distinct post.post_id as id,post.title,post.created_by,string_agg(	setting.setting_value, ',') as category ,
			users.user_id,to_char(post.created_at,'YYYY/MM/DD') as date,post.status as post_status,users.full_name,post.modified_at,post.created_at
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
			and post.created_by ${user_id !== '' ? '' : '!'}= $6
		group by post.post_id,users.user_id,post.modified_at
		order by post_status ASC ,post.modified_at DESC,post.created_at DESC  LIMIT $4 OFFSET $5
		`;
		const param = [
			'%' + q + '%',
			'%' + q + '%',
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
			'post.controller.js',
			'getPostList'
		);
		return next(error);
	}
};

const getPostById = async (req, res, next) => {
	const postId = req.params.postId;

	try {
		const results = await pool.query(
			`
		SELECT 	users.full_name,post.is_featured, 
				post.post_id, string_agg(post_setting.setting_id, ',') as setting_id,
				post.thumbnail, post.title, post.brief_info, post.full_content, post.ebook_link, 
				post.status, post.flag, post.created_by
		FROM 
			post 
		left join 
			post_setting 
		on post.post_id = post_setting.post_id  and post_setting.flag=false
		inner join users
		on post.created_by=users.user_id
		where post.post_id = $1
		group by post.post_id,users.full_name
		`,
			[postId]
		);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getPostById'
		);
		return next(error);
	}
};

const updatePost = async (req, res, next) => {
	const errors = validationResult(req);

	const datetime = new Date().toISOString();
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_edit_post');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const {
		title,
		brief_info,
		full_content,
		ebook_link,
		category_list,
		post_id,
		thumbnailUrl,
		isFeatured,
	} = req.body;

	if (
		!validateIsEmpty(title) ||
		!validateIsEmpty(brief_info) ||
		!validateIsEmpty(category_list) ||
		!validateMaxLength(title, 255) ||
		!validateMaxLength(brief_info, 255) ||
		!validateMaxLength(full_content, 100000)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	if (
		!validateIsString(title) ||
		!validateIsString(brief_info) ||
		!validateIsString(category_list) ||
		!validator.isBoolean(isFeatured)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const userId = req.userData.userId;

	const category = category_list.split(',');
	let thumbnail;
	if (thumbnailUrl) {
		if (!validateMaxLength(thumbnailUrl, 255)) {
			return next(
				new HttpError(
					'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
					422
				)
			);
		}
		thumbnail = thumbnailUrl;
	} else {
		thumbnail = req.file.location;
	}
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`
			UPDATE public.post
			SET  	thumbnail=$1, title=$2, brief_info=$3, full_content=$4,
					ebook_link=$5, status=$6, modified_by=$7, modified_at=$8,
					is_featured=$10
			WHERE post_id=$9;
	`,
			[
				thumbnail,
				title,
				brief_info,
				full_content,
				ebook_link,
				'0',
				userId,
				datetime,
				post_id,
				isFeatured,
			]
		);
		await client.query(`delete from post_setting where post_id=$1`, [post_id]);

		category.map(async (category_id) => {
			await client.query(
				`INSERT INTO post_setting(
			post_id, setting_id, flag)
			VALUES ($1, $2, $3);`,
				[post_id, category_id, '0']
			);
		});
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
	}

	return res.json({ message: 'Chỉnh sửa thành công' });
};
// reject or accept
const reviewPost = async (req, res, next) => {
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
	const check = await functionCommon.checkRole(role, 'function_review_post');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const { post_id, status, isFeatured } = req.body;
	const userId = req.userData.userId;

	try {
		await pool.query(
			`
			UPDATE public.post
			SET  status=$1, modified_by=$2, modified_at=$3,is_featured=$5
			WHERE post_id=$4;
	`,
			[status, userId, datetime, post_id, isFeatured]
		);
		if (status == '1') {
			res.json({ message: 'Duyệt bài viết thành công' });
		} else {
			res.json({ message: 'Từ chối bài viết thành công' });
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'reviewPost'
		);
		return next(error);
	}
};

const createPost = async (req, res, next) => {
	const role = req.userData.role;
	const user_id = req.userData.userId;
	const check = await functionCommon.checkRole(role, 'function_create_post');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const datetime = new Date().toISOString();
	const {
		title,
		brief_info,
		full_content,
		ebook_link,
		category_list,
		isFeatured,
	} = req.body;

	if (
		!validateIsEmpty(title) ||
		!validateIsEmpty(brief_info) ||
		!validateIsEmpty(category_list) ||
		!validateMaxLength(title, 255) ||
		!validateMaxLength(brief_info, 255) ||
		!validateMaxLength(full_content, 100000)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	if (
		!validateIsString(title) ||
		!validateIsString(brief_info) ||
		!validateIsString(category_list) ||
		!validator.isBoolean(isFeatured)
	) {
		return next(
			new HttpError(
				'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
				422
			)
		);
	}

	const category = category_list.split(',');
	const thumbnail = req.file.location;

	const results = await pool.query(`SELECT nextval('post_id')`);
	const post_id = results.rows[0].nextval;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`
			INSERT INTO post(
			post_id, thumbnail, title, brief_info, full_content, ebook_link, is_featured, status, 
			flag, created_by, created_at, modified_by, modified_at,number_click)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`,
			[
				post_id,
				thumbnail,
				title,
				brief_info,
				full_content,
				ebook_link,
				isFeatured,
				'0',
				'0',
				user_id,
				datetime,
				null,
				null,
				0,
			]
		);
		for (let i = 0; i < category.length; i++) {
			await client.query(
				`INSERT INTO post_setting(
				post_id, setting_id, flag)
				VALUES ($1, $2, $3);`,
				[post_id, category[i], '0']
			);
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Something went wrong, please try again', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'createPost'
		);
		return next(error);
	} finally {
		client.release();
	}

	return res.status(200).json({ message: 'Tạo mới bài viết thành công' });
};

const updatePostCategory = async (req, res, next) => {
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
	const client = await pool.connect();
	const check = await functionCommon.checkRole(
		role,
		'function_setting_post_category'
	);
	if (check == true) {
		const datetime = new Date().toISOString();
		const userId = req.userData.userId;
		const { current_list, insert_list } = req.body;
		try {
			await client.query('BEGIN');
			for (let i = 0; i < insert_list.length; i++) {
				if (
					insert_list[i].text == '' ||
					insert_list[i].text == null ||
					insert_list[i].text == undefined ||
					!validateMaxLength(insert_list[i].text, 255) ||
					insert_list[i].description == '' ||
					insert_list[i].description == null ||
					insert_list[i].description == undefined ||
					!validateMaxLength(insert_list[i].description, 255)
				) {
					return next(
						new HttpError(
							'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
							422
						)
					);
				}
				await pool.query(
					`
							INSERT INTO public.setting(
								setting_id,
								setting_type, 
								setting_value, 
								description, 
								created_by
								)
								VALUES (nextval('setting_id'), 
								$1, $2, $3, $4)
							`,
					[
						'post_category',
						insert_list[i].text,
						insert_list[i].description,
						userId,
					]
				);
			}

			for (let i = 0; i < current_list.length; i++) {
				if (
					current_list[i].text == '' ||
					current_list[i].text == null ||
					current_list[i].text == undefined ||
					!validateMaxLength(current_list[i].text, 255) ||
					current_list[i].description == '' ||
					current_list[i].description == null ||
					current_list[i].description == undefined ||
					!validateMaxLength(current_list[i].description, 255) ||
					current_list[i].id == '' ||
					current_list[i].id == null ||
					current_list[i].id == undefined
				) {
					return next(
						new HttpError(
							'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
							422
						)
					);
				}
				await pool.query(
					`
							UPDATE public.setting
							SET 
								setting_value=$1, 
								description=$2, 
								modified_by=$3, 
								modified_at=$4
							WHERE setting_id=$5;
							`,
					[
						current_list[i].text,
						current_list[i].description,
						userId,
						datetime,
						current_list[i].id,
					]
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

		return res
			.status(200)
			.json({ message: 'Thêm thể loại bài viết thành công' });
	} else {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
};

const updateCategoryFlagD = async (req, res, next) => {
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

	const check = await functionCommon.checkRole(
		role,
		'function_setting_post_category'
	);

	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { setting_id } = req.body;
	try {
		await pool.query(
			`
			UPDATE public.post_setting
			SET  flag=true
			WHERE setting_id=$1
	`,
			[setting_id]
		);

		await pool.query(
			`
			UPDATE public.setting
			SET  
				modified_by=$1, 
				modified_at=$2, 
				flag=true
			WHERE setting_id=$3
	`,
			[userId, datetime, setting_id]
		);

		res.json({ message: 'Cập nhập bài viết thành công' });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'updateCategoryFlagD'
		);
		return next(error);
	}
};

const getCountPostByMaketingId = async (req, res, next) => {
	const maketingId = req.params.maketingId;
	let count;
	try {
		count = await pool.query(
			`SELECT Count(*) FROM post where created_by = $1`,
			[maketingId]
		);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'post.controller.js',
			'getCountPostByMaketingId'
		);
		return next(error);
	}

	res.json(count.rows[0].count);
};

module.exports = {
	getPostCategory,
	createPost,
	getPostList,
	total_record,
	getApprovePost,
	getPostById,
	updatePost,
	reviewPost,
	updatePostFlag,
	updatePostCategory,
	updateCategoryFlagD,
	getCountPostByMaketingId,
};
