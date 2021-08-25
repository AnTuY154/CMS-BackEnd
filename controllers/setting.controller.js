const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');
const functionCommon = require('../common/function');
const { validationResult } = require('express-validator');
const validator = require('validator').default;
const { validateIsEmpty, validateMaxLength } = require('../common/validate');

// const getFeedBack = async (req, res, next) => {
// 	try {
// 		const results = await pool.query('SELECT * FROM public.tests');
// 		res.json({ tests: results });
// 	} catch (err) {
// 		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
// 		return next(error);
// 	}
// };

const handleSelectTime = (start_time, end_time) => {
	const start = start_time.split(':');
	const end = end_time.split(':');
	const start_hour = start[0];
	const start_minus = start[1];
	const end_hour = end[0];
	const end_minus = end[1];
	if (
		start_hour < end_hour ||
		(start_hour == end_hour && start_minus < end_minus)
	) {
		return true;
	} else {
		return false;
	}
};

const postSetting = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_post');
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
	const { category, category_des, create_by, modified_by } = req.body;
	pool.query(
		`INSERT INTO public.setting(
            setting_id, setting_type, setting_value, description, created_by, created_at, modified_by, modified_at, flag)
            VALUES (nextval('setting_id'), 'post_cateGory', $1, $2, $3, now(), $4, now(), 'false');`,
		[category, category_des, create_by, modified_by],
		(err, result) => {
			if (err) {
				const error = new HttpError(
					'Đã có lỗi xảy ra, vui lòng thử lại.',
					500
				);
				return next(error);
			}

			res.status(201).json({ result: 'insert success' });
		}
	);
};

const getEducationInfo = (req, res, next) => {
	const { category, category_des, create_by, modified_by } = req.body;
	pool.query(
		`INSERT INTO public.setting(
            setting_id, setting_type, setting_value, description, created_by, created_at, modified_by, modified_at, flag)
            VALUES (nextval('setting_id'), 'post_cateGory', $1, $2, $3, now(), $4, now(), 'false');`,
		[category, category_des, create_by, modified_by],
		(err, result) => {
			if (err) {
				const error = new HttpError(
					'Đã có lỗi xảy ra, vui lòng thử lại.',
					500
				);
				return next(error);
			}

			res.status(201).json({ result: 'insert success' });
		}
	);
};

const updateSlides = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_slider');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}
	const client = await pool.connect();
	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	// const {
	// 	current_list,
	// 	insert_list
	// } = req.body;

	const insert_list = JSON.parse(req.body.insert_list);

	const update_list = JSON.parse(req.body.update_list);
	let indexImage = -1;
	try {
		await client.query('BEGIN');
		for (let i = 0; i < insert_list.length; i++) {
			if (
				validateIsEmpty(insert_list[i].redirect_link) == false ||
				!validateMaxLength(insert_list[i].redirect_link,255)||
				!validator.isBoolean(insert_list[i].is_show.toString())
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			indexImage = indexImage + 1;
			await client.query(
				`
						INSERT INTO public.slider(
							slider_id, 
							image_link, 
							redirect_link, 
							created_by, 
							is_show)
							VALUES (nextval('slider_id'), $1, $2, $3, $4);
						`,
				[
					req.files[indexImage].location,
					insert_list[i].redirect_link,
					userId,
					insert_list[i].is_show,
				]
			);
		}

		for (let j = 0; j < update_list.length; j++) {
			if (
				validateIsEmpty(update_list[j].redirect_link) == false ||
				!validateMaxLength(update_list[j].redirect_link,255)||
				!validator.isBoolean(update_list[j].is_show.toString())
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			if (update_list[j].isChangePic == true) {
				indexImage = indexImage + 1;

				await client.query(
					`
						UPDATE public.slider
						SET 
							image_link=$1, 
							redirect_link=$2, 
							modified_by=$3, 
							modified_at=$4,
							is_show=$5
						WHERE slider_id=$6;
						`,
					[
						req.files[indexImage].location,
						update_list[j].redirect_link,
						userId,
						datetime,
						update_list[j].is_show,
						update_list[j].slider_id,
					]
				);
			} else {
				if (validateIsEmpty(update_list[j].slider_id) == false) {
					return next(
						new HttpError(
							'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
							422
						)
					);
				}
				await pool.query(
					`
						UPDATE public.slider
						SET 
						
							redirect_link=$1, 
							modified_by=$2, 
							modified_at=$3,
							is_show=$4
						WHERE slider_id=$5;
						`,
					[
						update_list[j].redirect_link,
						userId,
						datetime,
						update_list[j].is_show,
						update_list[j].slider_id,
					]
				);
			}
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Something went wrong, please try again', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'updateSlides'
		);
		return next(error);
	} finally {
		client.release();
	}
	return res.status(200).json({ message: 'Tạo slide thành công' });
};

const getListSlides = async (req, res, next) => {
	try {
		const results = await pool.query(`
					Select 
						slider_id ,image_link,redirect_link,is_show 
					From 
						slider 
					Where  
						flag=false
					Order by 
						is_show DESC,
						created_at ASC
					`);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'getListSlides'
		);
		return next(error);
	}
};

