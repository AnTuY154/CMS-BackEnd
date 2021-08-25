const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const sendLog = require('../configs/tracking-log.config');

const getRooms = async (req, res, next) => {
	let rooms;
	try {
		const query = `select room_id,room_name from room where flag=false`;
		rooms = await pool.query(query);
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'room.controller.js',
			'getRooms'
		);
		return next(error);
	}

	return res.status(200).json(rooms.rows);
};

module.exports = { getRooms };
