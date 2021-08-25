const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const sendLog = require('../configs/tracking-log.config');
const { checkRole } = require('../common/function');
const { validationResult } = require('express-validator');

const getScheduleOfCenter = async (req, res, next) => {
	const check = await checkRole(req.userData.role, 'function_schedule');
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
			new HttpError('Đầu vào không hợp lệ, vui lòng kiểm tra lại.', 422)
		);
	}

	const { date } = req.query;

	const parseDate =
		new Date(date).getFullYear() +
		'-' +
		('0' + (new Date(date).getMonth() + 1)).slice(-2) +
		'-' +
		('0' + new Date(date).getDate()).slice(-2);

	let schedules;
	try {
		const query = `Select distinct room.room_id,schedule.class_id,schedule.slot_id,class.class_name from room					
        inner join schedule on room.room_id = schedule.room_id					
        inner join slot on slot.slot_id = schedule.slot_id					
        inner join class on class.class_id = schedule.class_id					
        where schedule.date = $1 AND class_status != '2'`;
		const params = [parseDate];

		schedules = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'center.controller.js',
			'getScheduleOfCenter'
		);
		return next(error);
	}

	return res.status(200).json(schedules.rows);
};

module.exports = {
	getScheduleOfCenter,
};