const updateSlidesFlag = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_slider');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { slider_id } = req.body;

	try {
		const results = await pool.query(
			`
				UPDATE public.slider
				SET   
					modified_by=$1,
					modified_at=$2, 
					flag=true
				WHERE slider_id=$3;
					`,
			[userId, datetime, slider_id]
		);
		if (results.rowCount == 1) {
			return res.json({ message: `Xóa slide thành công` });
		} else {
			const error = new HttpError('Không tìm thấy slide', 404);
			return next(error);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'updateSlidesFlag'
		);
		return next(error);
	}
};

const getListSlot = async (req, res, next) => {
	const type = req.params.type;
	try {
		const results = await pool.query(
			`
			select 
				slot_id,slot_name,start_time,end_time 
			from 
				slot 
			where 
				type =$1 and flag=false
			order by start_time
					`,
			[type]
		);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'getListSlides'
		);
		return next(error);
	}
};

const updateSlot = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_slot');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { type, insert_list, update_list } = req.body;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		for (let i = 0; i < insert_list.length; i++) {
			if (
				!validator.matches(
					insert_list[i].end_time.slice(0, 5),
					'([01]?[0-9]|2[0-3]):[0-5][0-9]'
				) ||
				!validateIsEmpty(insert_list[i].slot_name) ||
				!validateIsEmpty(insert_list[i].end_time) ||
				!validateIsEmpty(insert_list[i].start_time) ||
				!validator.matches(
					insert_list[i].start_time.slice(0, 5),
					'([01]?[0-9]|2[0-3]):[0-5][0-9]'
				) ||
				handleSelectTime(insert_list[i].start_time, insert_list[i].end_time) ==
					false
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ , vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			for (let k = i; k < insert_list.length; k++) {
				if (
					k != i &&
					insert_list[i].start_time == insert_list[k].start_time &&
					insert_list[i].end_time == insert_list[k].end_time
				) {
					return res.status(422).json({
						message:
							'Tồn tại ít nhất 2 slot trùng thời gian vui lòng kiểm tra lại',
					});
				}
			}

			await client.query(
				`
					INSERT INTO public.slot(
						slot_id, slot_name, start_time, end_time, created_by, type)
						VALUES (nextval('slot_id'), $1, $2, $3, $4, $5);
						`,
				[
					insert_list[i].slot_name,
					insert_list[i].start_time,
					insert_list[i].end_time,
					userId,
					type,
				]
			);
		}

		for (let j = 0; j < update_list.length; j++) {
			if (
				!validator.matches(
					update_list[j].end_time.slice(0, 5),
					'([01]?[0-9]|2[0-3]):[0-5][0-9]'
				) ||
				!validateIsEmpty(update_list[j].slot_name) ||
				!validateIsEmpty(update_list[j].slot_id) ||
				!validateIsEmpty(update_list[j].end_time) ||
				!validateIsEmpty(update_list[j].start_time) ||
				!validator.matches(
					update_list[j].start_time.slice(0, 5),
					'([01]?[0-9]|2[0-3]):[0-5][0-9]'
				) ||
				handleSelectTime(update_list[j].start_time, update_list[j].end_time) ==
					false
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ x, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			for (let l = j; l < update_list.length; l++) {
				if (
					l != j &&
					update_list[j].start_time == update_list[l].start_time &&
					update_list[j].end_time == update_list[l].end_time
				) {
					return res.status(422).json({
						message:
							'Tồn tại ít nhất 2 slot trùng thời gian vui lòng kiểm tra lại',
					});
				}
			}

			await client.query(
				`
						UPDATE public.slot
						SET slot_name=$1, start_time=$2, end_time=$3, modified_by=$4, modified_at=$5
						WHERE  slot_id=$6;
						`,
				[
					update_list[j].slot_name,
					update_list[j].start_time,
					update_list[j].end_time,
					userId,
					datetime,
					update_list[j].slot_id,
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
			'setting.controller.js',
			'updateSlot'
		);
		return next(error);
	} finally {
		client.release();
	}

	return res.status(200).json({ message: 'Thay đổi thành công' });
};

const updateSlotFlag = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_slot');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { slot_id, flag, type } = req.body;
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		if (type == undefined) {
			//check slot đang đc sử dụng
			const check_use = await client.query(
				`select  distinct class.class_name from schedule inner join class on class.class_id = schedule.class_id
			where schedule.slot_id = $1 and class.flag =false and class.class_status in ('0','1')`,
				[slot_id]
			);
			if (check_use.rowCount > 0) {
				return res.json({ isError: true, data: check_use.rows });
			}
		} else {
			const check_use = await client.query(
				`select distinct users.full_name from manager_shift 
				inner join users on users.user_id = manager_shift.manager_id where manager_shift.slot_id =$1
			and users.flag =false and users.status in ('1')`,
				[slot_id]
			);
			if (check_use.rowCount > 0) {
				return res.json({ isError: true, data: check_use.rows });
			}
		}

		const results = await pool.query(
			`
			UPDATE public.slot
			SET flag=$4, modified_by=$1, modified_at=$2
			WHERE  slot_id=$3
					`,
			[userId, datetime, slot_id, flag]
		);
		if (results.rowCount == 1) {
			await client.query('COMMIT');
			return res.json({ message: `Xóa thành công` });
		} else {
			const error = new HttpError(
				'Đã có lỗi xảy ra, vui lòng thử lại.',
				500
			);
			return next(error);
		}
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'updateSlidesFlag'
		);
		return next(error);
	} finally {
		client.release();
	}
};

