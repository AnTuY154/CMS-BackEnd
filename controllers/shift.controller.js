const pool = require('../configs/db.config');
const sendLog = require('../configs/tracking-log.config');
const HttpError = require('../models/http-error');

const getManagerShifts = async (req, res, next) => {
	let shifts;
	try {
		const query = `SELECT slot_id, slot_name, start_time, end_time FROM slot WHERE type='1' AND slot.flag =false`;
		shifts = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'shift.controller.js',
			'getManagerShifts'
		);
		return next(error);
	}

	return res.status(200).json(shifts.rows);
};

const getSlots = async (req, res, next) => {
	let slots;
	try {
		const query = `SELECT slot_id, slot_name, start_time, end_time FROM slot WHERE type='0' AND flag=false`;
		slots = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'shift.controller.js',
			'getSlots'
		);
		return next(error);
	}

	return res.status(200).json(slots.rows);
};

const getShiftsByManagerId = async (req, res, next) => {
	const managerId = req.params.managerId;

	let shifts;
	try {
		const query = `Select slot_id,slot_name,start_time,end_time from slot where slot_id in (					
			select slot_id from manager_shift where manager_id =$1 and type='1'				
		)`;
		const params = [managerId];
		shifts = await pool.query(query, params);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'shift.controller.js',
			'getShiftsByManagerId'
		);
		return next(error);
	}

	return res.status(200).json(shifts.rows);
};

module.exports = {
	getManagerShifts,
	getShiftsByManagerId,
	getSlots,
};