const getListRooms = async (req, res, next) => {
	try {
		const results = await pool.query(`
			select 
				room_id,
				room_name,
				room_address,max_student 
			from 
				room 
			where flag =false
			order by created_at DESC
					`);
		res.json({ data: results.rows });
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'getListRoom'
		);
		return next(error);
	}
};

const updateRoomFlag = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_room');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { room_id, flag } = req.body;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const check_use = await client.query(
			`select  distinct class.class_name from
		schedule inner join class on class.class_id = schedule.class_id
		where schedule.room_id = $1
		`,
			[room_id]
		);
		if (check_use.rowCount > 0) {
			return res.json({ isError: true, data: check_use.rows });
		}

		const results = await pool.query(
			`
			UPDATE public.room
			SET flag=$4, modified_by=$1, modified_at=$2
			WHERE  room_id=$3
					`,
			[userId, datetime, room_id, flag]
		);
		if (results.rowCount == 1) {
			res.json({ message: `Xóa thành công` });
		} else {
			const error = new HttpError(
				'Đã có lỗi xảy ra, vui lòng thử lại.',
				500
			);
			return next(error);
		}

		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'setting.controller.js',
			'updateSlidesFlag'
		);
		return next(error);
	} finally {
		client.release();
	}
};

const updateRooms = async (req, res, next) => {
	const role = req.userData.role;
	const check = await functionCommon.checkRole(role, 'function_setting_room');
	if (check == false) {
		const error = new HttpError(
			'Bạn không có quyền truy cập vào API này !',
			403
		);
		return next(error);
	}

	const datetime = new Date().toISOString();
	const userId = req.userData.userId;
	const { insert_list, update_list } = req.body;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		for (let i = 0; i < insert_list.length; i++) {
			const query = `
			Select * from room where room_address = $1  and flag=false		
			`;
			const param = [insert_list[i].room_address];
			const results = await pool.query(query, param);
			if (results.rowCount > 0) {
				return res
					.status(422)
					.json({ message: 'Địa chỉ phòng học đã tồn tại đã tồn tại' });
			}

			if (
				!validateIsEmpty(insert_list[i].room_name) ||
				!validateIsEmpty(insert_list[i].room_address) ||
				!validateIsEmpty(insert_list[i].room_max) ||
				!validateMaxLength(insert_list[i].room_name,255)||
				!validateMaxLength(insert_list[i].room_address,255)||
				!validateMaxLength(insert_list[i].room_max,255)||
				(insert_list[i].room_max &&
					insert_list[i].room_max.toString().match(/^[0-9]+$/) == null)
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			for (let k = i; k < insert_list.length; k++) {
				if (
					k != i &&
					insert_list[i].room_address == insert_list[k].room_address
				) {
					return res.status(422).json({
						message:
							'Tồn tại ít nhất 2 phòng học trùng địa chỉ vui lòng kiểm tra lại',
					});
				}
			}

			if (parseInt(insert_list[i].room_max) < 0) {
				return res
					.status(422)
					.json({ message: 'Số lượng chỗ ngồi phải lớn hơn 0' });
			}
			await pool.query(
				`
				INSERT INTO public.room(
					room_id, room_name, room_address, created_by, max_student)
					VALUES (nextval('room_id'), $1,$2,$3, $4);
					`,
				[
					insert_list[i].room_name,
					insert_list[i].room_address,
					userId,
					insert_list[i].room_max,
				]
			);
		}

		for (let j = 0; j < update_list.length; j++) {
			if (
				!validateIsEmpty(update_list[j].room_name) ||
				!validateIsEmpty(update_list[j].room_address) ||
				!validateIsEmpty(update_list[j].room_max) ||
				!validateIsEmpty(update_list[j].room_id) ||
				!validateMaxLength(update_list[j].room_name,255)||
				!validateMaxLength(update_list[j].room_address,255)||
				!validateMaxLength(update_list[j].room_max,255)||
				(update_list[j].room_max &&
					update_list[j].room_max.match(/^[0-9]+$/) == null)
			) {
				return next(
					new HttpError(
						'Đầu vào không hợp lệ, vui lòng kiểm tra dữ liệu của bạn.',
						422
					)
				);
			}

			for (let l = j; l < update_list.length; l++) {
				if (
					l != j &&
					update_list[j].room_address == update_list[l].room_address
				) {
					return res.status(422).json({
						message:
							'Tồn tại ít nhất 2 phòng học trùng địa chỉ vui lòng kiểm tra lại',
					});
				}
			}

			if (parseInt(update_list[j].room_max) < 0) {
				return res
					.status(422)
					.json({ message: 'Số lượng chỗ ngồi phải lớn hơn 0' });
			}
			await pool.query(
				`
					UPDATE public.room
					SET  room_name=$1, room_address=$2, modified_by=$3, modified_at=$4, max_student=$5
					WHERE room_id=$6;
					`,
				[
					update_list[j].room_name,
					update_list[j].room_address,
					userId,
					datetime,
					update_list[j].room_max,
					update_list[j].room_id,
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
			'setting.controller.js',
			'updateSlot'
		);
		return next(error);
	} finally {
		client.release();
	}

	return res.status(200).json({ message: 'Cập nhật phòng học thành công' });
};

const checkExistSlot = async (req, res, next) => {
	const { end_time, start_time, slot_id, type } = req.query;
	try {
		const query = `
		Select * from slot where start_time =$1 and end_time =$2 and slot_id !=$3 and type=$4 and flag =false
		`;
		const param = [start_time, end_time, slot_id, type];
		const results = await pool.query(query, param);
		if (results.rowCount > 0) {
			if (type == '0') {
				return res.status(422).json({ message: 'Ca học đã tồn tại' });
			} else {
				return res.status(422).json({ message: 'Ca làm đã tồn tại' });
			}
		}
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
	return res.status(200).json({ message: 'ok' });
};

const checkExistRoom = async (req, res, next) => {
	const { room_address, room_id } = req.query;
	try {
		const query = `
		 Select * from room where room_address = $1 and room_id != $2 and flag=false		
		`;
		const param = [room_address, room_id];
		const results = await pool.query(query, param);
		if (results.rowCount > 0) {
			return res
				.status(422)
				.json({ message: 'Địa chỉ phòng học đã tồn tại đã tồn tại' });
		}
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
	return res.status(200).json({ message: 'ok' });
};

const getRolesSetting= async (req, res, next) => {
	
	try {
		const query = `
		 Select role_id ,role_value from role where role_id !='1' and flag=false order by role_id ASC;	
		`;
		const results = await pool.query(query);
		return res.status(200).json(results.rows);
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

module.exports = {
	updateRooms,
	postSetting,
	updateSlides,
	getListSlides,
	updateSlidesFlag,
	getListSlot,
	updateSlot,
	updateSlotFlag,
	getListRooms,
	updateRoomFlag,
	checkExistSlot,
	checkExistRoom,
	getRolesSetting
};
